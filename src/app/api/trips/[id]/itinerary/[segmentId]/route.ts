import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string; segmentId: string }>;

// PUT /api/trips/[id]/itinerary/[segmentId]
export async function PUT(request: NextRequest, props: { params: Params }) {
  try {
    const { id: tripId, segmentId } = await props.params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    if (!body) return errorResponse(ApiErrors.BAD_REQUEST, 'Missing request body');

    const {
      date,
      sort_order,
      category,
      title,
      location_from,
      location_to,
      start_time,
      end_time,
      reference_number,
      status,
      contacts,
      member_description,
      internal_notes,
      member_visible,
    } = body;

    const updatePayload: Record<string, any> = {};
    if (date !== undefined) updatePayload.date = date;
    if (sort_order !== undefined) updatePayload.sort_order = sort_order;
    if (category !== undefined) updatePayload.category = category;
    if (title !== undefined) updatePayload.title = title;
    if (location_from !== undefined) updatePayload.location_from = location_from || null;
    if (location_to !== undefined) updatePayload.location_to = location_to || null;
    if (start_time !== undefined) updatePayload.start_time = start_time || null;
    if (end_time !== undefined) updatePayload.end_time = end_time || null;
    if (reference_number !== undefined) updatePayload.reference_number = reference_number || null;
    if (status !== undefined) updatePayload.status = status;
    if (contacts !== undefined) updatePayload.contacts = contacts;
    if (member_description !== undefined) updatePayload.member_description = member_description || null;
    if (internal_notes !== undefined) updatePayload.internal_notes = internal_notes || null;
    if (member_visible !== undefined) updatePayload.member_visible = member_visible;

    const { data, error } = await supabase
      .from('trip_itinerary_segments')
      .update(updatePayload)
      .eq('id', segmentId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    if (!data) return errorResponse(ApiErrors.NOT_FOUND, 'Segment not found');

    return successResponse({ segment: data });
  } catch (err: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, err.message);
  }
}

// DELETE /api/trips/[id]/itinerary/[segmentId]
export async function DELETE(request: NextRequest, props: { params: Params }) {
  try {
    const { id: tripId, segmentId } = await props.params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { error } = await supabase
      .from('trip_itinerary_segments')
      .delete()
      .eq('id', segmentId)
      .eq('trip_id', tripId);

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);

    return successResponse({ deleted: true });
  } catch (err: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, err.message);
  }
}
