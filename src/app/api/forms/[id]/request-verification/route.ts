import { NextRequest } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { supabase, errorResponse, successResponse, ApiErrors, getJsonBody } from '@/lib/api/helpers';
import { sendEmail, buildEmailHtml, buildEmailText, fetchEmailHeaderSettings } from '@/lib/email/send';

// POST /api/forms/[token]/request-verification
// Public endpoint — no auth required.
// Sends a 6-digit OTP to the submitted email address so the member can prove
// they own it before submitting the form. Only active when the form has
// require_email_verification = true.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: token } = await params;

  // Resolve form
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, title, status, require_email_verification, goes_live_at, submission_deadline')
    .eq('token', token)
    .single();

  if (formErr || !form) return errorResponse(ApiErrors.NOT_FOUND, 'Form not found');
  if (!form.require_email_verification) {
    return errorResponse(ApiErrors.FORBIDDEN, 'This form does not require email verification');
  }

  const now = new Date();
  const isScheduledAndLive = form.goes_live_at && new Date(form.goes_live_at) <= now;
  if (form.status !== 'active' && !isScheduledAndLive) {
    return errorResponse(ApiErrors.FORBIDDEN, 'This form is not currently accepting submissions');
  }
  if (form.submission_deadline && new Date(form.submission_deadline) < now) {
    return errorResponse(ApiErrors.FORBIDDEN, 'The submission deadline has passed');
  }

  const body = await getJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(ApiErrors.BAD_REQUEST, 'A valid email address is required');
  }

  // Rate-limit: max 3 active (unverified) OTPs per form+email in the last 10 minutes
  const { count } = await supabase
    .from('form_verifications')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', form.id)
    .eq('email', email)
    .is('verified_at', null)
    .gt('expires_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString());

  if ((count ?? 0) >= 3) {
    return errorResponse(ApiErrors.CONFLICT, 'Too many verification attempts. Please wait a few minutes and try again.');
  }

  // Generate 6-digit OTP and hash it
  const otp = String(randomInt(100000, 999999));
  const otpHash = createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const { data: verification, error: insertErr } = await supabase
    .from('form_verifications')
    .insert({
      form_id:    form.id,
      email,
      otp_hash:   otpHash,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (insertErr || !verification) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, 'Failed to create verification');
  }

  // Send OTP email
  const emailSettings = await fetchEmailHeaderSettings(supabase);
  const firstName = email.split('@')[0]; // best-effort name for greeting

  const { error: sendErr } = await sendEmail({
    to: email,
    subject: `Your verification code for ${form.title}`,
    html: buildEmailHtml({
      ...emailSettings,
      recipientName: firstName,
      subject: `Your verification code for ${form.title}`,
      bodyHtml: `
        <p>You requested a verification code to complete the <strong>${form.title}</strong> form.</p>
        <div style="margin:24px 0;text-align:center">
          <div style="display:inline-block;background:#1a1a1a;border:2px solid #B5621E;border-radius:10px;padding:16px 32px">
            <p style="margin:0;color:#999;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Your code</p>
            <p style="margin:0;color:#ffffff;font-size:36px;font-weight:700;letter-spacing:10px;font-family:monospace">${otp}</p>
          </div>
        </div>
        <p style="color:#999;font-size:13px;text-align:center">This code expires in <strong>15 minutes</strong>. If you didn't request this, you can ignore this email.</p>
      `,
      previewText: `Your verification code is ${otp}`,
    }),
    text: buildEmailText({
      ...emailSettings,
      recipientName: firstName,
      bodyText: `You requested a verification code to complete the ${form.title} form.\n\nYour code: ${otp}\n\nThis code expires in 15 minutes. If you didn't request this, you can ignore this email.`,
    }),
  });

  if (sendErr) {
    console.error('[request-verification] email send failed:', sendErr);
    // Clean up the verification record so the user can retry
    await supabase.from('form_verifications').delete().eq('id', verification.id);
    return errorResponse(ApiErrors.INTERNAL_ERROR, 'Failed to send verification email. Please try again.');
  }

  return successResponse({ verification_id: verification.id });
}
