-- ============================================================
-- TRIP PAYMENT SETTINGS
-- Per-trip payment options and bank details used by payment tracker/schedule
-- ============================================================

CREATE TABLE IF NOT EXISTS trip_payment_settings (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                       uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  flights_cost_aud              numeric(12, 2) NOT NULL DEFAULT 0,

  show_payment_options          boolean NOT NULL DEFAULT true,
  monthly_option_title          text NOT NULL DEFAULT 'Monthly Option',
  monthly_option_amount_label   text,
  monthly_option_description    text,
  quarterly_option_title        text NOT NULL DEFAULT 'Quarterly Option',
  quarterly_option_amount_label text,
  quarterly_option_description  text,

  show_bank_details             boolean NOT NULL DEFAULT true,
  bank_account_name             text,
  bank_bsb                      text,
  bank_account_number           text,
  bank_payid                    text,
  bank_notes                    text,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (trip_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_payment_settings_trip_id
  ON trip_payment_settings(trip_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trip_payment_settings_updated_at
  ON trip_payment_settings;

CREATE TRIGGER update_trip_payment_settings_updated_at
  BEFORE UPDATE ON trip_payment_settings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE trip_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_trip_payment_settings" ON trip_payment_settings;
CREATE POLICY "admins_manage_trip_payment_settings" ON trip_payment_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'trip_admin')
    )
  );

DROP POLICY IF EXISTS "members_read_trip_payment_settings" ON trip_payment_settings;
CREATE POLICY "members_read_trip_payment_settings" ON trip_payment_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM trip_members tm
      WHERE tm.trip_id = trip_payment_settings.trip_id
      AND tm.user_id = auth.uid()
    )
  );

-- Seed the current Morocco 2027 configuration so existing behaviour is preserved.
INSERT INTO trip_payment_settings (
  trip_id,
  flights_cost_aud,
  show_payment_options,
  monthly_option_title,
  monthly_option_amount_label,
  monthly_option_description,
  quarterly_option_title,
  quarterly_option_amount_label,
  quarterly_option_description,
  show_bank_details,
  bank_account_name,
  bank_bsb,
  bank_account_number,
  bank_payid,
  bank_notes
)
SELECT
  t.id,
  2500.00,
  true,
  'Monthly Option',
  '$250 per month',
  'Initial $500 deposit, then 19 × $250',
  'Quarterly Option',
  '$750 per quarter',
  'Initial $500 deposit, then 6 × $750',
  true,
  'Andreas Gloor',
  '732 728',
  '524337',
  '0409 651 993',
  NULL
FROM trips t
WHERE lower(t.slug) = 'morocco-2027'
   OR lower(t.name) = 'morocco 2027'
ON CONFLICT (trip_id) DO NOTHING;
