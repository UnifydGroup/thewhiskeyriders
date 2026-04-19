import type { NewsItem } from '@/lib/news/types';
import { toSearchableNewsText } from '@/lib/news/content';
import { supabase } from '@/lib/api/helpers';

type MemberRecipient = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
};

type DispatchNewsEmailArgs = {
  newsItem: NewsItem;
  baseUrl: string;
};

type DispatchNewsEmailResult = {
  enabled: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skippedReason?: string;
};

type ResendSendResponse = {
  id?: string;
  error?: {
    message?: string;
  };
};

function trimEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

function normalizeBaseUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/+$/, '');
  }

  return `https://${raw.replace(/\/+$/, '')}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRecipientName(recipient: MemberRecipient): string {
  const nickname = recipient.nickname?.trim();
  if (nickname) return nickname;
  const fullName = recipient.full_name?.trim();
  if (fullName) return fullName;
  return recipient.email;
}

function buildPreviewText(content: string): string {
  const preview = toSearchableNewsText(content);
  if (!preview) return '';
  if (preview.length <= 280) return preview;
  return `${preview.slice(0, 280)}...`;
}

function coerceErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  return (
    maybe.code === '42703' ||
    maybe.code === 'PGRST204' ||
    (typeof maybe.message === 'string' &&
      (maybe.message.includes('column') ||
        maybe.message.includes('Could not find the column') ||
        maybe.message.includes('does not exist')))
  );
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  return (
    maybe.code === '42P01' ||
    maybe.code === 'PGRST205' ||
    (typeof maybe.message === 'string' &&
      ((maybe.message.toLowerCase().includes('relation') &&
        maybe.message.toLowerCase().includes('does not exist')) ||
        maybe.message.includes("Could not find the table")))
  );
}

async function isNewsEmailEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('news_email_notifications_enabled')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      return true;
    }
    throw new Error(error.message);
  }

  return data?.news_email_notifications_enabled !== false;
}

async function resolveRecipientIds(newsItem: NewsItem): Promise<string[]> {
  const ids = new Set<string>();
  const hasTripTags = newsItem.trip_tags.length > 0;
  const hasMemberTags = newsItem.member_tags.length > 0;
  const isAllMembersPost =
    newsItem.tag_all_members || (newsItem.is_global && !hasTripTags && !hasMemberTags);

  if (isAllMembersPost) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('status', 'active');

    if (error) {
      throw new Error(error.message);
    }

    for (const profile of data || []) {
      if (typeof profile.id === 'string' && profile.id.trim()) {
        ids.add(profile.id.trim());
      }
    }

    return Array.from(ids);
  }

  for (const member of newsItem.member_tags) {
    if (typeof member.id === 'string' && member.id.trim()) {
      ids.add(member.id.trim());
    }
  }

  const tripIds = newsItem.trip_tags.map((trip) => trip.id).filter((id) => id && id.trim());
  if (tripIds.length > 0) {
    const { data, error } = await supabase
      .from('trip_members')
      .select('user_id')
      .in('trip_id', tripIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const member of data || []) {
      if (typeof member.user_id === 'string' && member.user_id.trim()) {
        ids.add(member.user_id.trim());
      }
    }
  }

  return Array.from(ids);
}

async function applyNotificationPreferenceFilter(memberIds: string[]): Promise<string[]> {
  if (memberIds.length === 0) return [];

  // notification_preferences is an optional table not yet in generated types; cast to bypass TS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('notification_preferences')
    .select('user_id, trip_updates')
    .in('user_id', memberIds);

  if (error) {
    if (isMissingTableError(error)) {
      return memberIds;
    }
    throw new Error(error.message);
  }

  const preferences = new Map<string, string>();
  for (const row of data || []) {
    if (typeof row.user_id === 'string' && typeof row.trip_updates === 'string') {
      preferences.set(row.user_id, row.trip_updates.toLowerCase());
    }
  }

  return memberIds.filter((id) => {
    const pref = preferences.get(id);
    return !pref || pref === 'email' || pref === 'both';
  });
}

async function loadRecipients(memberIds: string[]): Promise<MemberRecipient[]> {
  if (memberIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, nickname, status')
    .in('id', memberIds)
    .eq('status', 'active');

  if (error) {
    throw new Error(error.message);
  }

  const recipients: MemberRecipient[] = [];
  for (const row of data || []) {
    const email = typeof row.email === 'string' ? row.email.trim() : '';
    if (!email) continue;
    recipients.push({
      id: row.id,
      email,
      full_name: row.full_name ?? null,
      nickname: row.nickname ?? null,
    });
  }

  return recipients;
}

async function removeAlreadyProcessedRecipients(
  newsPostId: string,
  recipients: MemberRecipient[]
): Promise<MemberRecipient[]> {
  if (recipients.length === 0) return [];

  const { data, error } = await supabase
    .from('news_email_deliveries')
    .select('member_id, sent_at')
    .eq('news_post_id', newsPostId);

  if (error) {
    if (isMissingTableError(error)) {
      return recipients;
    }
    throw new Error(error.message);
  }

  const existing = new Set(
    (data || [])
      .filter((row) => typeof row.sent_at === 'string' && row.sent_at.trim().length > 0)
      .map((row) => row.member_id)
  );
  return recipients.filter((recipient) => !existing.has(recipient.id));
}

async function recordDeliveryAttempt(args: {
  newsPostId: string;
  memberId: string;
  sentAt: string | null;
  providerMessageId: string | null;
  error: string | null;
}) {
  const { error } = await supabase
    .from('news_email_deliveries')
    .upsert(
      {
        news_post_id: args.newsPostId,
        member_id: args.memberId,
        sent_at: args.sentAt,
        provider_message_id: args.providerMessageId,
        error: args.error,
      },
      {
        onConflict: 'news_post_id,member_id',
      }
    );

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message);
  }
}

async function sendViaResend(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string | null; error: string | null }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as ResendSendResponse;
  if (!response.ok) {
    return {
      id: null,
      error:
        payload.error?.message ||
        `Email provider returned HTTP ${response.status}`,
    };
  }

  return {
    id: payload.id || null,
    error: null,
  };
}

export async function dispatchNewsPublicationEmails(
  args: DispatchNewsEmailArgs
): Promise<DispatchNewsEmailResult> {
  if (!args.newsItem.is_published || args.newsItem.is_archived) {
    return {
      enabled: true,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: 'News item is not in a published state',
    };
  }

  if (args.newsItem.send_email_notification === false) {
    return {
      enabled: true,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: 'Email notifications disabled for this post',
    };
  }

  const enabled = await isNewsEmailEnabled();
  if (!enabled) {
    return {
      enabled: false,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: 'News email notifications are disabled in admin settings',
    };
  }

  const resendApiKey = trimEnv('RESEND_API_KEY');
  const emailFrom = trimEnv('EMAIL_FROM');
  if (!resendApiKey || !emailFrom) {
    return {
      enabled: true,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: 'Missing RESEND_API_KEY or EMAIL_FROM',
    };
  }

  const preferredBaseUrl = normalizeBaseUrl(
    trimEnv('NEXT_PUBLIC_SITE_URL') || trimEnv('VERCEL_URL') || args.baseUrl
  );
  const postUrl = `${preferredBaseUrl.replace(/\/+$/, '')}/news/${args.newsItem.id}`;
  const previewText = buildPreviewText(args.newsItem.content);
  const subject = `Whiskey Riders Update: ${args.newsItem.title}`;

  const resolvedMemberIds = await resolveRecipientIds(args.newsItem);
  const preferenceFilteredIds = await applyNotificationPreferenceFilter(resolvedMemberIds);
  const loadedRecipients = await loadRecipients(preferenceFilteredIds);
  const recipients = await removeAlreadyProcessedRecipients(args.newsItem.id, loadedRecipients);

  if (recipients.length === 0) {
    return {
      enabled: true,
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: 'No eligible recipients',
    };
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const recipientName = getRecipientName(recipient);
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111">
        <p>Hi ${escapeHtml(recipientName)},</p>
        <p>A new Whiskey Riders update has been published:</p>
        <p><strong>${escapeHtml(args.newsItem.title)}</strong></p>
        ${
          previewText
            ? `<p style="color:#333">${escapeHtml(previewText)}</p>`
            : ''
        }
        <p><a href="${escapeHtml(postUrl)}">Read the full update</a></p>
      </div>
    `.trim();

    const text = [
      `Hi ${recipientName},`,
      '',
      'A new Whiskey Riders update has been published:',
      args.newsItem.title,
      previewText ? '' : null,
      previewText || null,
      '',
      `Read the full update: ${postUrl}`,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join('\n');

    try {
      const result = await sendViaResend({
        apiKey: resendApiKey,
        from: emailFrom,
        to: recipient.email,
        subject,
        html,
        text,
      });

      if (result.error) {
        failed += 1;
        await recordDeliveryAttempt({
          newsPostId: args.newsItem.id,
          memberId: recipient.id,
          sentAt: null,
          providerMessageId: null,
          error: result.error,
        });
      } else {
        sent += 1;
        await recordDeliveryAttempt({
          newsPostId: args.newsItem.id,
          memberId: recipient.id,
          sentAt: new Date().toISOString(),
          providerMessageId: result.id,
          error: null,
        });
      }
    } catch (error: unknown) {
      failed += 1;
      await recordDeliveryAttempt({
        newsPostId: args.newsItem.id,
        memberId: recipient.id,
        sentAt: null,
        providerMessageId: null,
        error: coerceErrorMessage(error),
      });
    }
  }

  return {
    enabled: true,
    attempted: recipients.length,
    sent,
    failed,
  };
}
