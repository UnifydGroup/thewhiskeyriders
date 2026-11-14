import { NextRequest } from 'next/server';
import {
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  supabase,
} from '@/lib/api/helpers';

// GET /api/notifications — the current member's notifications, newest first.
// Query: limit (max 100), unread=true, types=award,tag,... , before=<ISO timestamp> for paging.
export async function GET(request: NextRequest) {
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated || !profile) return errorResponse(ApiErrors.UNAUTHORIZED);

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const types = (url.searchParams.get('types') || '')
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
  const before = url.searchParams.get('before');

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('is_read', false);
  if (types.length > 0) query = query.in('type', types);
  if (before) query = query.lt('created_at', before);

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    query,
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false),
  ]);

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  if (countError) return errorResponse(ApiErrors.INTERNAL_ERROR, countError.message);

  return successResponse({
    notifications: data || [],
    unread_count: count ?? 0,
    has_more: (data || []).length === limit,
  });
}

// PATCH /api/notifications — mark all as read for the current member
export async function PATCH(request: NextRequest) {
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated || !profile) return errorResponse(ApiErrors.UNAUTHORIZED);

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', profile.id)
    .eq('is_read', false);

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ marked_read: true });
}
