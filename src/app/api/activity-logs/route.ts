import { NextRequest } from 'next/server';
import {
  verifyAuth,
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  getPagination,
  getIpAddress,
  logActivity,
  supabase,
} from '@/lib/api/helpers';
import type { ActivityAction } from '@/lib/types/database';

const ALLOWED_ACTIONS: Set<ActivityAction> = new Set([
  'create',
  'update',
  'delete',
  'view',
  'upload',
  'download',
  'login',
  'logout',
  'vote',
  'comment',
  'like',
  'bulkupload',
  'interact',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// GET /api/activity-logs - Read audit events (admin + trip admin)
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }
    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { limit, offset } = getPagination(request, 200, 1000);
    const action = request.nextUrl.searchParams.get('action');
    const search = request.nextUrl.searchParams.get('search');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    let query = supabase.from('activity_logs').select('*', { count: 'exact' });

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }
    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      query = query.lte('created_at', to);
    }
    if (search) {
      query = query.or(
        `entity_type.ilike.%${search}%,entity_name.ilike.%${search}%,entity_id.ilike.%${search}%,ip_address.ilike.%${search}%`
      );
    }

    const {
      data: activityLogs,
      count,
      error,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    const userIds = Array.from(new Set((activityLogs || []).map((log) => log.user_id)));
    const { data: users } =
      userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('id', userIds)
        : { data: [] };

    const userById = new Map((users || []).map((profile) => [profile.id, profile]));
    const activities = (activityLogs || []).map((log) => ({
      ...log,
      user: userById.get(log.user_id) || null,
    }));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ count: todayCount }, { count: weekCount }, { count: monthCount }] = await Promise.all([
      supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekStart),
      supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart),
    ]);

    return successResponse({
      activities,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
      stats: {
        total: count || 0,
        today: todayCount || 0,
        thisWeek: weekCount || 0,
        thisMonth: monthCount || 0,
      },
    });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error instanceof Error ? error.message : undefined);
  }
}

interface CreateActivityBody {
  action?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  entityName?: unknown;
  changes?: unknown;
}

// POST /api/activity-logs - Track a user activity event (authenticated users)
export async function POST(request: NextRequest) {
  try {
    const { authenticated, user } = await verifyAuth(request);
    if (!authenticated || !user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const body = (await getJsonBody(request)) as CreateActivityBody;
    const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
    const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : '';
    const entityId =
      typeof body.entityId === 'string' && body.entityId.trim().length > 0
        ? body.entityId.trim()
        : 'unknown';
    const entityName = typeof body.entityName === 'string' ? body.entityName.trim() : null;
    const changes = asRecord(body.changes);

    if (!ALLOWED_ACTIONS.has(action as ActivityAction)) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Invalid activity action');
    }
    if (!entityType) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'entityType is required');
    }

    await logActivity(
      user.id,
      action as ActivityAction,
      entityType,
      entityId,
      entityName,
      changes,
      getIpAddress(request)
    );

    return successResponse({ logged: true }, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error instanceof Error ? error.message : undefined);
  }
}
