import { NextRequest } from 'next/server';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  getJsonBody,
  getPagination,
  logActivity,
  successResponse,
  supabase,
  verifyRole,
} from '@/lib/api/helpers';
import {
  NEWS_POST_SELECT,
  hydrateNewsItems,
  normalizeIdArray,
  resolveTaggedNewsIds,
  type RawNewsPostRow,
} from '@/lib/news/server';

const NEWS_ADMIN_ROLES = ['trip_admin', 'admin', 'super_admin'] as const;

function isTruthyParam(value: string | null): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

// GET /api/news - List news items with optional trip/member filters
export async function GET(request: NextRequest) {
  try {
    const { authenticated, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated || !profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { limit, offset } = getPagination(request);
    const tripId = request.nextUrl.searchParams.get('tripId')?.trim() || null;
    const memberId = request.nextUrl.searchParams.get('memberId')?.trim() || null;
    const includeUnpublishedRequested = isTruthyParam(request.nextUrl.searchParams.get('includeUnpublished'));
    const includeUnpublished =
      includeUnpublishedRequested && NEWS_ADMIN_ROLES.includes(profile.role as (typeof NEWS_ADMIN_ROLES)[number]);

    const allowedIds = await resolveTaggedNewsIds(tripId, memberId);
    if (allowedIds && allowedIds.length === 0) {
      return successResponse({
        news: [],
        pagination: { total: 0, limit, offset },
      });
    }

    let query = supabase
      .from('news_posts')
      .select(NEWS_POST_SELECT, { count: 'exact' });

    if (!includeUnpublished) {
      query = query.eq('is_published', true);
    }

    if (allowedIds) {
      query = query.in('id', allowedIds);
    }

    const { data, count, error } = await query
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    const news = await hydrateNewsItems((data || []) as RawNewsPostRow[]);

    return successResponse({
      news,
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// POST /api/news - Create news item with trip/member tags
export async function POST(request: NextRequest) {
  try {
    const { authenticated, authorized, user } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated || !user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await getJsonBody(request);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!title || !content) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'title and content are required');
    }

    const tripIds = normalizeIdArray(body.trip_ids);
    const memberIds = normalizeIdArray(body.member_ids);
    const isPublished = body.is_published !== false;

    const { data: created, error: createError } = await supabase
      .from('news_posts')
      .insert({
        title,
        content,
        author_id: user.id,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .select(NEWS_POST_SELECT)
      .single();

    if (createError || !created) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, createError?.message || 'Failed to create news item');
    }

    const [tripTagResult, memberTagResult] = await Promise.all([
      tripIds.length > 0
        ? supabase.from('news_post_trips').insert(
            tripIds.map((tripId) => ({
              news_post_id: created.id,
              trip_id: tripId,
            }))
          )
        : Promise.resolve({ error: null }),
      memberIds.length > 0
        ? supabase.from('news_post_members').insert(
            memberIds.map((memberId) => ({
              news_post_id: created.id,
              member_id: memberId,
            }))
          )
        : Promise.resolve({ error: null }),
    ]);

    if (tripTagResult.error || memberTagResult.error) {
      await supabase.from('news_posts').delete().eq('id', created.id);
      return errorResponse(
        ApiErrors.INTERNAL_ERROR,
        tripTagResult.error?.message || memberTagResult.error?.message || 'Failed to tag news item'
      );
    }

    const [newsItem] = await hydrateNewsItems([created as RawNewsPostRow]);

    await logActivity(
      user.id,
      'create',
      'news_post',
      created.id,
      created.title,
      {
        trip_tag_count: tripIds.length,
        member_tag_count: memberIds.length,
        is_published: isPublished,
      },
      getIpAddress(request)
    );

    return successResponse(newsItem, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
