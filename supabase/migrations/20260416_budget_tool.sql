-- ============================================================
-- BUDGET TOOL MIGRATION
-- Trip budget categories, expenses, and visibility settings
-- ============================================================

-- 1. Budget Settings (one row per trip)
CREATE TABLE IF NOT EXISTS trip_budget_settings (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  total_budget_aud                numeric(12, 2) NOT NULL DEFAULT 0,
  show_group_budget_to_members    boolean NOT NULL DEFAULT true,
  show_individual_breakdown_to_members boolean NOT NULL DEFAULT true,
  exchange_rate_mad_aud           numeric(10, 6) NOT NULL DEFAULT 0.140000,  -- approximate MAD → AUD
  notes                           text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id)
);

-- 2. Budget Categories
CREATE TABLE IF NOT EXISTS trip_budget_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name            text NOT NULL,
  planned_aud     numeric(12, 2) NOT NULL DEFAULT 0,
  color           text NOT NULL DEFAULT '#B5621E',
  sort_order      integer NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Expenses
CREATE TABLE IF NOT EXISTS trip_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES trip_budget_categories(id) ON DELETE SET NULL,
  description     text NOT NULL,
  amount          numeric(12, 2) NOT NULL,
  currency        text NOT NULL DEFAULT 'AUD',   -- 'AUD' | 'MAD' | 'USD' | 'EUR'
  amount_aud      numeric(12, 2) NOT NULL,       -- converted amount stored at entry time
  exchange_rate   numeric(10, 6) NOT NULL DEFAULT 1.0,
  expense_date    date NOT NULL,
  paid_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  receipt_url     text,
  notes           text,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_budget_settings_trip_id  ON trip_budget_settings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_budget_categories_trip_id ON trip_budget_categories(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id         ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_category_id     ON trip_expenses(category_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trip_budget_settings_updated_at  ON trip_budget_settings;
CREATE TRIGGER update_trip_budget_settings_updated_at
  BEFORE UPDATE ON trip_budget_settings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_budget_categories_updated_at ON trip_budget_categories;
CREATE TRIGGER update_trip_budget_categories_updated_at
  BEFORE UPDATE ON trip_budget_categories
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_expenses_updated_at ON trip_expenses;
CREATE TRIGGER update_trip_expenses_updated_at
  BEFORE UPDATE ON trip_expenses
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS Policies
ALTER TABLE trip_budget_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_expenses          ENABLE ROW LEVEL SECURITY;

-- Budget Settings: admins can do everything; members can read (visibility enforced at API layer)
CREATE POLICY "admins_manage_budget_settings" ON trip_budget_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'trip_admin')
    )
  );

CREATE POLICY "members_read_budget_settings" ON trip_budget_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = trip_budget_settings.trip_id
      AND tm.user_id = auth.uid()
    )
  );

-- Budget Categories: admins manage; members read when visibility enabled
CREATE POLICY "admins_manage_budget_categories" ON trip_budget_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'trip_admin')
    )
  );

CREATE POLICY "members_read_budget_categories" ON trip_budget_categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members tm
      JOIN trip_budget_settings tbs ON tbs.trip_id = tm.trip_id
      WHERE tm.trip_id = trip_budget_categories.trip_id
      AND tm.user_id = auth.uid()
      AND tbs.show_group_budget_to_members = true
    )
  );

-- Expenses: admins only (never exposed to members directly)
CREATE POLICY "admins_manage_expenses" ON trip_expenses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'trip_admin')
    )
  );

-- Seed default budget categories for Morocco trip (trip slug = 'morocco-2027')
-- Run only once; safe due to ON CONFLICT DO NOTHING pattern via CTE
-- (Organisers can adjust these from the admin panel)
