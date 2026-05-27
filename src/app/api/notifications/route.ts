import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  supabase,
} from '@/lib/api/helpers';

// GET /api/notifications — returns notifications for the current admin user
export async function GET(request: NextRequest) {
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
  const unreadOnly = url.searchParams.get('unread') === 'true';

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);

  const unreadCount = (data || []).filter((n: { is_read: boolean }) => !n.is_read).length;

  return successResponse({ notifications: data || [], unread_count: unreadCount });
}

// PATCH /api/notifications — mark all as read for current user
export async function PATCH(request: NextRequest) {
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', profile.id)
    .eq('is_read', false);

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ marked_read: true });
}
