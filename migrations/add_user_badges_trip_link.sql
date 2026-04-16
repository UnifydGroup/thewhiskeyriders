-- Enforce trip linkage for every badge assignment.
-- A user_badges row must:
-- 1) include a trip_id,
-- 2) match the badge's trip_id when badge is trip-specific,
-- 3) belong to a member of that trip.

BEGIN;

ALTER TABLE public.user_badges
ADD COLUMN IF NOT EXISTS trip_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_badges_trip_id_fkey'
      AND conrelid = 'public.user_badges'::regclass
  ) THEN
    ALTER TABLE public.user_badges
    ADD CONSTRAINT user_badges_trip_id_fkey
    FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Backfill from badge trip where possible.
UPDATE public.user_badges ub
SET trip_id = b.trip_id
FROM public.badges b
WHERE ub.badge_id = b.id
  AND ub.trip_id IS NULL
  AND b.trip_id IS NOT NULL;

-- Fallback: use the user's most recent trip membership when badge trip is global/null.
WITH ranked_membership AS (
  SELECT
    tm.user_id,
    tm.trip_id,
    ROW_NUMBER() OVER (
      PARTITION BY tm.user_id
      ORDER BY tm.joined_at DESC NULLS LAST, tm.trip_id
    ) AS rn
  FROM public.trip_members tm
)
UPDATE public.user_badges ub
SET trip_id = rm.trip_id
FROM ranked_membership rm
WHERE ub.user_id = rm.user_id
  AND rm.rn = 1
  AND ub.trip_id IS NULL;

-- Remove accidental duplicates before creating the new unique index.
WITH ranked_badges AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, badge_id, trip_id
      ORDER BY awarded_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.user_badges
)
DELETE FROM public.user_badges ub
USING ranked_badges rb
WHERE ub.id = rb.id
  AND rb.rn > 1;

-- Replace legacy uniqueness (user_id, badge_id) with trip-aware uniqueness.
ALTER TABLE public.user_badges
DROP CONSTRAINT IF EXISTS user_badges_user_id_badge_id_key;

DROP INDEX IF EXISTS public.user_badges_user_id_badge_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_badges_user_badge_trip_key
ON public.user_badges (user_id, badge_id, trip_id);

DO $$
DECLARE
  missing_trip_links bigint;
BEGIN
  SELECT COUNT(*)
  INTO missing_trip_links
  FROM public.user_badges
  WHERE trip_id IS NULL;

  IF missing_trip_links = 0 THEN
    ALTER TABLE public.user_badges
    ALTER COLUMN trip_id SET NOT NULL;
  ELSE
    RAISE NOTICE
      'user_badges has % row(s) without trip_id after backfill; NOT NULL constraint was not applied',
      missing_trip_links;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_user_badge_trip_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  badge_trip_id uuid;
BEGIN
  IF NEW.trip_id IS NULL THEN
    RAISE EXCEPTION 'trip_id is required when assigning a badge';
  END IF;

  SELECT b.trip_id
  INTO badge_trip_id
  FROM public.badges b
  WHERE b.id = NEW.badge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge % does not exist', NEW.badge_id;
  END IF;

  IF badge_trip_id IS NOT NULL AND badge_trip_id <> NEW.trip_id THEN
    RAISE EXCEPTION
      'Badge % is tied to trip %, cannot assign it to trip %',
      NEW.badge_id,
      badge_trip_id,
      NEW.trip_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.user_id = NEW.user_id
      AND tm.trip_id = NEW.trip_id
  ) THEN
    RAISE EXCEPTION
      'User % is not a member of trip %',
      NEW.user_id,
      NEW.trip_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_badge_trip_link_trigger ON public.user_badges;

CREATE TRIGGER enforce_user_badge_trip_link_trigger
BEFORE INSERT OR UPDATE OF user_id, badge_id, trip_id
ON public.user_badges
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_badge_trip_link();

COMMIT;
