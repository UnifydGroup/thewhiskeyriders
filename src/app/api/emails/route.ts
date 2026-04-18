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
import { normalizeIdArray } from '@/lib/news/server';
import type { UserRole } from '@/lib/types/database';

// New tables not yet in generated types — use untyped client until migration runs and types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const EMAIL_ADMIN_ROLES: UserRole[] = ['trip_admin', 'admin', 'super_admin'];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

const CAMPAIGN_SELECT = `
  id,
  subject,
  body,
  created_by,
  status,
  is_global,
  tag_all_members,
  sent_at,
  created_at,
  updated_at,
  creator:created_by (
    id,
    full_name,
    nickname
  )
`;

// GET /api/emails - List email campaigns
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, EMAIL_ADMIN_ROLES);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { limit, offset } = getPagination(request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || null;

    let query = db
      .from('email_campaigns')
      .select(CAMPAIGN_SELECT, { count: 'exact' });

    if (status && (status === 'draft' || status === 'sent')) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Hydrate trip and member tags for each campaign
    const campaignIds = (data || []).map((c: { id: string }) => c.id);
    const [tripTagsResult, memberTagsResult] = campaignIds.length > 0
      ? await Promise.all([
          db
            .from('email_campaign_trips')
            .select('email_campaign_id, trips:trip_id(id, name, slug)')
            .in('email_campaign_id', campaignIds),
          db
            .from('email_campaign_members')
            .select('email_campaign_id, profiles:member_id(id, full_name, nickname)')
            .in('email_campaign_id', campaignIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (tripTagsResult.error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, tripTagsResult.error.message);
    }
    if (memberTagsResult.error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, memberTagsResult.error.message);
    }

    const tripTagsByC = new Map<string, { id: string; name: string; slug: string }[]>();
    for (const row of tripTagsResult.data || []) {
      const r = row as { email_campaign_id: string; trips: { id: string; name: string; slug: string } | null };
      if (!r.trips) continue;
      const arr = tripTagsByC.get(r.email_campaign_id) || [];
      arr.push(r.trips);
      tripTagsByC.set(r.email_campaign_id, arr);
    }

    const memberTagsByC = new Map<string, { id: string; full_name: string | null; nickname: string | null }[]>();
    for (const row of memberTagsResult.data || []) {
      const r = row as { email_campaign_id: string; profiles: { id: string; full_name: string | null; nickname: string | null } | null };
      if (!r.profiles) continue;
      const arr = memberTagsByC.get(r.email_campaign_id) || [];
      arr.push(r.profiles);
      memberTagsByC.set(r.email_campaign_id, arr);
    }

    const campaigns = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      trip_tags: tripTagsByC.get(c.id as string) || [],
      member_tags: memberTagsByC.get(c.id as string) || [],
    }));

    return successResponse({
      campaigns,
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// POST /api/emails - Create a new email campaign
export async function POST(request: NextRequest) {
  try {
    const { authenticated, authorized, user } = await verifyRole(
      request,
      EMAIL_ADMIN_ROLES
    );

    if (!authenticated || !user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await getJsonBody(request);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const bodyContent = typeof body.body === 'string' ? body.body.trim() : '';

    if (!subject) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'subject is required');
    }

    if (!bodyContent) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'body is required');
    }

    const isGlobal = body.is_global === true;
    const tagAllMembers = body.tag_all_members === true;
    const requestedTripIds = normalizeIdArray(body.trip_ids);
    const requestedMemberIds = normalizeIdArray(body.member_ids);
    const tripIds = isGlobal ? [] : requestedTripIds;
    const memberIds = tagAllMembers ? [] : requestedMemberIds;

    const { data: created, error: createError } = await db
      .from('email_campaigns')
      .insert({
        subject,
        body: bodyContent,
        created_by: user.id,
        status: 'draft',
        is_global: isGlobal,
        tag_all_members: tagAllMembers,
      })
      .select('id, subject')
      .single();

    if (createError || !created) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, createError?.message || 'Failed to create campaign');
    }

    // Insert tags
    const [tripTagResult, memberTagResult] = await Promise.all([
      tripIds.length > 0
        ? db.from('email_campaign_trips').insert(
            tripIds.map((id) => ({ email_campaign_id: created.id, trip_id: id }))
          )
        : Promise.resolve({ error: null }),
      memberIds.length > 0
        ? db.from('email_campaign_members').insert(
            memberIds.map((id) => ({ email_campaign_id: created.id, member_id: id }))
          )
        : Promise.resolve({ error: null }),
    ]);

    if (tripTagResult.error || memberTagResult.error) {
      await db.from('email_campaigns').delete().eq('id', created.id);
      return errorResponse(
        ApiErrors.INTERNAL_ERROR,
        tripTagResult.error?.message || memberTagResult.error?.message || 'Failed to tag campaign'
      );
    }

    await logActivity(
      user.id,
      'create',
      'email_campaign',
      created.id,
      created.subject,
      { trip_tags: tripIds.length, member_tags: memberIds.length, is_global: isGlobal, tag_all_members: tagAllMembers },
      getIpAddress(request)
    );

    return successResponse({ id: created.id }, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
