-- Add stable User_ID for all profiles
-- Format: WR000001, WR000002, ...

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.profiles_user_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  CACHE 1;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_id text;

CREATE OR REPLACE FUNCTION public.assign_profile_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS NULL OR btrim(NEW.user_id) = '' THEN
    NEW.user_id := 'WR' || lpad(nextval('public.profiles_user_id_seq')::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_user_id ON public.profiles;

CREATE TRIGGER set_profile_user_id
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_profile_user_id();

-- Backfill existing rows that do not yet have a User_ID.
WITH current_max AS (
  SELECT COALESCE(MAX((regexp_match(user_id, '^WR([0-9]{6,})$'))[1]::bigint), 0) AS max_id
  FROM public.profiles
),
missing AS (
  SELECT id, row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.profiles
  WHERE user_id IS NULL OR btrim(user_id) = ''
)
UPDATE public.profiles p
SET user_id = 'WR' || lpad((current_max.max_id + missing.rn)::text, 6, '0')
FROM current_max, missing
WHERE p.id = missing.id;

-- Sync the sequence so future inserts continue from the highest assigned User_ID.
DO $$
DECLARE
  max_user_id bigint;
BEGIN
  SELECT COALESCE(MAX((regexp_match(user_id, '^WR([0-9]{6,})$'))[1]::bigint), 0)
  INTO max_user_id
  FROM public.profiles;

  IF max_user_id = 0 THEN
    PERFORM setval('public.profiles_user_id_seq', 1, false);
  ELSE
    PERFORM setval('public.profiles_user_id_seq', max_user_id, true);
  END IF;
END;
$$;

ALTER TABLE public.profiles
ALTER COLUMN user_id SET DEFAULT ('WR' || lpad(nextval('public.profiles_user_id_seq')::text, 6, '0'));

ALTER TABLE public.profiles
ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique
ON public.profiles(user_id);

COMMIT;
