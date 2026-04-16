import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ApiErrors,
  errorResponse,
  getJsonBody,
  isValidEmail,
  successResponse,
  supabase,
  createNotifications,
} from '@/lib/api/helpers';

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
let _adminInstance: ReturnType<typeof createClient> | null = null;
function _getAdmin() {
  if (!_adminInstance) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    _adminInstance = createClient(_supabaseUrl, key);
  }
  return _adminInstance;
}
const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get: (_t, prop) =>
    _getAdmin()[prop as keyof ReturnType<typeof createClient>],
});

type SignupRequestPayload = {
  email: string;
  password: string;
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
  shirt_size?: string;
  shorts_size?: string;
  bio?: string;
};

function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeDate(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : normalized;
}

function extractMissingProfilesColumn(errorMessage: string | undefined): string | null {
  if (!errorMessage) return null;
  const match = errorMessage.match(/Could not find the '([^']+)' column of 'profiles' in the schema cache/i);
  return match?.[1] ?? null;
}

async function updateProfileWithSchemaFallback(
  memberId: string,
  initialUpdateData: Record<string, unknown>
) {
  const updateData = { ...initialUpdateData };

  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', memberId)
      .select('*')
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = extractMissingProfilesColumn(error.message);
    if (!missingColumn || !(missingColumn in updateData)) {
      return { data: null, error };
    }

    delete updateData[missingColumn];
  }
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;

  try {
    let body: SignupRequestPayload;
    try {
      body = await getJsonBody(request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid request body';
      return errorResponse(ApiErrors.BAD_REQUEST, message);
    }

    const normalizedEmail = normalizeText(body.email)?.toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const firstName = normalizeText(body.first_name);
    const middleName = normalizeText(body.middle_name);
    const surname = normalizeText(body.surname);

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'A valid email is required');
    }

    if (password.length < 8) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Password must be at least 8 characters');
    }

    if (!firstName || !surname) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'First name and surname are required');
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, status')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.status === 'pending') {
        return errorResponse(ApiErrors.CONFLICT, 'Your signup request is already pending admin approval');
      }
      return errorResponse(ApiErrors.CONFLICT, 'An account with this email already exists');
    }

    const fullName = [firstName, middleName, surname].filter(Boolean).join(' ').trim() || null;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        surname,
        full_name: fullName,
        created_via: 'self_signup',
      },
    });

    if (authError || !authData?.user) {
      if (authError?.message?.toLowerCase().includes('already')) {
        return errorResponse(ApiErrors.CONFLICT, 'An account with this email already exists');
      }
      return errorResponse(ApiErrors.INTERNAL_ERROR, authError?.message || 'Failed to create account');
    }

    createdUserId = authData.user.id;

    await new Promise((resolve) => setTimeout(resolve, 300));

    const addressLine1 = normalizeText(body.address_line1);
    const addressLine2 = normalizeText(body.address_line2);
    const addressCity = normalizeText(body.address_city);
    const addressState = normalizeText(body.address_state);
    const addressPostcode = normalizeText(body.address_postcode);
    const addressCountry = normalizeText(body.address_country);
    const address =
      [
        addressLine1,
        addressLine2,
        [addressCity, addressState].filter(Boolean).join(', '),
        [addressPostcode, addressCountry].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ')
        .trim() || null;

    const profileUpdate = {
      email: normalizedEmail,
      first_name: firstName,
      middle_name: middleName,
      surname,
      full_name: fullName,
      nickname: normalizeText(body.nickname),
      phone_country_code: normalizeText(body.phone_country_code),
      phone: normalizeText(body.phone),
      emergency_contact: normalizeText(body.emergency_contact),
      emergency_contact_number: normalizeText(body.emergency_contact_number),
      date_of_birth: normalizeDate(body.date_of_birth),
      address_line1: addressLine1,
      address_line2: addressLine2,
      address_city: addressCity,
      address_state: addressState,
      address_postcode: addressPostcode,
      address_country: addressCountry,
      address,
      passport_number: normalizeText(body.passport_number),
      passport_expiry: normalizeDate(body.passport_expiry),
      shirt_size: normalizeText(body.shirt_size),
      shorts_size: normalizeText(body.shorts_size),
      bio: normalizeText(body.bio),
      role: 'member',
      status: 'pending',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error: profileError } =
      await updateProfileWithSchemaFallback(createdUserId, profileUpdate);

    if (profileError || !updatedProfile) {
      await supabaseAdmin.auth.admin
        .deleteUser(createdUserId)
        .catch(() => null);
      createdUserId = null;
      return errorResponse(
        ApiErrors.INTERNAL_ERROR,
        profileError?.message || 'Failed to create profile'
      );
    }

    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'super_admin'])
        .eq('status', 'active');

      const adminIds = (admins || []).map((admin) => admin.id);
      if (adminIds.length > 0) {
        await createNotifications(
          adminIds,
          'New member signup request',
          `${fullName || normalizedEmail} requested portal access.`,
          'system',
          '/admin/notifications'
        );
      }
    } catch (notifyError) {
      console.error('Failed to notify admins (non-fatal):', notifyError);
    }

    return successResponse(
      {
        id: updatedProfile.id,
        status: updatedProfile.status,
        message: 'Signup request submitted. An admin must approve your account before you can access the portal.',
      },
      201
    );
  } catch (error: unknown) {
    if (createdUserId) {
      await supabaseAdmin.auth.admin
        .deleteUser(createdUserId)
        .catch(() => null);
    }
    return errorResponse(
      ApiErrors.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unexpected error'
    );
  }
}
