import { NextRequest } from 'next/server';
import {
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  logActivity,
  getIpAddress,
  supabase,
  getCurrentUser,
  getUserProfile,
  isValidEmail,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string }>;

function normalizeTextValue(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function extractMissingProfilesColumn(errorMessage: string | undefined): string | null {
  if (!errorMessage) return null;
  const match = errorMessage.match(/Could not find the '([^']+)' column of 'profiles' in the schema cache/i);
  return match?.[1] ?? null;
}

async function updateProfileWithSchemaFallback(memberId: string, initialUpdateData: Record<string, unknown>) {
  const updateData = { ...initialUpdateData };
  const ignoredColumns: string[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', memberId)
      .select()
      .single();

    if (!error) {
      return { data, error: null, ignoredColumns };
    }

    const missingColumn = extractMissingProfilesColumn(error.message);
    if (!missingColumn || !(missingColumn in updateData)) {
      return { data: null, error, ignoredColumns };
    }

    delete updateData[missingColumn];
    ignoredColumns.push(missingColumn);
  }
}

// GET /api/members/[id] - Get member profile
export async function GET(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const memberId = params.id;

    if (!memberId) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Member ID is required');
    }

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { data: member, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single();

    if (error) {
      console.error('Supabase query error:', error);
      return errorResponse(ApiErrors.NOT_FOUND, 'Member not found');
    }

    if (!member) {
      console.error('No member found for id:', memberId);
      return errorResponse(ApiErrors.NOT_FOUND, 'Member not found');
    }

    // Get member's trips
    const { data: trips } = await supabase
      .from('trip_members')
      .select(
        `
        trip_id,
        trip_role,
        trips:trip_id (id, name, slug, start_date, end_date)
      `
      )
      .eq('user_id', memberId);

    // Members see limited info unless viewing their own profile or admin
    if (profile.id !== memberId && profile.role === 'member') {
      return successResponse({
        id: member.id,
        email: member.email,
        full_name: member.full_name,
        avatar_url: member.avatar_url,
        bio: member.bio,
        trip_count: trips?.length || 0,
      });
    }

    return successResponse({
      ...member,
      trips: trips || [],
    });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// PUT /api/members/[id] - Update own profile
export async function PUT(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const memberId = params.id;

    if (!memberId) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Member ID is required');
    }

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }
    const isAdminRequester = profile.role === 'admin' || profile.role === 'super_admin';

    // Users can only update their own profile unless they're admin
    if (user.id !== memberId && !isAdminRequester) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    let body: Record<string, unknown>;
    try {
      body = await getJsonBody(request);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid request body';
      return errorResponse(ApiErrors.BAD_REQUEST, errorMsg);
    }

    const updateData: Record<string, unknown> = {};

    if (
      (body.email !== undefined || body.role !== undefined || body.status !== undefined) &&
      !isAdminRequester
    ) {
      return errorResponse(
        ApiErrors.FORBIDDEN,
        'Only admins can update email, role, or status'
      );
    }

    if (body.email !== undefined) {
      const normalizedEmail = normalizeTextValue(body.email);
      if (typeof normalizedEmail !== 'string' || !isValidEmail(normalizedEmail)) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'Invalid email');
      }
      updateData.email = normalizedEmail;
    }

    if (body.role !== undefined) {
      const validRoles = ['member', 'trip_admin', 'admin', 'super_admin'];
      const normalizedRole = normalizeTextValue(body.role);
      if (typeof normalizedRole !== 'string' || !validRoles.includes(normalizedRole)) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'Invalid role');
      }
      updateData.role = normalizedRole;
    }

    if (body.status !== undefined) {
      const validStatuses = ['active', 'pending', 'inactive', 'archived'];
      const normalizedStatus = normalizeTextValue(body.status);
      if (typeof normalizedStatus !== 'string' || !validStatuses.includes(normalizedStatus)) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'Invalid status');
      }
      updateData.status = normalizedStatus;
    }

    if (body.first_name !== undefined) updateData.first_name = normalizeTextValue(body.first_name);
    if (body.middle_name !== undefined) updateData.middle_name = normalizeTextValue(body.middle_name);
    if (body.surname !== undefined) updateData.surname = normalizeTextValue(body.surname);
    if (body.full_name !== undefined) updateData.full_name = normalizeTextValue(body.full_name);

    if (body.avatar_url !== undefined) updateData.avatar_url = normalizeTextValue(body.avatar_url);
    if (body.bio !== undefined) updateData.bio = normalizeTextValue(body.bio);
    if (body.phone_country_code !== undefined) {
      updateData.phone_country_code = normalizeTextValue(body.phone_country_code);
    }
    if (body.phone !== undefined) updateData.phone = normalizeTextValue(body.phone);
    if (body.emergency_contact !== undefined) {
      updateData.emergency_contact = normalizeTextValue(body.emergency_contact);
    }
    if (body.emergency_contact_number !== undefined) {
      updateData.emergency_contact_number = normalizeTextValue(body.emergency_contact_number);
    }
    if (body.date_of_birth !== undefined) updateData.date_of_birth = normalizeTextValue(body.date_of_birth) || null;
    if (body.address_line1 !== undefined) updateData.address_line1 = normalizeTextValue(body.address_line1);
    if (body.address_line2 !== undefined) updateData.address_line2 = normalizeTextValue(body.address_line2);
    if (body.address_city !== undefined) updateData.address_city = normalizeTextValue(body.address_city);
    if (body.address_state !== undefined) updateData.address_state = normalizeTextValue(body.address_state);
    if (body.address_postcode !== undefined) {
      updateData.address_postcode = normalizeTextValue(body.address_postcode);
    }
    if (body.address_country !== undefined) updateData.address_country = normalizeTextValue(body.address_country);
    if (body.address !== undefined) updateData.address = normalizeTextValue(body.address);

    if (body.passport_number !== undefined) {
      updateData.passport_number = normalizeTextValue(body.passport_number);
    }
    if (body.passport_expiry !== undefined) updateData.passport_expiry = normalizeTextValue(body.passport_expiry) || null;
    if (body.shirt_size !== undefined) updateData.shirt_size = normalizeTextValue(body.shirt_size);
    if (body.shorts_size !== undefined) updateData.shorts_size = normalizeTextValue(body.shorts_size);
    if (body.nickname !== undefined) updateData.nickname = normalizeTextValue(body.nickname);

    const hasNamePartsUpdate =
      body.first_name !== undefined || body.middle_name !== undefined || body.surname !== undefined;
    if (hasNamePartsUpdate) {
      const fullName = [
        body.first_name !== undefined ? updateData.first_name : profile.first_name,
        body.middle_name !== undefined ? updateData.middle_name : profile.middle_name,
        body.surname !== undefined ? updateData.surname : profile.surname,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      updateData.full_name = fullName || null;
    }

    const hasStructuredAddressUpdate =
      body.address_line1 !== undefined ||
      body.address_line2 !== undefined ||
      body.address_city !== undefined ||
      body.address_state !== undefined ||
      body.address_postcode !== undefined ||
      body.address_country !== undefined;

    if (hasStructuredAddressUpdate) {
      const fullAddress = [
        body.address_line1 !== undefined ? updateData.address_line1 : profile.address_line1,
        body.address_line2 !== undefined ? updateData.address_line2 : profile.address_line2,
        body.address_city !== undefined ? updateData.address_city : profile.address_city,
        body.address_state !== undefined ? updateData.address_state : profile.address_state,
        body.address_postcode !== undefined ? updateData.address_postcode : profile.address_postcode,
        body.address_country !== undefined ? updateData.address_country : profile.address_country,
      ]
        .filter(Boolean)
        .join(', ')
        .trim();
      updateData.address = fullAddress || null;
    }

    updateData.updated_at = new Date().toISOString();

    const {
      data: updatedMember,
      error,
      ignoredColumns,
    } = await updateProfileWithSchemaFallback(memberId, updateData);

    if (error) {
      console.error('Supabase update error:', error);
      return errorResponse(ApiErrors.INTERNAL_ERROR, `Failed to update profile: ${error.message}`);
    }

    if (!updatedMember) {
      console.error('No member returned after update for id:', memberId);
      return errorResponse(ApiErrors.NOT_FOUND, 'Profile not found');
    }

    // Log activity
    try {
      await logActivity(
        user.id,
        'update',
        'member',
        memberId,
        updatedMember.full_name,
        Object.keys(updateData),
        getIpAddress(request)
      );
    } catch (logError) {
      console.error('Error logging activity:', logError);
      // Don't fail the request if logging fails
    }

    if (ignoredColumns.length > 0) {
      console.warn('Ignored missing profile columns during update:', ignoredColumns);
    }

    return successResponse({
      ...updatedMember,
      ignored_fields: ignoredColumns,
    });
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    console.error('PUT /api/members/[id] error:', errorMsg, error);
    return errorResponse(ApiErrors.INTERNAL_ERROR, errorMsg);
  }
}
