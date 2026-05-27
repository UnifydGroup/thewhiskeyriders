-- @auto-migrate
-- Migrate any existing standalone form_fields into the shared form_field_library.
-- This ensures every form field is linked to the library and keeps the library
-- and form_fields data aligned for current and future form fields.

DO $$
DECLARE
  rec RECORD;
  lib_id uuid;
BEGIN
  FOR rec IN
    SELECT id, field_type, label, placeholder, helper_text, options, settings
    FROM form_fields
    WHERE library_field_id IS NULL
  LOOP
    SELECT id INTO lib_id
    FROM form_field_library
    WHERE field_type = rec.field_type
      AND label = rec.label
      AND COALESCE(placeholder, '') = COALESCE(rec.placeholder, '')
      AND COALESCE(helper_text, '') = COALESCE(rec.helper_text, '')
      AND COALESCE(options::text, 'null') = COALESCE(rec.options::text, 'null')
      AND COALESCE(settings::text, 'null') = COALESCE(rec.settings::text, 'null')
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

UPDATE form_field_library lib
SET use_count = (
  SELECT COUNT(*) FROM form_fields ff WHERE ff.library_field_id = lib.id
);
