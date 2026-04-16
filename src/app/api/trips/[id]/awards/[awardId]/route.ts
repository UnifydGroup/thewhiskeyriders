import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  logActivity,
  getIpAddress,
  supabase,
  getCurrentUser,
  getUserProfile,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string; awardId: string }>;

// PUT /api/trips/[id]/awards/[awardId] - Update award
export async function PUT(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const { id: tripId, awardId } = params;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    // Only admin or super_admin can update awards
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { data: award } = await supabase
      .from('awards')
      .select('*')
      .eq('id', awardId)
      .eq('trip_id', tripId)
      .single();

    if (!award) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Award not found');
    }

    const body = await getJsonBody(request);

    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.emoji !== undefined) updateData.emoji = body.emoji;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data: updated, error } = await supabase
      .from('awards')
      .update(updateData)
      .eq('id', awardId)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'update',
      'award',
      awardId,
      award.name,
      updateData,
      getIpAddress(request)
    );

    return successResponse(updated);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// DELETE /api/trips/[id]/awards/[awardId] - Delete award
export async function DELETE(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const { id: tripId, awardId } = params;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    // Only super_admin can delete awards
    if (profile.role !== 'super_admin') {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { data: award } = await supabase
      .from('awards')
      .select('*')
      .eq('id', awardId)
      .eq('trip_id', tripId)
      .single();

    if (!award) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Award not found');
    }

    // Delete votes first
    await supabase.from('votes').delete().eq('award_id', awardId);

    // Delete award
    const { error } = await supabase.from('awards').delete().eq('id', awardId);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'delete',
      'award',
      awardId,
      award.name,
      null,
      getIpAddress(request)
    );

    return successResponse({ message: 'Award deleted successfully' });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
