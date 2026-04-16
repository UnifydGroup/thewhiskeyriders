import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  getPagination,
  logActivity,
  getIpAddress,
  supabase,
  isUserTripAdmin,
  getCurrentUser,
  getUserProfile,
  createNotifications,
} from '@/lib/api/helpers';

// GET /api/trips/[id]/updates - List trip updates/announcements
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    const { limit, offset } = getPagination(request);

    const { data: updates, count, error } = await supabase
      .from('trip_updates')
      .select(
        `
        *,
        author:author_id (id, nickname, full_name, avatar_url)
      `,
        { count: 'exact' }
      )
      .eq('trip_id', tripId)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    return successResponse({
      updates: updates || [],
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// POST /api/trips/[id]/updates - Create trip update (trip admin or higher)
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    if (!body.title || !body.content) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'title and content are required');
    }

    const updateData = {
      trip_id: tripId,
      title: body.title,
      content: body.content,
      author_id: user.id,
      published_at: new Date().toISOString(),
    };

    const { data: update, error } = await supabase
      .from('trip_updates')
      .insert(updateData)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Get all trip members to notify
    const { data: members } = await supabase
      .from('trip_members')
      .select('user_id')
      .eq('trip_id', tripId);

    if (members && members.length > 0) {
      const memberIds = members.map((m) => m.user_id);
      await createNotifications(
        memberIds,
        `New Update: ${body.title}`,
        body.content.substring(0, 100),
        'trip_update',
        `/trips/${tripId}`
      );
    }

    // Log activity
    await logActivity(
      user.id,
      'create',
      'trip_update',
      update.id,
      body.title,
      null,
      getIpAddress(request)
    );

    return successResponse(update, 201);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
