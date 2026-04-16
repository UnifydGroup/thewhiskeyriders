import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  logActivity,
  getIpAddress,
  supabase,
  isUserTripAdmin,
  getCurrentUser,
  getUserProfile,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string }>;

// GET /api/trips/[id]/members - List trip members
export async function GET(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { data: members, error } = await supabase
      .from('trip_members')
      .select(
        `
        *,
        profiles:user_id (id, email, nickname, full_name, avatar_url, role)
      `
      )
      .eq('trip_id', tripId)
      .order('joined_at', { ascending: false });

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    return successResponse({ members: members || [] });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// POST /api/trips/[id]/members - Add member to trip (admin or trip admin)
export async function POST(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    // Check if user is trip admin or global admin
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
    const isTripAdmin = await isUserTripAdmin(user.id, tripId);

    if (!isAdmin && !isTripAdmin) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await getJsonBody(request);

    if (!body.user_id) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'user_id is required');
    }

    const trip_role = body.trip_role || 'member';

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', tripId)
      .eq('user_id', body.user_id)
      .single();

    if (existingMember) {
      return errorResponse(ApiErrors.CONFLICT, 'User is already a member of this trip');
    }

    const { data: member, error } = await supabase
      .from('trip_members')
      .insert({
        trip_id: tripId,
        user_id: body.user_id,
        trip_role,
      })
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'create',
      'trip_member',
      member.id,
      `Added ${body.user_id} to trip`,
      { trip_role },
      getIpAddress(request)
    );

    return successResponse(member, 201);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
