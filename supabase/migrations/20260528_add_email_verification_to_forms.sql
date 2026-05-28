-- Add email verification toggle to forms
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS require_email_verification boolean NOT NULL DEFAULT false;

-- Table to store OTP challenges for form email verification
CREATE TABLE IF NOT EXISTS form_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  email        text NOT NULL,
  otp_hash     text NOT NULL,         -- SHA-256 hex of the 6-digit OTP
  expires_at   timestamptz NOT NULL,
  verified_at  timestamptz,           -- set when OTP confirmed
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_verifications_form_email
  ON form_verifications(form_id, email);

CREATE INDEX IF NOT EXISTS idx_form_verifications_expires
  ON form_verifications(expires_at);

-- RLS: only service role can read/write (API uses service role key)
ALTER TABLE form_verifications ENABLE ROW LEVEL SECURITY;
