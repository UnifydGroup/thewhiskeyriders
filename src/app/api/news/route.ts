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
import { dispatchNewsPublicationEmails } from '@/lib/news/email';

const NEWS_ADMIN_ROLES = ['trip_admin', 'admin', 'super_admin'] as const;
const NEWS_STATUSES = ['draft', 'published', 'archived'] as const;
const NEWS_PLACEMENTS = ['global', 'trip', 'rider'] as const;
type NewsStatus = (typeof NEWS_STATUSES)[number];
type NewsPlacement = (typeof NEWS_PLACEMENTS)[number];

function isTruthyParam(value: string | null): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function isAdminRole(role: string): boolean {
  return NEWS_ADMIN_ROLES.includes(role as (typeof NEWS_ADMIN_ROLES)[number]);
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

function parseRequestedPlacement(value: string | null): NewsPlacement | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!NEWS_PLACEMENTS.includes(normalized as NewsPlacement)) {
    throw new Error('placement must be one of: global, trip, rider');
  }
  return normalized as NewsPlacement;
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

async function getMemberTripIds(memberId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', memberId);

  if (error) {
    throw new Error(error.message);
  }

  const tripIds = new Set<string>();
  for (const row of data || []) {
    if (typeof row.trip_id === 'string' && row.trip_id.trim()) {
      tripIds.add(row.trip_id.trim());
    }
  }

  return Array.from(tripIds);
}

function isMemberTargeted(
  item: { tag_all_members: boolean; member_tags: Array<{ id: string }> },
  memberId: string | null
): boolean {
  if (item.tag_all_members) {
    return true;
  }

  if (item.member_tags.length === 0) {
    return true;
  }

  if (!memberId) {
    return false;
  }

  return item.member_tags.some((member) => member.id === memberId);
}

