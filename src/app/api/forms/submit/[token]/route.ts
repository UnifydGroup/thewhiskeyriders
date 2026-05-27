import { NextRequest } from 'next/server';
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
      id, title, status, allow_multiple_submissions, submission_deadline,
      form_fields(
        id, field_type, is_required,
        library_field:form_field_library(settings)
      )
    `)
    .eq('token', token)
    .single();

  if (formError || !form) return errorResponse(ApiErrors.NOT_FOUND, 'Form not found');
  if (form.status !== 'active') return errorResponse(ApiErrors.FORBIDDEN, 'This form is not currently accepting submissions');
  if (form.submission_deadline && new Date(form.submission_deadline) < new Date()) {
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
  const { values } = body;
  if (!values || typeof values !== 'object') {
    return errorResponse(ApiErrors.BAD_REQUEST, 'values object is required');
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

  // Extract identity fields for profile matching
  const submittedEmail = profileUpdates['email']?.trim().toLowerCase() || null;
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
    if (hasProfileData) {
      await supabase
        .from('profiles')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('id', memberId);
    }
  } else if (submittedEmail) {
    // ── Unauthenticated: find by email ────────────────────────
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, email, first_name')
      .ilike('email', submittedEmail)
      .maybeSingle();

    if (existing) {
      // Existing profile found — update it
      targetProfileId = existing.id;
      submitterLabel = submittedEmail;
      if (hasProfileData) {
        await supabase
          .from('profiles')
          .update({ ...profileUpdates, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }
    } else {
      // No match — create a new pending profile
      const derivedFullName =
        profileUpdates['full_name'] ||
        [submittedFirstName, profileUpdates['middle_name'], submittedSurname]
          .filter(Boolean).join(' ') ||
        submittedEmail;

      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          ...profileUpdates,
          email: submittedEmail,
          full_name: derivedFullName,
          role: 'member',
          status: 'pending',
        })
        .select('id')
        .single();

      if (newProfile) {
        targetProfileId = newProfile.id;
        newProfileCreated = true;
        submitterLabel = derivedFullName;

        // Back-link the response to the new profile
        await supabase
          .from('form_responses')
          .update({ member_id: newProfile.id })
          .eq('id', response.id);
      }
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

    // Notification: new contact profile created
    if (newProfileCreated) {
      await supabase.from('notifications').insert(
        adminIds.map(uid => ({
          user_id: uid,
          type: 'new_profile',
          title: 'New contact from form',
          message: `${submitterLabel} submitted "${form.title}" — a new contact profile has been created and is pending review.`,
          link: '/admin/notifications',
          metadata: {
            form_id: form.id,
            profile_id: targetProfileId,
          },
        }))
      );
    }
  }

  return successResponse({ response_id: response.id }, 201);
}
