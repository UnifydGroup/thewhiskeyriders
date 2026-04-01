import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  logActivity,
  getIpAddress,
  isValidEmail,
  supabase,
} from '@/lib/api/helpers';

// Create a service role client for auth admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type CreateMemberPayload = {
  email: string;
  password?: string;
  first_name?: string;
  middle_name?: string;
  surname?: string;
  nickname?: string;
  phone_country_code?: string;
  phone?: string;
  emergency_contact?: string;
  emergency_contact_number?: string;
  date_of_birth?: string;
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_state?: string;
  address_postcode?: string;
  address_country?: string;
  passport_number?: string;
  passport_expiry?: string;
  bio?: string;
  avatar_url?: string;
  role?: string;
  shirt_size?: string;
  shorts_size?: string;
  status?: string;
};

// Helper to normalize text values (empty string → null)
function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

// Helper to normalize date values (empty string → null, invalid dates → null)
function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : text;
}

// POST /api/members/create - Create a new member (admin only)
export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;

  try {
    const { authenticated, authorized } = await verifyRole(request, ['admin', 'super_admin']);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    let body: CreateMemberPayload;
    try {
      body = await getJsonBody(request);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid request body';
      return errorResponse(ApiErrors.BAD_REQUEST, errorMsg);
    }

    // Validate required fields
    if (!body.email || !isValidEmail(body.email)) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Valid email is required');
    }

    if (!body.surname?.trim()) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Surname is required');
    }

    const normalizedEmail = body.email.trim().toLowerCase();

    // Check if a member with this email already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return errorResponse(
        ApiErrors.CONFLICT,
        `A member with email ${body.email} already exists`
      );
    }

    // Generate a secure temporary password if not provided
    const tempPassword =
      body.password ||
      `TempPass_${Date.now()}_${Math.random().toString(36).slice(2, 9)}!`;

    const firstName = normalizeText(body.first_name);
    const middleName = normalizeText(body.middle_name);
    const surname = normalizeText(body.surname);
    const fullName =
      [firstName, middleName, surname].filter(Boolean).join(' ').trim() || null;

    console.log('[API] Creating auth user for:', normalizedEmail);

    // Step 1: Create the Supabase auth user via the Admin SDK.
    // This triggers the handle_new_user() database function which auto-creates
    // a matching row in public.profiles. We pass names in user_metadata so the
    // trigger can populate first_name and surname on that initial row.
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true, // confirm immediately so the member can log in straight away
        user_metadata: {
          full_name: fullName,
          first_name: firstName,
          surname: surname,
          created_via: 'admin_panel',
        },
      });

    if (authError || !authData?.user) {
      const errMsg = authError?.message || 'Unknown error from Supabase auth';
      console.error('[API] Auth user creation failed:', authError);
      return errorResponse(
        ApiErrors.INTERNAL_ERROR,
        `Failed to create auth account: ${errMsg}`
      );
    }

    createdUserId = authData.user.id;
    console.log('[API] Created auth user:', createdUserId);

    // Step 2: Brief pause to let the database trigger complete before we UPDATE.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Step 3: UPDATE the profile record (which the trigger already created)
    // with all of the extra fields that the admin filled in.
    const profileUpdate = {
      full_name: fullName,
      first_name: firstName,
      middle_name: middleName,
      surname: surname,
      nickname: normalizeText(body.nickname),
      phone_country_code: normalizeText(body.phone_country_code),
      phone: normalizeText(body.phone),
      emergency_contact: normalizeText(body.emergency_contact),
      emergency_contact_number: normalizeText(body.emergency_contact_number),
      date_of_birth: normalizeDate(body.date_of_birth),
      address_line1: normalizeText(body.address_line1),
      address_line2: normalizeText(body.address_line2),
      address_city: normalizeText(body.address_city),
      address_state: normalizeText(body.address_state),
      address_postcode: normalizeText(body.address_postcode),
      address_country: normalizeText(body.address_country),
      passport_number: normalizeText(body.passport_number),
      passport_expiry: normalizeDate(body.passport_expiry),
      bio: normalizeText(body.bio),
      avatar_url: normalizeText(body.avatar_url),
      role: (normalizeText(body.role) || 'member') as 'super_admin' | 'admin' | 'trip_admin' | 'member',
      shirt_size: normalizeText(body.shirt_size),
      shorts_size: normalizeText(body.shorts_size),
      status: normalizeText(body.status) || 'active',
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', createdUserId)
      .select()
      .single();

    if (profileError) {
      console.error('[API] Profile update failed:', profileError);

      // The auth user was created and the trigger created a basic profile row.
      // The detailed update failed, but we still have a usable member record.
      // Return the basic profile so the admin can see it was created.
      const { data: basicProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', createdUserId)
        .maybeSingle();

      if (basicProfile) {
        console.warn('[API] Returning basic profile after update failure');
        return successResponse({
          user: authData.user,
          profile: basicProfile,
          message:
            'Member account created, but some details could not be saved. Please edit the member to add their remaining details.',
          warning: profileError.message,
        });
      }

      // Profile row not found at all — clean up the orphaned auth user and fail
      console.error('[API] No profile row found, cleaning up auth user');
      await supabaseAdmin.auth.admin
        .deleteUser(createdUserId)
        .catch((e) => console.error('[API] Failed to clean up auth user:', e));
      createdUserId = null;

      return errorResponse(
        ApiErrors.INTERNAL_ERROR,
        `Profile creation failed: ${profileError.message}`
      );
    }

    console.log('[API] Profile updated successfully for:', createdUserId);

    // Step 4: Record the admin activity (non-fatal if it fails)
    try {
      await logActivity(
        createdUserId,
        'create',
        'member',
        createdUserId,
        fullName || normalizedEmail,
        Object.keys(profileUpdate),
        getIpAddress(request)
      );
    } catch (logError) {
      console.error('[API] Activity logging failed (non-fatal):', logError);
    }

    return successResponse(
      {
        user: authData.user,
        profile,
        message:
          'Member created successfully. They can now log in with their email address.',
      },
      201
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/members/create unhandled error:', error);

    // Clean up orphaned auth user if we got that far before the failure
    if (createdUserId) {
      console.warn(
        '[API] Cleaning up orphaned auth user after unhandled error:',
        createdUserId
      );
      await supabaseAdmin.auth.admin
        .deleteUser(createdUserId)
        .catch((e) => console.error('[API] Failed to clean up auth user:', e));
    }

    return errorResponse(ApiErrors.INTERNAL_ERROR, errMsg);
  }
}
