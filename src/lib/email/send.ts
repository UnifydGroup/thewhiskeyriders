/**
 * Shared email sending utility via Resend API.
 * Includes branded email builder with configurable header via site_settings.
 * Used by both the news notification system and email campaigns.
 */

type ResendSendResponse = {
  id?: string;
  error?: { message?: string };
};

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  id: string | null;
  error: string | null;
};

function trimEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

export function normalizeBaseUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/+$/, '');
  }
  return `https://${raw.replace(/\/+$/, '')}`;
}

export function resolvePortalBaseUrl(requestOrigin: string): string {
  const configured = trimEnv('NEXT_PUBLIC_SITE_URL');
  if (configured) return normalizeBaseUrl(configured);

  const vercelUrl = trimEnv('VERCEL_URL');
  if (vercelUrl) return normalizeBaseUrl(vercelUrl);

  return normalizeBaseUrl(requestOrigin);
}

export function isEmailConfigured(): boolean {
  return Boolean(trimEnv('RESEND_API_KEY') && trimEnv('EMAIL_FROM'));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = trimEnv('RESEND_API_KEY');
  const from = trimEnv('EMAIL_FROM');

  if (!apiKey || !from) {
    return {
      id: null,
      error: 'Missing RESEND_API_KEY or EMAIL_FROM environment variable',
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
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
      error: payload.error?.message || `Email provider returned HTTP ${response.status}`,
    };
  }

  return {
    id: payload.id || null,
    error: null,
  };
}

/**
 * Build a branded HTML email shell around inner content.
 * Keep it simple and email-client compatible.
 */
export function buildEmailHtml(args: {
  recipientName: string;
  subject: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  previewText?: string;
  headerTitle?: string;
  headerTagline?: string;
  footerText?: string;
}): string {
  const { recipientName, subject, bodyHtml, ctaUrl, ctaLabel, previewText } = args;
  const headerTitle = args.headerTitle?.trim() || 'The Whiskey Riders';
  const headerTagline = args.headerTagline?.trim() || 'Ride. Bond. Remember.';
  const footerText = args.footerText?.trim() || "You're receiving this because you're a member of The Whiskey Riders.";

  const ctaBlock =
    ctaUrl && ctaLabel
      ? `
        <div style="margin:24px 0;text-align:center">
          <a href="${escapeHtml(ctaUrl)}" style="background:#B5621E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;display:inline-block">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>`
      : '';

  const previewSpan = previewText
    ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(previewText)}&nbsp;</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:Arial,Helvetica,sans-serif">
  ${previewSpan}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#1a1a1a;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#111;border-radius:10px;overflow:hidden;border:1px solid #3a2a1a">
          <!-- Header -->
          <tr>
            <td style="background:#B5621E;padding:20px 32px;text-align:center">
              <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase">${escapeHtml(headerTitle)}</p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1px">${escapeHtml(headerTagline)}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#C9B98A">
              <p style="margin:0 0 16px;color:#C9B98A;font-size:15px">Hi ${escapeHtml(recipientName)},</p>
              <div style="color:#d4c9a8;font-size:15px;line-height:1.6">
                ${bodyHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #3a2a1a;text-align:center">
              <p style="margin:0;color:#666;font-size:12px">
                ${escapeHtml(footerText)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type EmailHeaderSettings = {
  email_header_title: string;
  email_header_tagline: string;
  email_footer_text: string;
};

const DEFAULT_EMAIL_HEADER: EmailHeaderSettings = {
  email_header_title: 'The Whiskey Riders',
  email_header_tagline: 'Ride. Bond. Remember.',
  email_footer_text: "You're receiving this because you're a member of The Whiskey Riders.",
};

/**
 * Load email header/footer settings from site_settings.
 * Falls back to defaults if the columns don't exist yet (migration pending).
 */
export async function fetchEmailHeaderSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<EmailHeaderSettings> {
  try {
    const { data, error } = await db
      .from('site_settings')
      .select('email_header_title, email_header_tagline, email_footer_text')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_EMAIL_HEADER;

    return {
      email_header_title: data.email_header_title?.trim() || DEFAULT_EMAIL_HEADER.email_header_title,
      email_header_tagline: data.email_header_tagline?.trim() || DEFAULT_EMAIL_HEADER.email_header_tagline,
      email_footer_text: data.email_footer_text?.trim() || DEFAULT_EMAIL_HEADER.email_footer_text,
    };
  } catch {
    return DEFAULT_EMAIL_HEADER;
  }
}

export function buildEmailText(args: {
  recipientName: string;
  bodyText: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const lines: string[] = [
    `Hi ${args.recipientName},`,
    '',
    args.bodyText,
  ];

  if (args.ctaUrl && args.ctaLabel) {
    lines.push('');
    lines.push(`${args.ctaLabel}: ${args.ctaUrl}`);
  }

  lines.push('');
  lines.push("You're receiving this because you're a member of The Whiskey Riders.");

  return lines.join('\n');
}
