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
  getUserProfile,
  getCurrentUser,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string }>;

// GET /api/trips/[id] - Get trip details
export async function GET(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    console.log(`[API] GET /api/trips/${tripId}`);

    const { authenticated, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      console.log(`[API] Not authenticated for trip ${tripId}`);
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    console.log(`[API] Authenticated, fetching trip ${tripId}`);

    const { data: trip, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (error) {
      console.error(`[API] Supabase error fetching trip ${tripId}:`, error);
      return errorResponse(ApiErrors.NOT_FOUND, `Trip not found: ${error.message}`);
    }

    if (!trip) {
      console.error(`[API] Trip not found in database: ${tripId}`);
      return errorResponse(ApiErrors.NOT_FOUND, 'Trip not found');
    }

    console.log(`[API] Found trip ${tripId}, fetching members`);


    // Don't show cancelled trips to regular members
    if (trip.status === 'cancelled' && profile?.role === 'member') {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    // Get trip members
    const { data: members } = await supabase
      .from('trip_members')
      .select(
        `
        *,
        profiles:user_id (id, email, full_name, avatar_url)
      `
      )
      .eq('trip_id', tripId);

    return successResponse({
      ...trip,
      members: members || [],
    });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// PUT /api/trips/[id] - Update trip (admin only)
export async function PUT(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated, authorized, user } = await verifyRole(request, [
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await getJsonBody(request);

    // Verify trip exists
    const { data: existingTrip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (!existingTrip) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Trip not found');
    }

    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.destination !== undefined) updateData.destination = body.destination;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.start_date !== undefined) updateData.start_date = body.start_date;
    if (body.end_date !== undefined) updateData.end_date = body.end_date;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.cover_image_url !== undefined) updateData.cover_image_url = body.cover_image_url;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.max_members !== undefined) updateData.max_members = body.max_members;

    updateData.updated_at = new Date().toISOString();

    const { data: trip, error } = await supabase
      .from('trips')
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user!.id,
      'update',
      'trip',
      trip.id,
      trip.name,
      updateData,
      getIpAddress(request)
    );

    return successResponse(trip);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// DELETE /api/trips/[id] - Delete trip (super_admin only)
export async function DELETE(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile || profile.role !== 'super_admin') {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();

    if (!trip) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Trip not found');
    }

    // Delete all related data first (cascade)
    await supabase.from('trip_members').delete().eq('trip_id', tripId);
    await supabase.from('trip_updates').delete().eq('trip_id', tripId);
    await supabase.from('trip_documents').delete().eq('trip_id', tripId);
    await supabase.from('payments').delete().eq('trip_id', tripId);
    await supabase.from('awards').delete().eq('trip_id', tripId);
    await supabase.from('trip_key_dates').delete().eq('trip_id', tripId);

    const { error } = await supabase.from('trips').delete().eq('id', tripId);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(user.id, 'delete', 'trip', tripId, trip.name, null, getIpAddress(request));

    return successResponse({ message: 'Trip deleted successfully' });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