// GET /api/news - List news items with optional placement and trip/member filters
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
    let placement: NewsPlacement | null = null;
    try {
      placement = parseRequestedPlacement(request.nextUrl.searchParams.get('placement'));
    } catch (placementError: unknown) {
      return errorResponse(
        ApiErrors.BAD_REQUEST,
        placementError instanceof Error ? placementError.message : 'Invalid placement'
      );
    }
    const includeUnpublishedRequested = isTruthyParam(request.nextUrl.searchParams.get('includeUnpublished'));
    const includeUnpublished = includeUnpublishedRequested && isAdminRole(profile.role);
    const includeArchivedRequested = isTruthyParam(request.nextUrl.searchParams.get('includeArchived'));
    const includeArchived = includeArchivedRequested && isAdminRole(profile.role);

    if (memberId && !isAdminRole(profile.role) && memberId !== profile.id) {
      return errorResponse(ApiErrors.FORBIDDEN, 'Cannot query news for another member');
    }

    const effectiveMemberId = memberId || profile.id || null;

    if (placement === 'trip' && !tripId) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'tripId is required when placement=trip');
    }

    if ((placement === 'global' || placement === 'rider') && !effectiveMemberId) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'memberId is required for this placement');
    }

    if (placement === 'trip' && tripId && effectiveMemberId && !isAdminRole(profile.role)) {
      const memberTripIds = await getMemberTripIds(effectiveMemberId);
      if (!memberTripIds.includes(tripId)) {
        return successResponse({
          news: [],
          pagination: { total: 0, limit, offset },
        });
      }
    }

    if (placement) {
      let query = supabase
        .from('news_posts')
        .select(NEWS_POST_SELECT);

      if (!includeUnpublished) {
        query = query.eq('is_published', true);
      }

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      if (placement === 'trip' && tripId) {
        const tripTaggedIds = await resolveTaggedNewsIds(tripId, null);
        if (!tripTaggedIds || tripTaggedIds.length === 0) {
          return successResponse({
            news: [],
            pagination: { total: 0, limit, offset },
          });
        }
        query = query.in('id', tripTaggedIds);
      }

      if (placement === 'rider' && effectiveMemberId) {
        const memberTaggedIds = await resolveTaggedNewsIds(null, effectiveMemberId);
        if (!memberTaggedIds || memberTaggedIds.length === 0) {
          return successResponse({
            news: [],
            pagination: { total: 0, limit, offset },
          });
        }
        query = query.in('id', memberTaggedIds);
      }

      const endIndex = Math.min(Math.max(offset + limit, 200) - 1, 999);

      const { data, error } = await query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(0, endIndex);

      if (error) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
      }

      const hydrated = await hydrateNewsItems((data || []) as RawNewsPostRow[]);

      let filtered = hydrated;

      if (placement === 'global' && effectiveMemberId) {
        const memberTripIds = await getMemberTripIds(effectiveMemberId);
        const memberTripSet = new Set(memberTripIds);

        filtered = hydrated.filter((item) => {
          const hasTripTags = item.trip_tags.length > 0;
          const hasMemberTags = item.member_tags.length > 0;
          const isRiderOnly = hasMemberTags && !hasTripTags && !item.is_global;
          if (isRiderOnly) {
            return false;
          }

          const isGlobalItem = item.is_global;
          const isTripItemForMember =
            hasTripTags && item.trip_tags.some((trip) => memberTripSet.has(trip.id));

          if (!isGlobalItem && !isTripItemForMember) {
            return false;
          }

          return isMemberTargeted(item, effectiveMemberId);
        });
      }

      if (placement === 'trip' && tripId) {
        filtered = hydrated.filter((item) => {
          const taggedToTrip = item.trip_tags.some((trip) => trip.id === tripId);
          if (!taggedToTrip) {
            return false;
          }
          return isMemberTargeted(item, effectiveMemberId);
        });
      }

      if (placement === 'rider' && effectiveMemberId) {
        filtered = hydrated.filter((item) => {
          const hasTripTags = item.trip_tags.length > 0;
          const isTaggedMember = item.member_tags.some((member) => member.id === effectiveMemberId);
          return isTaggedMember && !hasTripTags && !item.is_global;
        });
      }

      const total = filtered.length;
      const paged = filtered.slice(offset, offset + limit);

      return successResponse({
        news: paged,
        pagination: { total, limit, offset },
      });
    }

    const allowedIds = await resolveTaggedNewsIds(tripId, memberId);

    let query = supabase
      .from('news_posts')
      .select(NEWS_POST_SELECT, { count: 'exact' });

    if (!includeUnpublished) {
      query = query.eq('is_published', true);
    }

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    if (tripId || memberId) {
      const orClauses: string[] = [];
      if (allowedIds && allowedIds.length > 0) {
        orClauses.push(`id.in.(${allowedIds.join(',')})`);
      }
      if (tripId) {
        orClauses.push('is_global.eq.true');
      }
      if (memberId) {
        orClauses.push('tag_all_members.eq.true');
      }

      if (orClauses.length === 0) {
        return successResponse({
          news: [],
          pagination: { total: 0, limit, offset },
        });
      }

      query = query.or(orClauses.join(','));
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

    const requestedTripIds = normalizeIdArray(body.trip_ids);
    const requestedMemberIds = normalizeIdArray(body.member_ids);
    const isGlobal = body.is_global === true;
    const tagAllMembers = body.tag_all_members === true;
    const tripIds = isGlobal ? [] : requestedTripIds;
    const memberIds = tagAllMembers ? [] : requestedMemberIds;

    let requestedStatus: NewsStatus;
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
      requestedStatus = parsedStatus;
    } else {
      requestedStatus = body.is_published === false ? 'draft' : 'published';
    }

    const state = stateFromStatus(requestedStatus);

    const { data: created, error: createError } = await supabase
      .from('news_posts')
      .insert({
        title,
        content,
        author_id: user.id,
        is_published: state.is_published,
        is_archived: state.is_archived,
        archived_at: state.archived_at,
        published_at: state.published_at,
        is_global: isGlobal,
        tag_all_members: tagAllMembers,
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
        status: requestedStatus,
        is_global: isGlobal,
        tag_all_members: tagAllMembers,
      },
      getIpAddress(request)
    );

    if (requestedStatus === 'published' && newsItem) {
      try {
        const summary = await dispatchNewsPublicationEmails({
          newsItem,
          baseUrl: resolvePortalBaseUrl(request),
        });

        console.info('[news-email] publish dispatch complete', {
          news_post_id: created.id,
          attempted: summary.attempted,
          sent: summary.sent,
          failed: summary.failed,
          skipped_reason: summary.skippedReason || null,
          enabled: summary.enabled,
        });
      } catch (emailError: unknown) {
        console.error('[news-email] publish dispatch failed', {
          news_post_id: created.id,
          error: emailError instanceof Error ? emailError.message : emailError,
        });
      }
    }

    return successResponse(newsItem, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
