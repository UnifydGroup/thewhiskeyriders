import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
  isUserTripMember,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string }>;

// GET /api/trips/[id]/itinerary
// Admins see all segments; members see member_visible only
export async function GET(request: NextRequest, props: { params: Params }) {
  try {
    const { id: tripId } = await props.params;
    const { authenticated, role } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

    const isAdmin = ['admin', 'super_admin', 'trip_admin'].includes(role ?? '');

    if (!isAdmin) {
      const isMember = await isUserTripMember(request, tripId);
      if (!isMember) return errorResponse(ApiErrors.FORBIDDEN);
    }

    let query = supabase
      .from('trip_itinerary_segments')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true })
      .order('sort_order', { ascending: true });

    if (!isAdmin) {
      query = query.eq('member_visible', true);
    }

    const { data, error } = await query;
    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);

    return successResponse({ segments: data ?? [] });
  } catch (err: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, err.message);
  }
}

// POST /api/trips/[id]/itinerary
export async function POST(request: NextRequest, props: { params: Params }) {
  try {
    const { id: tripId } = await props.params;
    const { authenticated } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

    const body = await getJsonBody(request);
    if (!body) return errorResponse(ApiErrors.BAD_REQUEST, 'Missing request body');

    const {
      date,
      sort_order = 0,
      category,
      title,
      location_from,
      location_to,
      start_time,
      end_time,
      reference_number,
      status = 'pending',
      contacts = [],
      member_description,
      internal_notes,
      member_visible = false,
    } = body;

    if (!date) return errorResponse(ApiErrors.BAD_REQUEST, 'date is required');
    if (!category) return errorResponse(ApiErrors.BAD_REQUEST, 'category is required');
    if (!title) return errorResponse(ApiErrors.BAD_REQUEST, 'title is required');

    const { data, error } = await supabase
      .from('trip_itinerary_segments')
      .insert({
        trip_id: tripId,
        date,
        sort_order,
        category,
        title,
        location_from: location_from || null,
        location_to: location_to || null,
        start_time: start_time || null,
        end_time: end_time || null,
        reference_number: reference_number || null,
        status,
        contacts,
        member_description: member_description || null,
        internal_notes: internal_notes || null,
        member_visible,
      })
      .select()
      .single();

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);

    return successResponse({ segment: data }, 201);
  } catch (err: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, err.message);
  }
}
