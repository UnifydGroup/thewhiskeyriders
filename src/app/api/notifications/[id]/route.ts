import { NextRequest } from 'next/server';
import {
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  supabase,
} from '@/lib/api/helpers';

// PATCH /api/notifications/[id] — mark a single notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated || !profile) return errorResponse(ApiErrors.UNAUTHORIZED);

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', profile.id); // scope to own notifications

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ marked_read: true });
}

// DELETE /api/notifications/[id] — dismiss (delete) a notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated || !profile) return errorResponse(ApiErrors.UNAUTHORIZED);

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', profile.id);

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ deleted: true });
}
