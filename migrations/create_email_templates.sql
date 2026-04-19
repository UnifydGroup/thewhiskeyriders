-- Email Templates
-- Reusable subject + body templates for email campaigns.
-- Admins can create, edit, and delete templates; any admin can use them when composing a campaign.

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  subject       text NOT NULL,
  body          text NOT NULL,
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_email_templates_updated_at'
      AND tgrelid = 'email_templates'::regclass
  ) THEN
    CREATE TRIGGER update_email_templates_updated_at
      BEFORE UPDATE ON email_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Admins and above can read all templates
CREATE POLICY "Admins can read email_templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trip_admin', 'admin', 'super_admin')
        AND profiles.status = 'active'
    )
  );

-- Admins and above can insert templates
CREATE POLICY "Admins can insert email_templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trip_admin', 'admin', 'super_admin')
        AND profiles.status = 'active'
    )
  );

-- Admins and above can update templates
CREATE POLICY "Admins can update email_templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trip_admin', 'admin', 'super_admin')
        AND profiles.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trip_admin', 'admin', 'super_admin')
        AND profiles.status = 'active'
    )
  );

-- Admins and above can delete templates
CREATE POLICY "Admins can delete email_templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trip_admin', 'admin', 'super_admin')
        AND profiles.status = 'active'
    )
  );

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS email_templates_created_at_idx ON email_templates (created_at DESC);
CREATE INDEX IF NOT EXISTS email_templates_created_by_idx ON email_templates (created_by);

-- ─── Email header settings ───────────────────────────────────────────────────
-- Adds configurable header title and tagline to site_settings so the branded
-- email shell can be personalised without touching code.

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS email_header_title   text NOT NULL DEFAULT 'The Whiskey Riders',
  ADD COLUMN IF NOT EXISTS email_header_tagline  text NOT NULL DEFAULT 'Ride. Bond. Remember.';
