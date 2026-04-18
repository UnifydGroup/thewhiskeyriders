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

async function hydrateOneCampaign(id: string) {
  const { data, error } = await db
    .from('email_campaigns')
    .select(CAMPAIGN_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const [tripTagsResult, memberTagsResult] = await Promise.all([
    db
      .from('email_campaign_trips')
      .select('trips:trip_id(id, name, slug)')
      .eq('email_campaign_id', id),
    db
      .from('email_campaign_members')
      .select('profiles:member_id(id, full_name, nickname)')
      .eq('email_campaign_id', id),
  ]);

  return {
    ...(data as Record<string, unknown>),
    trip_tags: (tripTagsResult.data || [])
      .map((r: { trips: unknown }) => r.trips)
      .filter(Boolean),
    member_tags: (memberTagsResult.data || [])
      .map((r: { profiles: unknown }) => r.profiles)
      .filter(Boolean),
  };
}

// GET /api/emails/[id]
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { authenticated, authorized } = await verifyRole(
      request,
      EMAIL_ADMIN_ROLES
    );

    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const campaign = await hydrateOneCampaign(params.id);
    if (!campaign) return errorResponse(ApiErrors.NOT_FOUND, 'Campaign not found');

    return successResponse(campaign);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// PUT /api/emails/[id] - Update a draft campaign
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { authenticated, authorized, user } = await verifyRole(
      request,
      EMAIL_ADMIN_ROLES
    );

    if (!authenticated || !user) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    // Only allow editing drafts
    const { data: existing, error: existingError } = await db
      .from('email_campaigns')
      .select('id, subject, status')
      .eq('id', params.id)
      .single();

    if (existingError || !existing) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Campaign not found');
    }

    if (existing.status === 'sent') {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Cannot edit a sent campaign');
    }

    const body = await getJsonBody(request);
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.subject === 'string') {
      const subject = body.subject.trim();
      if (!subject) return errorResponse(ApiErrors.BAD_REQUEST, 'subject cannot be empty');
      updatePayload.subject = subject;
    }

    if (typeof body.body === 'string') {
      const bodyContent = body.body.trim();
      if (!bodyContent) return errorResponse(ApiErrors.BAD_REQUEST, 'body cannot be empty');
      updatePayload.body = bodyContent;
    }

    const nextIsGlobal = typeof body.is_global === 'boolean' ? body.is_global : null;
    const nextTagAllMembers = typeof body.tag_all_members === 'boolean' ? body.tag_all_members : null;

    if (nextIsGlobal !== null) updatePayload.is_global = nextIsGlobal;
    if (nextTagAllMembers !== null) updatePayload.tag_all_members = nextTagAllMembers;

    const hasTripIds = Object.prototype.hasOwnProperty.call(body, 'trip_ids');
    const hasMemberIds = Object.prototype.hasOwnProperty.call(body, 'member_ids');

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await db
        .from('email_campaigns')
        .update(updatePayload)
        .eq('id', params.id);

      if (updateError) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, updateError.message);
      }
    }

    const requestedTripIds = hasTripIds ? normalizeIdArray(body.trip_ids) : null;
    const requestedMemberIds = hasMemberIds ? normalizeIdArray(body.member_ids) : null;

    const shouldClearTripTags = nextIsGlobal === true;
    const shouldClearMemberTags = nextTagAllMembers === true;

    const tripIds = shouldClearTripTags ? [] : requestedTripIds;
    const memberIds = shouldClearMemberTags ? [] : requestedMemberIds;

    if (tripIds !== null) {
      await db.from('email_campaign_trips').delete().eq('email_campaign_id', params.id);
      if (tripIds.length > 0) {
        await db.from('email_campaign_trips').insert(
          tripIds.map((id) => ({ email_campaign_id: params.id, trip_id: id }))
        );
      }
    }

    if (memberIds !== null) {
      await db.from('email_campaign_members').delete().eq('email_campaign_id', params.id);
      if (memberIds.length > 0) {
        await db.from('email_campaign_members').insert(
          memberIds.map((id) => ({ email_campaign_id: params.id, member_id: id }))
        );
      }
    }

    const campaign = await hydrateOneCampaign(params.id);

    await logActivity(
      user.id,
      'update',
      'email_campaign',
      params.id,
      existing.subject,
      { updated_fields: Object.keys(updatePayload) },
      getIpAddress(request)
    );

    return successResponse(campaign);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// DELETE /api/emails/[id]
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { authenticated, authorized, user } = await verifyRole(
      request,
      EMAIL_ADMIN_ROLES
    );

    if (!authenticated || !user) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data: existing } = await db
      .from('email_campaigns')
      .select('id, subject')
      .eq('id', params.id)
      .single();

    const { error } = await db
      .from('email_campaigns')
      .delete()
      .eq('id', params.id);

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);

    await logActivity(
      user.id,
      'delete',
      'email_campaign',
      params.id,
      existing?.subject || null,
      null,
      getIpAddress(request)
    );

    return successResponse({ id: params.id });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
