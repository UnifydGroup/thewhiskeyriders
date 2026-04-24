/**
 * POST /api/emails/[id]/test
 * Sends a test copy of a campaign to one or more specific members.
 * - Does NOT change campaign status (stays draft)
 * - Does NOT record in email_campaign_deliveries
 * - Adds "[TEST]" prefix to the subject line
 * - Injects a visible test banner at the top of the email body
 * - Still resolves personalisation merge tags per recipient
 */

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
  buildEmailHtml,
  buildEmailText,
  fetchEmailHeaderSettings,
  isEmailConfigured,
  resolvePortalBaseUrl,
  sendEmail,
} from '@/lib/email/send';
import type { UserRole } from '@/lib/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const EMAIL_ADMIN_ROLES: UserRole[] = ['trip_admin', 'admin', 'super_admin'];

type MemberRecipient = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
};

function getRecipientName(r: MemberRecipient): string {
  return r.nickname?.trim() || r.full_name?.trim() || r.email;
}

function isStandaloneEmailHtml(content: string): boolean {
  const lower = (content || '').toLowerCase();
  return (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('<body') ||
    lower.includes('<style') ||
    lower.includes('email-wrapper')
  );
}

function personaliseMergeTags(body: string, recipient: MemberRecipient): string {
  const firstName =
    recipient.full_name?.split(' ')[0]?.trim() ||
    recipient.nickname?.trim() ||
    recipient.email.split('@')[0];
  const fullName = recipient.full_name?.trim() || firstName;
  const nickname = recipient.nickname?.trim() || firstName;
  return body
    .replace(/\{\{member\.first_name\}\}/gi, firstName)
    .replace(/\{\{member\.full_name\}\}/gi, fullName)
    .replace(/\{\{member\.nickname\}\}/gi, nickname)
    .replace(/\{\{member\.email\}\}/gi, recipient.email);
}

/** Prepend a purple test banner so the reviewer immediately knows this is a preview. */
function injectTestBanner(bodyHtml: string): string {
  const banner = `<div style="background:#6d28d9;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:700;text-align:center;margin:0 0 18px;letter-spacing:0.4px">
    TEST EMAIL — this is a preview. It was not sent to the campaign recipients.
  </div>`;
  return banner + bodyHtml;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
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

    const body = await getJsonBody(request);

    const memberIds: string[] = Array.isArray(body.member_ids)
      ? (body.member_ids as unknown[]).filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0
        )
      : [];

    if (memberIds.length === 0) {
      return errorResponse(
        ApiErrors.BAD_REQUEST,
        'Select at least one member to receive the test email.'
      );
    }

    if (memberIds.length > 10) {
      return errorResponse(
        ApiErrors.BAD_REQUEST,
        'Maximum 10 recipients per test send.'
      );
    }

    // Load campaign (any status — you might want to preview a sent campaign too)
    const { data: campaign, error: campaignError } = await db
      .from('email_campaigns')
      .select('id, subject, body')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Campaign not found.');
    }

    // Load recipient profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, nickname')
      .in('id', memberIds);

    const recipients: MemberRecipient[] = (profiles || [])
      .filter(
        (r: { email: unknown }) =>
          typeof r.email === 'string' && (r.email as string).trim().length > 0
      )
      .map(
        (r: {
          id: string;
          email: string;
          full_name: string | null;
          nickname: string | null;
        }) => ({
          id: r.id,
          email: r.email.trim(),
          full_name: r.full_name ?? null,
          nickname: r.nickname ?? null,
        })
      );

    if (recipients.length === 0) {
      return errorResponse(
        ApiErrors.BAD_REQUEST,
        'No valid recipients found — check the selected members have email addresses.'
      );
    }

    const baseUrl = resolvePortalBaseUrl(request.nextUrl.origin);
    const emailHeader = await fetchEmailHeaderSettings(db);
    const testSubject = `[TEST] ${campaign.subject}`;

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const name = getRecipientName(recipient);
      const personalisedBody = personaliseMergeTags(campaign.body, recipient);
      const standaloneHtml = isStandaloneEmailHtml(personalisedBody);

      const html = standaloneHtml
        ? personalisedBody // Can't inject banner cleanly into full standalone HTML
        : buildEmailHtml({
            recipientName: name,
            subject: testSubject,
            bodyHtml: injectTestBanner(personalisedBody),
            ctaUrl: baseUrl ? `${baseUrl}/dashboard` : undefined,
            ctaLabel: 'Visit the Portal',
            headerTitle: emailHeader.email_header_title,
            headerTagline: emailHeader.email_header_tagline,
            headerImageUrl: emailHeader.email_header_image_url ?? undefined,
            footerText: emailHeader.email_footer_text,
            footerImageUrl: emailHeader.email_footer_image_url ?? undefined,
            greetingPrefix: emailHeader.email_greeting,
          });

      const text = buildEmailText({
        recipientName: name,
        bodyText: `[TEST EMAIL — preview only]\n\n${personalisedBody.replace(/<[^>]+>/g, '').trim()}`,
        ctaUrl: standaloneHtml ? undefined : (baseUrl ? `${baseUrl}/dashboard` : undefined),
        ctaLabel: standaloneHtml ? undefined : 'Visit the Portal',
        greetingPrefix: emailHeader.email_greeting,
      });

      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: testSubject,
          html,
          text,
        });
        if (result.error) {
          failed++;
        } else {
          sent++;
        }
      } catch {
        failed++;
      }
    }

    await logActivity(
      user.id,
      'test_send',
      'email_campaign',
      campaignId,
      campaign.subject,
      { sent, failed, attempted: recipients.length, member_ids: memberIds },
      getIpAddress(request)
    );

    return successResponse({ sent, failed, attempted: recipients.length });
  } catch (error: unknown) {
    return errorResponse(
      ApiErrors.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
}
