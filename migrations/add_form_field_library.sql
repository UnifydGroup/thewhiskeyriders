-- @auto-migrate
-- ============================================================
-- Form Field Library
-- A shared pool of canonical field definitions that any form
-- can reference. When multiple forms use the same library field,
-- their responses share the same library_field_id — enabling
-- cross-form data alignment and aggregation.
--
-- form_fields.library_field_id (nullable FK → form_field_library)
--   SET    → field was picked from (or saved to) the library
--   NULL   → field is form-specific / one-off
--
-- To align data across forms:
--   SELECT frv.* FROM form_response_values frv
--   JOIN form_fields ff ON ff.id = frv.field_id
--   WHERE ff.library_field_id = '<library_field_id>'
-- ============================================================

-- ── 1. form_field_library ────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_field_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_type    text NOT NULL
                CHECK (field_type IN (
                  'short_text','long_text','number','currency',
                  'date','date_range',
                  'single_choice','multiple_choice','dropdown',
                  'file_upload','yes_no',
                  'section_header','acknowledgement'
                )),
  label         text NOT NULL,
  description   text,           -- admin notes / purpose of this field
  placeholder   text,
  helper_text   text,
  options       jsonb,          -- choice field options, e.g. ["O+","O-","A+",...]
  settings      jsonb,          -- field-specific settings
  category      text,           -- e.g. "Travel", "Medical", "Trip", "Personal"
  use_count     int NOT NULL DEFAULT 0,   -- how many form_fields reference this
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Add library_field_id to form_fields ───────────────────
ALTER TABLE form_fields
  ADD COLUMN IF NOT EXISTS library_field_id uuid
    REFERENCES form_field_library(id) ON DELETE SET NULL;

-- ── 3. Migrate existing form_fields into the library ─────────
-- For every existing form_fields row that has no library_field_id,
-- create a library entry from its definition and link it back.
DO $$
DECLARE
  rec     RECORD;
  lib_id  uuid;
BEGIN
  FOR rec IN
    SELECT * FROM form_fields WHERE library_field_id IS NULL
  LOOP
    -- Reuse an existing library entry if label + field_type already exists
    SELECT id INTO lib_id
    FROM form_field_library
    WHERE label = rec.label AND field_type = rec.field_type
    LIMIT 1;

    IF lib_id IS NULL THEN
      INSERT INTO form_field_library (
        field_type, label, placeholder, helper_text, options, settings, created_by
      ) VALUES (
        rec.field_type, rec.label, rec.placeholder, rec.helper_text,
        rec.options, rec.settings, NULL
      )
      RETURNING id INTO lib_id;
    END IF;

    UPDATE form_fields SET library_field_id = lib_id WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ── 4. Sync use_count ────────────────────────────────────────
UPDATE form_field_library lib
SET use_count = (
  SELECT COUNT(*) FROM form_fields ff WHERE ff.library_field_id = lib.id
);

-- ── 5. Function: increment/decrement use_count ──────────────
CREATE OR REPLACE FUNCTION sync_library_use_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.library_field_id IS NOT NULL THEN
    UPDATE form_field_library SET use_count = use_count + 1
    WHERE id = NEW.library_field_id;
  ELSIF TG_OP = 'DELETE' AND OLD.library_field_id IS NOT NULL THEN
    UPDATE form_field_library SET use_count = GREATEST(0, use_count - 1)
    WHERE id = OLD.library_field_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.library_field_id IS DISTINCT FROM NEW.library_field_id THEN
      IF OLD.library_field_id IS NOT NULL THEN
        UPDATE form_field_library SET use_count = GREATEST(0, use_count - 1)
        WHERE id = OLD.library_field_id;
      END IF;
      IF NEW.library_field_id IS NOT NULL THEN
        UPDATE form_field_library SET use_count = use_count + 1
        WHERE id = NEW.library_field_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_form_fields_use_count ON form_fields;
CREATE TRIGGER trg_form_fields_use_count
  AFTER INSERT OR UPDATE OR DELETE ON form_fields
  FOR EACH ROW EXECUTE FUNCTION sync_library_use_count();

-- ── 6. updated_at trigger for library ───────────────────────
CREATE OR REPLACE FUNCTION update_field_library_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_field_library_updated_at ON form_field_library;
CREATE TRIGGER trg_field_library_updated_at
  BEFORE UPDATE ON form_field_library
  FOR EACH ROW EXECUTE FUNCTION update_field_library_updated_at();

-- ── 7. Index ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_form_fields_library_id ON form_fields(library_field_id);
CREATE INDEX IF NOT EXISTS idx_field_library_label    ON form_field_library(label);
CREATE INDEX IF NOT EXISTS idx_field_library_category ON form_field_library(category);

-- ── 8. RLS ───────────────────────────────────────────────────
ALTER TABLE form_field_library ENABLE ROW LEVEL SECURITY;

-- Admins can manage the library
DROP POLICY IF EXISTS "admins_manage_field_library" ON form_field_library;
CREATE POLICY "admins_manage_field_library" ON form_field_library
  FOR ALL USING (current_user_role() IN ('super_admin','admin','trip_admin'));

-- All authenticated users can read the library (needed to build forms)
DROP POLICY IF EXISTS "members_read_field_library" ON form_field_library;
CREATE POLICY "members_read_field_library" ON form_field_library
  FOR SELECT USING (auth.uid() IS NOT NULL);
