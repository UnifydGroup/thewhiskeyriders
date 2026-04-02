import { NextRequest } from 'next/server';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  getJsonBody,
  logActivity,
  successResponse,
  supabase,
  verifyRole,
} from '@/lib/api/helpers';
import {
  NEWS_POST_SELECT,
  hydrateNewsItems,
  normalizeIdArray,
  type RawNewsPostRow,
} from '@/lib/news/server';

const NEWS_ADMIN_ROLES = ['trip_admin', 'admin', 'super_admin'] as const;

function isAdminRole(role: string): boolean {
  return NEWS_ADMIN_ROLES.includes(role as (typeof NEWS_ADMIN_ROLES)[number]);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

// GET /api/news/[id] - Get a single news item
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const newsId = params.id;

    const { authenticated, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated || !profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const includeUnpublished = isAdminRole(profile.role);

    let query = supabase
      .from('news_posts')
      .select(NEWS_POST_SELECT)
      .eq('id', newsId);

    if (!includeUnpublished) {
      query = query.eq('is_published', true);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return errorResponse(ApiErrors.NOT_FOUND, 'News item not found');
    }

    const [newsItem] = await hydrateNewsItems([data as RawNewsPostRow]);
    return successResponse(newsItem);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// PUT /api/news/[id] - Update a news item and its tags
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const newsId = params.id;

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

    const { data: existing, error: existingError } = await supabase
      .from('news_posts')
      .select('id, title, is_published, published_at')
      .eq('id', newsId)
      .single();

    if (existingError || !existing) {
      return errorResponse(ApiErrors.NOT_FOUND, 'News item not found');
    }

    const body = await getJsonBody(request);

    const hasTripIds = Object.prototype.hasOwnProperty.call(body, 'trip_ids');
    const hasMemberIds = Object.prototype.hasOwnProperty.call(body, 'member_ids');

    const updatePayload: Record<string, unknown> = {};

    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (!title) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'title cannot be empty');
      }
      updatePayload.title = title;
    }

    if (typeof body.content === 'string') {
      const content = body.content.trim();
      if (!content) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'content cannot be empty');
      }
      updatePayload.content = content;
    }

    if (typeof body.is_published === 'boolean') {
      updatePayload.is_published = body.is_published;
      updatePayload.published_at = body.is_published
        ? existing.published_at || new Date().toISOString()
        : null;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('news_posts')
        .update(updatePayload)
        .eq('id', newsId);

      if (updateError) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, updateError.message);
      }
    }

    const tripIds = hasTripIds ? normalizeIdArray(body.trip_ids) : null;
    const memberIds = hasMemberIds ? normalizeIdArray(body.member_ids) : null;

    if (tripIds) {
      const { error: deleteTripTagsError } = await supabase
        .from('news_post_trips')
        .delete()
        .eq('news_post_id', newsId);

      if (deleteTripTagsError) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, deleteTripTagsError.message);
      }

      if (tripIds.length > 0) {
        const { error: insertTripTagsError } = await supabase.from('news_post_trips').insert(
          tripIds.map((tripId) => ({
            news_post_id: newsId,
            trip_id: tripId,
          }))
        );

        if (insertTripTagsError) {
          return errorResponse(ApiErrors.INTERNAL_ERROR, insertTripTagsError.message);
        }
      }
    }

    if (memberIds) {
      const { error: deleteMemberTagsError } = await supabase
        .from('news_post_members')
        .delete()
        .eq('news_post_id', newsId);

      if (deleteMemberTagsError) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, deleteMemberTagsError.message);
      }

      if (memberIds.length > 0) {
        const { error: insertMemberTagsError } = await supabase.from('news_post_members').insert(
          memberIds.map((memberId) => ({
            news_post_id: newsId,
            member_id: memberId,
          }))
        );

        if (insertMemberTagsError) {
          return errorResponse(ApiErrors.INTERNAL_ERROR, insertMemberTagsError.message);
        }
      }
    }

    const { data: updated, error: updatedError } = await supabase
      .from('news_posts')
      .select(NEWS_POST_SELECT)
      .eq('id', newsId)
      .single();

    if (updatedError || !updated) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, updatedError?.message || 'Failed to load updated news item');
    }

    const [newsItem] = await hydrateNewsItems([updated as RawNewsPostRow]);

    await logActivity(
      user.id,
      'update',
      'news_post',
      newsId,
      (newsItem?.title || existing.title) ?? null,
      {
        updated_fields: Object.keys(updatePayload),
        tags_updated: hasTripIds || hasMemberIds,
      },
      getIpAddress(request)
    );

    return successResponse(newsItem);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// DELETE /api/news/[id] - Delete a news item
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const newsId = params.id;

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

    const { data: existing } = await supabase
      .from('news_posts')
      .select('id, title')
      .eq('id', newsId)
      .single();

    const { error } = await supabase
      .from('news_posts')
      .delete()
      .eq('id', newsId);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    await logActivity(
      user.id,
      'delete',
      'news_post',
      newsId,
      existing?.title || null,
      null,
      getIpAddress(request)
    );

    return successResponse({ id: newsId });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
