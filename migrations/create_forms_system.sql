-- @auto-migrate
-- ============================================================
-- Forms System
-- Allows admins to create dynamic forms, assign them to members,
-- and collect/view responses. Responses live on member profiles
-- with a public/private visibility toggle.
-- ============================================================

-- ── 1. forms ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  slug          text UNIQUE NOT NULL,           -- used in shareable URL
  token         text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'), -- public share token
  trip_id       uuid REFERENCES trips(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'draft'   -- draft | active | closed
                CHECK (status IN ('draft','active','closed')),
  allow_multiple_submissions boolean NOT NULL DEFAULT false,
  submission_deadline timestamptz,
  notify_on_submission boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. form_fields ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  field_type    text NOT NULL
                CHECK (field_type IN (
                  'short_text','long_text','number','currency',
                  'date','date_range',
                  'single_choice','multiple_choice','dropdown',
                  'file_upload','yes_no',
                  'section_header','acknowledgement'
                )),
  label         text NOT NULL,
  placeholder   text,
  helper_text   text,
  is_required   boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  options       jsonb,   -- array of strings for choice fields, e.g. ["Option A","Option B"]
  settings      jsonb,   -- field-specific settings, e.g. {"max_size_mb": 5, "accept": "image/*,.pdf"}
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 3. form_assignments ─────────────────────────────────────
-- Tracks which members have been assigned a form (or have been
-- sent it via email). A form can also be used as a generic
-- public link without an assignment row.
CREATE TABLE IF NOT EXISTS form_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  UNIQUE (form_id, member_id)
);

-- ── 4. form_responses ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  member_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null = anonymous public submission
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  -- visibility: member can toggle their own response
  is_public     boolean NOT NULL DEFAULT false,   -- true = visible on their public profile
  ip_address    text   -- lightweight spam protection
);

-- ── 5. form_response_values ─────────────────────────────────
CREATE TABLE IF NOT EXISTS form_response_values (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   uuid NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id      uuid NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  value_text    text,
  value_json    jsonb,  -- for multi-select, file metadata, date ranges
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id        ON form_fields(form_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_form_assignments_form_id   ON form_assignments(form_id);
CREATE INDEX IF NOT EXISTS idx_form_assignments_member_id ON form_assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id     ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_member_id   ON form_responses(member_id);
CREATE INDEX IF NOT EXISTS idx_form_response_values_resp  ON form_response_values(response_id);

-- ── updated_at trigger for forms ────────────────────────────
CREATE OR REPLACE FUNCTION update_forms_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forms_updated_at ON forms;
CREATE TRIGGER trg_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION update_forms_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE forms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields          ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_response_values ENABLE ROW LEVEL SECURITY;

-- Helper: current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid()::text LIMIT 1;
$$;

-- ── forms policies ──────────────────────────────────────────
-- Admins can do anything
DROP POLICY IF EXISTS "admins_manage_forms" ON forms;
CREATE POLICY "admins_manage_forms" ON forms
  FOR ALL USING (current_user_role() IN ('super_admin','admin','trip_admin'));

-- Members can read active forms they've been assigned
DROP POLICY IF EXISTS "members_read_assigned_forms" ON forms;
CREATE POLICY "members_read_assigned_forms" ON forms
  FOR SELECT USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM form_assignments fa
      JOIN profiles p ON p.id = fa.member_id
      WHERE fa.form_id = forms.id AND p.user_id = auth.uid()::text
    )
  );

-- Anyone can read active forms by token (public link access handled in API)
DROP POLICY IF EXISTS "public_read_active_forms" ON forms;
CREATE POLICY "public_read_active_forms" ON forms
  FOR SELECT USING (status = 'active');

-- ── form_fields policies ────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_fields" ON form_fields;
CREATE POLICY "admins_manage_fields" ON form_fields
  FOR ALL USING (current_user_role() IN ('super_admin','admin','trip_admin'));

DROP POLICY IF EXISTS "members_read_fields" ON form_fields;
CREATE POLICY "members_read_fields" ON form_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM forms f WHERE f.id = form_fields.form_id AND f.status = 'active'
    )
  );

-- ── form_assignments policies ───────────────────────────────
DROP POLICY IF EXISTS "admins_manage_assignments" ON form_assignments;
CREATE POLICY "admins_manage_assignments" ON form_assignments
  FOR ALL USING (current_user_role() IN ('super_admin','admin','trip_admin'));

DROP POLICY IF EXISTS "members_read_own_assignments" ON form_assignments;
CREATE POLICY "members_read_own_assignments" ON form_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = form_assignments.member_id AND p.user_id = auth.uid()::text
    )
  );

-- ── form_responses policies ─────────────────────────────────
DROP POLICY IF EXISTS "admins_read_all_responses" ON form_responses;
CREATE POLICY "admins_read_all_responses" ON form_responses
  FOR ALL USING (current_user_role() IN ('super_admin','admin','trip_admin'));

-- Members can insert and read their own responses
DROP POLICY IF EXISTS "members_insert_responses" ON form_responses;
CREATE POLICY "members_insert_responses" ON form_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = form_responses.member_id AND p.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "members_read_own_responses" ON form_responses;
CREATE POLICY "members_read_own_responses" ON form_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = form_responses.member_id AND p.user_id = auth.uid()::text
    )
  );

-- Members can toggle their own response visibility
DROP POLICY IF EXISTS "members_update_own_response_visibility" ON form_responses;
CREATE POLICY "members_update_own_response_visibility" ON form_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = form_responses.member_id AND p.user_id = auth.uid()::text
    )
  );

-- Public profile: anyone can read public responses
DROP POLICY IF EXISTS "public_read_public_responses" ON form_responses;
CREATE POLICY "public_read_public_responses" ON form_responses
  FOR SELECT USING (is_public = true);

-- ── form_response_values policies ──────────────────────────
DROP POLICY IF EXISTS "admins_read_all_values" ON form_response_values;
CREATE POLICY "admins_read_all_values" ON form_response_values
  FOR ALL USING (current_user_role() IN ('super_admin','admin','trip_admin'));

DROP POLICY IF EXISTS "members_insert_values" ON form_response_values;
CREATE POLICY "members_insert_values" ON form_response_values
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM form_responses fr
      JOIN profiles p ON p.id = fr.member_id
      WHERE fr.id = form_response_values.response_id AND p.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "members_read_own_values" ON form_response_values;
CREATE POLICY "members_read_own_values" ON form_response_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM form_responses fr
      JOIN profiles p ON p.id = fr.member_id
      WHERE fr.id = form_response_values.response_id AND p.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "public_read_public_values" ON form_response_values;
CREATE POLICY "public_read_public_values" ON form_response_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM form_responses fr WHERE fr.id = form_response_values.response_id AND fr.is_public = true
    )
  );
