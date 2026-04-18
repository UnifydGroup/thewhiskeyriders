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
import { dispatchNewsPublicationEmails } from '@/lib/news/email';

const NEWS_ADMIN_ROLES = ['trip_admin', 'admin', 'super_admin'] as const;
const NEWS_STATUSES = ['draft', 'published', 'archived'] as const;
type NewsStatus = (typeof NEWS_STATUSES)[number];

function isAdminRole(role: string): boolean {
  return NEWS_ADMIN_ROLES.includes(role as (typeof NEWS_ADMIN_ROLES)[number]);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function parseRequestedStatus(value: unknown): NewsStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!NEWS_STATUSES.includes(normalized as NewsStatus)) {
    throw new Error('status must be one of: draft, published, archived');
  }
  return normalized as NewsStatus;
}

function stateFromStatus(status: NewsStatus, fallbackPublishedAt?: string | null) {
  if (status === 'draft') {
    return {
      is_published: false,
      is_archived: false,
      published_at: null as string | null,
      archived_at: null as string | null,
    };
  }

  if (status === 'published') {
    return {
      is_published: true,
      is_archived: false,
      published_at: fallbackPublishedAt || new Date().toISOString(),
      archived_at: null as string | null,
    };
  }

  return {
    is_published: false,
    is_archived: true,
    published_at: fallbackPublishedAt || null,
    archived_at: new Date().toISOString(),
  };
}

function resolvePortalBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return vercelUrl.startsWith('http://') || vercelUrl.startsWith('https://')
      ? vercelUrl
      : `https://${vercelUrl}`;
  }

  return request.nextUrl.origin;
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
      query = query.eq('is_archived', false);
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
      .select('id, title, is_published, is_archived, published_at, archived_at')
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

    const nextIsGlobal =
      typeof body.is_global === 'boolean'
        ? body.is_global
        : null;
    const nextTagAllMembers =
      typeof body.tag_all_members === 'boolean'
        ? body.tag_all_members
        : null;
    const nextSendEmailNotification =
      typeof body.send_email_notification === 'boolean'
        ? body.send_email_notification
        : null;

    if (nextIsGlobal !== null) {
      updatePayload.is_global = nextIsGlobal;
    }

    if (nextTagAllMembers !== null) {
      updatePayload.tag_all_members = nextTagAllMembers;
    }

    if (nextSendEmailNotification !== null) {
      updatePayload.send_email_notification = nextSendEmailNotification;
    }

    let parsedStatus: NewsStatus | null = null;
    try {
      parsedStatus = parseRequestedStatus(body.status);
    } catch (statusError: unknown) {
      return errorResponse(
        ApiErrors.BAD_REQUEST,
        statusError instanceof Error ? statusError.message : 'Invalid status'
      );
    }
    if (parsedStatus) {
      const statusState = stateFromStatus(parsedStatus, existing.published_at);
      updatePayload.is_published = statusState.is_published;
      updatePayload.is_archived = statusState.is_archived;
      updatePayload.published_at = statusState.published_at;
      updatePayload.archived_at = statusState.archived_at;
    } else if (typeof body.is_published === 'boolean') {
      const statusState = body.is_published
        ? stateFromStatus('published', existing.published_at)
        : stateFromStatus('draft');
      updatePayload.is_published = statusState.is_published;
      updatePayload.is_archived = statusState.is_archived;
      updatePayload.published_at = statusState.published_at;
      updatePayload.archived_at = statusState.archived_at;
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

    const requestedTripIds = hasTripIds ? normalizeIdArray(body.trip_ids) : null;
    const requestedMemberIds = hasMemberIds ? normalizeIdArray(body.member_ids) : null;

    const shouldClearTripTags = nextIsGlobal === true;
    const shouldClearMemberTags = nextTagAllMembers === true;

    const tripIds = shouldClearTripTags
      ? []
      : requestedTripIds;
    const memberIds = shouldClearMemberTags
      ? []
      : requestedMemberIds;

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

    const transitionedToPublished =
      existing.is_published === false &&
      newsItem.is_published === true &&
      newsItem.is_archived === false;

    if (transitionedToPublished) {
      try {
        const summary = await dispatchNewsPublicationEmails({
          newsItem,
          baseUrl: resolvePortalBaseUrl(request),
        });

        console.info('[news-email] publish transition dispatch complete', {
          news_post_id: newsId,
          attempted: summary.attempted,
          sent: summary.sent,
          failed: summary.failed,
          skipped_reason: summary.skippedReason || null,
          enabled: summary.enabled,
        });
      } catch (emailError: unknown) {
        console.error('[news-email] publish transition dispatch failed', {
          news_post_id: newsId,
          error: emailError instanceof Error ? emailError.message : emailError,
        });
      }
    }

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
