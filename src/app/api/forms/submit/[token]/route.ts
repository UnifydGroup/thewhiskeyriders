import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import {
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  getIpAddress,
  supabase,
} from '@/lib/api/helpers';

// ── Columns that may be written from form responses ───────────────
// Everything not in this set is locked (id, user_id, role, status, etc.)
const WRITABLE_PROFILE_COLUMNS = new Set([
  'email', 'full_name', 'first_name', 'middle_name', 'surname', 'nickname', 'bio',
  'phone', 'phone_country_code',
  'emergency_contact', 'emergency_contact_number',
  'date_of_birth',
  'address', 'address_line1', 'address_line2',
  'address_city', 'address_state', 'address_postcode', 'address_country',
  'passport_number', 'passport_expiry',
  'shirt_size', 'shorts_size',
]);

// POST /api/forms/submit/[token] — public/member form submission
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // ── Resolve form by token (include title + field→library mappings) ──
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select(`
      id, title, status, allow_multiple_submissions, submission_deadline, goes_live_at, require_email_verification,
      form_fields(
        id, field_type, is_required,
        library_field:form_field_library(settings)
      )
    `)
    .eq('token', token)
    .single();

  if (formError || !form) return errorResponse(ApiErrors.NOT_FOUND, 'Form not found');

  const now = new Date();
  // Accept: status=active, OR a scheduled form where goes_live_at has passed
  const isScheduledAndLive = form.goes_live_at && new Date(form.goes_live_at) <= now;
  if (form.status !== 'active' && !isScheduledAndLive) {
    return errorResponse(ApiErrors.FORBIDDEN, 'This form is not currently accepting submissions');
  }
  if (form.submission_deadline && new Date(form.submission_deadline) < now) {
    return errorResponse(ApiErrors.FORBIDDEN, 'The submission deadline has passed');
  }

  // ── Identify submitter if authenticated ───────────────────────
  const { authenticated, profile } = await verifyAuth(request);
  const memberId = authenticated && profile ? profile.id : null;

  // Check for duplicate submission
  if (!form.allow_multiple_submissions && memberId) {
    const { data: existing } = await supabase
      .from('form_responses')
      .select('id')
      .eq('form_id', form.id)
      .eq('member_id', memberId)
      .maybeSingle();
    if (existing) {
      return errorResponse(ApiErrors.CONFLICT, 'You have already submitted this form');
    }
  }

  const body = await getJsonBody(request);
  const { values, updateProfile = true, verification_id } = body;
  if (!values || typeof values !== 'object') {
    return errorResponse(ApiErrors.BAD_REQUEST, 'values object is required');
  }

  // ── Email verification gate ───────────────────────────────
  // Track whether the submitter proved ownership of their email address.
  // This is true for: (a) authenticated sessions, (b) forms that required OTP.
  let emailWasVerified = !!memberId; // authenticated users are always considered verified
  let otpVerifiedEmail: string | null = null; // the exact email that was OTP-verified

  if (form.require_email_verification) {
    if (!verification_id) {
      return errorResponse(ApiErrors.FORBIDDEN, 'Email verification is required for this form');
    }
    const { data: verification, error: vErr } = await supabase
      .from('form_verifications')
      .select('id, email, verified_at, expires_at')
      .eq('id', verification_id)
      .eq('form_id', form.id)
      .single();

    if (vErr || !verification) {
      return errorResponse(ApiErrors.FORBIDDEN, 'Invalid verification token');
    }
    if (!verification.verified_at) {
      return errorResponse(ApiErrors.FORBIDDEN, 'Email has not been verified yet');
    }
    if (new Date(verification.expires_at) < new Date()) {
      return errorResponse(ApiErrors.FORBIDDEN, 'Verification has expired — please verify your email again');
    }
    // Capture the verified email before invalidating the token.
    // This is the authoritative email — we use it for profile matching rather
    // than whatever was typed into the form body (prevents verifying email A
    // then submitting with email B to tamper with another member's profile).
    emailWasVerified = true;
    otpVerifiedEmail = verification.email;

    // Invalidate token immediately after use (single-use)
    await supabase.from('form_verifications').delete().eq('id', verification_id);
  }

  // ── Validate required fields ──────────────────────────────────
  type FieldRow = {
    id: string;
    is_required: boolean;
    field_type: string;
    library_field?: { settings?: Record<string, unknown> | null } | null;
  };
  const fields: FieldRow[] = (form.form_fields || []) as FieldRow[];
  const layoutOnlyTypes = ['section_header'];
  for (const field of fields) {
    if (field.is_required && !layoutOnlyTypes.includes(field.field_type)) {
      const val = values[field.id];
      const isEmpty = val === null || val === undefined || val === ''
        || (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        return errorResponse(ApiErrors.BAD_REQUEST, `Required field missing: ${field.id}`);
      }
    }
  }

  // ── Build field → profiles_column map ────────────────────────
  const fieldColumnMap = new Map<string, string>(); // fieldId → profiles_column
  for (const field of fields) {
    const col = (field.library_field?.settings as Record<string, unknown> | null | undefined)?.profiles_column as string | undefined;
    if (col && WRITABLE_PROFILE_COLUMNS.has(col)) {
      fieldColumnMap.set(field.id, col);
    }
  }

  // Build profile update payload from submitted values
  const profileUpdates: Record<string, string | null> = {};
  for (const [fieldId, val] of Object.entries(values)) {
    const col = fieldColumnMap.get(fieldId);
    if (!col) continue;
    profileUpdates[col] = Array.isArray(val)
      ? val.join(', ')
      : val == null ? null : String(val);
  }

  // Validate email format if one was submitted
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (profileUpdates['email'] && !EMAIL_RE.test(profileUpdates['email'].trim())) {
    return errorResponse(ApiErrors.BAD_REQUEST, 'Please enter a valid email address.');
  }

  // Extract identity fields for profile matching.
  // If the form used OTP verification, trust the OTP-verified email over the
  // submitted form value to prevent body-tampering attacks.
  const submittedEmail = otpVerifiedEmail
    || profileUpdates['email']?.trim().toLowerCase()
    || null;
  const submittedFirstName = profileUpdates['first_name'] || null;
  const submittedSurname = profileUpdates['surname'] || null;

  // Derive full_name from parts when submitting name fields
  if (submittedFirstName || submittedSurname) {
    profileUpdates['full_name'] = [
      submittedFirstName,
      profileUpdates['middle_name'],
      submittedSurname,
    ].filter(Boolean).join(' ');
  }

  // ── Insert the form response row ─────────────────────────────
  const { data: response, error: respError } = await supabase
    .from('form_responses')
    .insert({
      form_id: form.id,
      member_id: memberId,
      is_public: false,
      ip_address: getIpAddress(request),
    })
    .select()
    .single();

  if (respError) return errorResponse(ApiErrors.INTERNAL_ERROR, respError.message);

  // Insert field values
  const valueRows = Object.entries(values).map(([fieldId, val]) => {
    const isJson = Array.isArray(val) || (typeof val === 'object' && val !== null);
    return {
      response_id: response.id,
      field_id: fieldId,
      value_text: isJson ? null : String(val ?? ''),
      value_json: isJson ? val : null,
    };
  });
  if (valueRows.length > 0) {
    const { error: valError } = await supabase.from('form_response_values').insert(valueRows);
    if (valError) return errorResponse(ApiErrors.INTERNAL_ERROR, valError.message);
  }

  // ── Sync values to member profile ────────────────────────────
  let targetProfileId: string | null = memberId;
  let newProfileCreated = false;
  let submitterLabel =
    profile?.full_name ||
    profile?.email ||
    (submittedFirstName ? [submittedFirstName, submittedSurname].filter(Boolean).join(' ') : null) ||
    submittedEmail ||
    'Anonymous';

  const hasProfileData = Object.keys(profileUpdates).length > 0;

  if (memberId) {
    // ── Authenticated: update directly ───────────────────────
    if (hasProfileData && updateProfile !== false) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('id', memberId);
      if (profileErr) {
        console.error('[form-submit] profile update failed:', profileErr.message);
      }
    }
  } else if (submittedEmail) {
    // ── Unauthenticated: find by email ────────────────────────
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, email, first_name')
      .ilike('email', submittedEmail)
      .maybeSingle();

    if (existing) {
      // Existing profile found — always back-link the response so admins can see it.
      targetProfileId = existing.id;
      submitterLabel = submittedEmail;

      await supabase
        .from('form_responses')
        .update({ member_id: existing.id })
        .eq('id', response.id);

      // ⚠️ Only update profile data when the email address has been verified
      // (either via OTP gate or because the user is authenticated). Without
      // proof of ownership, updating could let anyone overwrite another
      // member's profile by guessing their email address.
      if (emailWasVerified && hasProfileData && updateProfile !== false) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ ...profileUpdates, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (profileErr) {
          console.error('[form-submit] profile update (email match) failed:', profileErr.message);
        }
      }
    } else {
      // No matching profile — this person is not yet a member.
      // We cannot auto-create a profile because profiles.id must reference
      // an auth.users row (FK constraint). Admins are notified so they can
      // manually invite or register the submitter.
      const derivedFullName =
        profileUpdates['full_name'] ||
        [submittedFirstName, profileUpdates['middle_name'], submittedSurname]
          .filter(Boolean).join(' ') ||
        submittedEmail;
      submitterLabel = derivedFullName;
      newProfileCreated = true; // flag so admins get the "new contact" notification
      // targetProfileId remains null — response stays unlinked until admin onboards them
    }
  }

  // ── Notify all admins ─────────────────────────────────────────
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'super_admin', 'trip_admin'])
    .eq('status', 'active');

  const adminIds = ((admins || []) as { id: string }[]).map(a => a.id);

  if (adminIds.length > 0) {
    // Notification: form completed
    await supabase.from('notifications').insert(
      adminIds.map(uid => ({
        user_id: uid,
        type: 'form_submission',
        title: `Form submitted: ${form.title}`,
        message: `${submitterLabel} submitted "${form.title}"`,
        link: '/admin/forms',
        metadata: {
          form_id: form.id,
          response_id: response.id,
          submitter_profile_id: targetProfileId,
        },
      }))
    );

    // Notification: unknown submitter (no existing profile matched)
    if (newProfileCreated && !targetProfileId) {
      await supabase.from('notifications').insert(
        adminIds.map(uid => ({
          user_id: uid,
          type: 'new_contact',
          title: 'New contact via form',
          message: `${submitterLabel}${submittedEmail ? ` (${submittedEmail})` : ''} submitted "${form.title}" but is not yet a member. Invite them to create an account.`,
          link: '/admin/members',
          metadata: {
            form_id: form.id,
            response_id: response.id,
            email: submittedEmail,
            name: submitterLabel,
          },
        }))
      );
    }
  }

  return successResponse({ response_id: response.id }, 201);
}
