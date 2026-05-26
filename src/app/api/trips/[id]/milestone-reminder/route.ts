/**
 * POST /api/trips/[id]/milestone-reminder
 * Sends a payment milestone reminder email to all trip members.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  isEmailConfigured,
  resolvePortalBaseUrl,
  fetchEmailHeaderSettings,
} from '@/lib/email/send';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAdmin = () => createClient() as any;

type Params = { params: Promise<{ id: string }> };

function fmtAUD(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await supabaseAdmin();
  const { id: tripId } = await params;

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Email is not configured. Add RESEND_API_KEY and EMAIL_FROM to environment variables.' },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { milestone_id, custom_message } = body as {
    milestone_id: string;
    custom_message?: string;
  };

  if (!milestone_id) {
    return NextResponse.json({ error: 'milestone_id is required' }, { status: 400 });
  }

  // Load milestone
  const { data: milestone, error: milestoneErr } = await supabase
    .from('payment_schedule_milestones')
    .select('id, milestone_date, accumulated_amount, description, trip_id')
    .eq('id', milestone_id)
    .eq('trip_id', tripId)
    .single();

  if (milestoneErr || !milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
  }

  // Load trip name
  const { data: trip } = await supabase
    .from('trips')
    .select('name')
    .eq('id', tripId)
    .single();

  const tripName = trip?.name ?? 'your trip';

  // Load all active trip members with email
  const { data: membersData } = await supabase
    .from('trip_members')
    .select('user_id, profiles(id, email, full_name, nickname, status)')
    .eq('trip_id', tripId);

  type ProfileRow = { id: string; email: string; full_name: string | null; nickname: string | null; status: string };
  const recipients: ProfileRow[] = (membersData ?? [])
    .map((m: { profiles: ProfileRow | null }) => m.profiles)
    .filter((p: ProfileRow | null): p is ProfileRow => !!p && p.status === 'active' && !!p.email);

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No active members with email addresses found' }, { status: 400 });
  }

  const baseUrl = resolvePortalBaseUrl(req.nextUrl.origin);
  const emailHeader = await fetchEmailHeaderSettings(supabase);

  const milestoneDate = fmtDate(milestone.milestone_date);
  const milestoneAmount = fmtAUD(milestone.accumulated_amount);
  const subject = `Payment Reminder: ${milestoneAmount} due ${milestoneDate} — ${tripName}`;

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const firstName = recipient.full_name?.split(' ')[0]?.trim() || recipient.nickname?.trim() || recipient.email.split('@')[0];
    const bodyHtml = `
      <p>Hi ${firstName},</p>
      <p>This is a reminder that your next payment milestone for <strong>${tripName}</strong> is coming up.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#1a1a1a;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #333;color:#9c8b6e;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Due Date</td>
          <td style="padding:12px 16px;border-bottom:1px solid #333;color:#f5f0e8;font-weight:600;">${milestoneDate}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #333;color:#9c8b6e;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Accumulated Total</td>
          <td style="padding:12px 16px;border-bottom:1px solid #333;color:#B5621E;font-weight:700;font-size:18px;">${milestoneAmount}</td>
        </tr>
        ${milestone.description ? `<tr><td style="padding:12px 16px;color:#9c8b6e;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Note</td><td style="padding:12px 16px;color:#f5f0e8;">${milestone.description}</td></tr>` : ''}
      </table>
      ${custom_message ? `<p style="color:#f5f0e8;">${custom_message}</p>` : ''}
      <p style="color:#9c8b6e;font-size:14px;">You can view your full payment progress and bank details in the member portal.</p>
    `.trim();

    const html = buildEmailHtml({
      recipientName: firstName,
      subject,
      bodyHtml,
      ctaUrl: baseUrl ? `${baseUrl}/trips` : undefined,
      ctaLabel: 'View Payment Schedule',
      headerTitle: emailHeader.email_header_title,
      headerTagline: emailHeader.email_header_tagline,
      headerImageUrl: emailHeader.email_header_image_url ?? undefined,
      footerText: emailHeader.email_footer_text,
      footerImageUrl: emailHeader.email_footer_image_url ?? undefined,
      greetingPrefix: emailHeader.email_greeting,
    });

    const text = buildEmailText({
      recipientName: firstName,
      bodyText: `Payment milestone reminder for ${tripName}.\n\nDue: ${milestoneDate}\nAmount: ${milestoneAmount}${milestone.description ? `\nNote: ${milestone.description}` : ''}${custom_message ? `\n\n${custom_message}` : ''}\n\nView your payment schedule in the member portal.`,
      ctaUrl: baseUrl ? `${baseUrl}/trips` : undefined,
      ctaLabel: 'View Payment Schedule',
      greetingPrefix: emailHeader.email_greeting,
    });

    const result = await sendEmail({ to: recipient.email, subject, html, text });
    if (result.error) {
      failed += 1;
    } else {
      sent += 1;
    }
  }

  return NextResponse.json({ attempted: recipients.length, sent, failed });
}
