import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { supabase, errorResponse, successResponse, ApiErrors, getJsonBody } from '@/lib/api/helpers';

// POST /api/forms/[token]/confirm-verification
// Public endpoint — no auth required.
// Accepts { verification_id, otp } and marks the OTP as verified.
// Returns the verification_id as a token the client includes in the form submit body.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: token } = await params;

  // Resolve form (just to confirm it exists)
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, require_email_verification')
    .eq('token', token)
    .single();

  if (formErr || !form) return errorResponse(ApiErrors.NOT_FOUND, 'Form not found');
  if (!form.require_email_verification) {
    return errorResponse(ApiErrors.FORBIDDEN, 'This form does not require email verification');
  }

  const body = await getJsonBody(request);
  const { verification_id, otp } = body;

  if (!verification_id || !otp) {
    return errorResponse(ApiErrors.BAD_REQUEST, 'verification_id and otp are required');
  }

  const otpHash = createHash('sha256').update(String(otp)).digest('hex');

  const { data: verification, error: fetchErr } = await supabase
    .from('form_verifications')
    .select('id, email, otp_hash, expires_at, verified_at')
    .eq('id', verification_id)
    .eq('form_id', form.id)
    .single();

  if (fetchErr || !verification) {
    return errorResponse(ApiErrors.NOT_FOUND, 'Verification not found');
  }

  if (verification.verified_at) {
    // Already verified — return success (idempotent). Attempt profile lookup too
    // so a page refresh after verification still pre-fills the form.
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select(
        'email, full_name, first_name, middle_name, surname, nickname, bio, ' +
        'phone, phone_country_code, ' +
        'emergency_contact, emergency_contact_number, ' +
        'date_of_birth, ' +
        'address_line1, address_line2, address_city, address_state, address_postcode, address_country, ' +
        'passport_number, passport_expiry, ' +
        'shirt_size, shorts_size'
      )
      .ilike('email', verification.email)
      .maybeSingle();
    return successResponse({ verified: true, email: verification.email, profile: existingProfile ?? null });
  }

  if (new Date(verification.expires_at) < new Date()) {
    return errorResponse(ApiErrors.FORBIDDEN, 'This verification code has expired. Please request a new one.');
  }

  if (verification.otp_hash !== otpHash) {
    return errorResponse(ApiErrors.FORBIDDEN, 'Incorrect verification code');
  }

  // Mark as verified
  const { error: updateErr } = await supabase
    .from('form_verifications')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', verification_id);

  if (updateErr) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, 'Failed to confirm verification');
  }

  // Look up a matching member profile so the form can pre-fill fields —
  // OTP ownership proof is equivalent to being logged in for pre-fill purposes.
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'email, full_name, first_name, middle_name, surname, nickname, bio, ' +
      'phone, phone_country_code, ' +
      'emergency_contact, emergency_contact_number, ' +
      'date_of_birth, ' +
      'address_line1, address_line2, address_city, address_state, address_postcode, address_country, ' +
      'passport_number, passport_expiry, ' +
      'shirt_size, shorts_size'
    )
    .ilike('email', verification.email)
    .maybeSingle();

  return successResponse({
    verified: true,
    email: verification.email,
    profile: profile ?? null,
  });
}
