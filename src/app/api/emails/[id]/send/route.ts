/**
 * POST /api/emails/[id]/send
 * Sends an email campaign to all targeted members.
 * Only works on draft campaigns. Marks them as sent once dispatched.
 */

import { NextRequest } from 'next/server';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  logActivity,
  successResponse,
  supabase,
  verifyRole,
} from '@/lib/api/helpers';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  isEmailConfigured,
  resolvePortalBaseUrl,
} from '@/lib/email/send';
import type { UserRole } from '@/lib/types/database';

// New tables not yet in generated types — use untyped client until migration runs and types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const EMAIL_ADMIN_ROLES: UserRole[] = ['trip_admin', 'admin', 'super_admin'];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

type MemberRecipient = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
};

function getRecipientName(r: MemberRecipient): string {
  return r.nickname?.trim() || r.full_name?.trim() || r.email;
}

async function resolveRecipients(campaignId: string, campaignRow: {
  tag_all_members: boolean;
  is_global: boolean;
}): Promise<MemberRecipient[]> {
  const ids = new Set<string>();

  const hasTripTags = await db
    .from('email_campaign_trips')
    .select('trip_id')
    .eq('email_campaign_id', campaignId);

  const hasMemberTags = await db
    .from('email_campaign_members')
    .select('member_id')
    .eq('email_campaign_id', campaignId);

  const tripIds = (hasTripTags.data || []).map((r: { trip_id: string }) => r.trip_id);
  const memberIds = (hasMemberTags.data || []).map((r: { member_id: string }) => r.member_id);

  const isAllMembers = campaignRow.tag_all_members || (campaignRow.is_global && tripIds.length === 0 && memberIds.length === 0);

  if (isAllMembers) {
    const { data } = await db.from('profiles').select('id').eq('status', 'active');
    for (const p of data || []) ids.add(p.id);
  } else {
    for (const id of memberIds) ids.add(id);

    if (tripIds.length > 0) {
      const { data } = await supabase
        .from('trip_members')
        .select('user_id')
        .in('trip_id', tripIds);
      for (const r of data || []) ids.add(r.user_id);
    }
  }

  if (ids.size === 0) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, nickname, status')
    .in('id', Array.from(ids))
    .eq('status', 'active');

  return (data || [])
    .filter((r: { email: string }) => typeof r.email === 'string' && r.email.trim())
    .map((r: { id: string; email: string; full_name: string | null; nickname: string | null }) => ({
      id: r.id,
      email: r.email.trim(),
      full_name: r.full_name ?? null,
      nickname: r.nickname ?? null,
    }));
}

async function recordDelivery(args: {
  campaignId: string;
  memberId: string;
  sentAt: string | null;
  providerMessageId: string | null;
  error: string | null;
}) {
  await db.from('email_campaign_deliveries').upsert(
    {
      email_campaign_id: args.campaignId,
      member_id: args.memberId,
      sent_at: args.sentAt,
      provider_message_id: args.providerMessageId,
      error: args.error,
    },
    { onConflict: 'email_campaign_id,member_id' }
  );
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const campaignId = params.id;

    const { authenticated, authorized, user } = await verifyRole(
      request,
      EMAIL_ADMIN_ROLES
    );

    if (!authenticated || !user) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    if (!isEmailConfigured()) {
      return errorResponse(
        ApiErrors.BAD_REQUEST,
        'Email is not configured. Add RESEND_API_KEY and EMAIL_FROM to your environment variables.'
      );
    }

    const { data: campaign, error: campaignError } = await db
      .from('email_campaigns')
      .select('id, subject, body, status, is_global, tag_all_members')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Campaign not found');
    }

    if (campaign.status === 'sent') {
      return errorResponse(ApiErrors.BAD_REQUEST, 'This campaign has already been sent');
    }

    const recipients = await resolveRecipients(campaignId, {
      tag_all_members: campaign.tag_all_members,
      is_global: campaign.is_global,
    });

    if (recipients.length === 0) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'No eligible recipients found for this campaign');
    }

    const baseUrl = resolvePortalBaseUrl(request.nextUrl.origin);

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const name = getRecipientName(recipient);

      const html = buildEmailHtml({
        recipientName: name,
        subject: campaign.subject,
        bodyHtml: campaign.body,
        ctaUrl: baseUrl ? `${baseUrl}/dashboard` : undefined,
        ctaLabel: 'Visit the Portal',
      });

      const text = buildEmailText({
        recipientName: name,
        bodyText: campaign.body.replace(/<[^>]+>/g, '').trim(),
        ctaUrl: baseUrl ? `${baseUrl}/dashboard` : undefined,
        ctaLabel: 'Visit the Portal',
      });

      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: campaign.subject,
          html,
          text,
        });

        if (result.error) {
          failed += 1;
          await recordDelivery({
            campaignId,
            memberId: recipient.id,
            sentAt: null,
            providerMessageId: null,
            error: result.error,
          });
        } else {
          sent += 1;
          await recordDelivery({
            campaignId,
            memberId: recipient.id,
            sentAt: new Date().toISOString(),
            providerMessageId: result.id,
            error: null,
          });
        }
      } catch (err: unknown) {
        failed += 1;
        await recordDelivery({
          campaignId,
          memberId: recipient.id,
          sentAt: null,
          providerMessageId: null,
          error: getErrorMessage(err),
        });
      }
    }

    // Mark campaign as sent (even if some individual sends failed)
    await db
      .from('email_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', campaignId);

    await logActivity(
      user.id,
      'update',
      'email_campaign',
      campaignId,
      campaign.subject,
      { action: 'send', attempted: recipients.length, sent, failed },
      getIpAddress(request)
    );

    console.info('[email-campaign] send complete', {
      campaign_id: campaignId,
      attempted: recipients.length,
      sent,
      failed,
    });

    return successResponse({ attempted: recipients.length, sent, failed });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
