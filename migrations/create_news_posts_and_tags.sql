-- Creates member news posts with trip/member tagging.
-- Safe to run multiple times.
-- @auto-migrate

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_posts_author_id_fkey'
      AND conrelid = 'public.news_posts'::regclass
  ) THEN
    ALTER TABLE public.news_posts
      ADD CONSTRAINT news_posts_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.news_posts
SET published_at = COALESCE(published_at, created_at, now())
WHERE is_published = true
  AND published_at IS NULL;

CREATE TABLE IF NOT EXISTS public.news_post_trips (
  news_post_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_post_id, trip_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_post_trips_news_post_id_fkey'
      AND conrelid = 'public.news_post_trips'::regclass
  ) THEN
    ALTER TABLE public.news_post_trips
      ADD CONSTRAINT news_post_trips_news_post_id_fkey
      FOREIGN KEY (news_post_id) REFERENCES public.news_posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_post_trips_trip_id_fkey'
      AND conrelid = 'public.news_post_trips'::regclass
  ) THEN
    ALTER TABLE public.news_post_trips
      ADD CONSTRAINT news_post_trips_trip_id_fkey
      FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.news_post_members (
  news_post_id uuid NOT NULL,
  member_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_post_id, member_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_post_members_news_post_id_fkey'
      AND conrelid = 'public.news_post_members'::regclass
  ) THEN
    ALTER TABLE public.news_post_members
      ADD CONSTRAINT news_post_members_news_post_id_fkey
      FOREIGN KEY (news_post_id) REFERENCES public.news_posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_post_members_member_id_fkey'
      AND conrelid = 'public.news_post_members'::regclass
  ) THEN
    ALTER TABLE public.news_post_members
      ADD CONSTRAINT news_post_members_member_id_fkey
      FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_news_posts_published_at_desc
  ON public.news_posts (is_published, published_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_post_trips_trip_id
  ON public.news_post_trips (trip_id);
CREATE INDEX IF NOT EXISTS idx_news_post_members_member_id
  ON public.news_post_members (member_id);

CREATE OR REPLACE FUNCTION public.set_news_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.is_published AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;

  IF NOT NEW.is_published THEN
    NEW.published_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_news_posts_updated_at ON public.news_posts;
CREATE TRIGGER trg_set_news_posts_updated_at
BEFORE UPDATE ON public.news_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_news_posts_updated_at();

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_post_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_post_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS news_posts_read_authenticated ON public.news_posts;
CREATE POLICY news_posts_read_authenticated
ON public.news_posts
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS news_posts_admin_write ON public.news_posts;
CREATE POLICY news_posts_admin_write
ON public.news_posts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('trip_admin', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('trip_admin', 'admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS news_post_trips_read_authenticated ON public.news_post_trips;
CREATE POLICY news_post_trips_read_authenticated
ON public.news_post_trips
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS news_post_trips_admin_write ON public.news_post_trips;
CREATE POLICY news_post_trips_admin_write
ON public.news_post_trips
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('trip_admin', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('trip_admin', 'admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS news_post_members_read_authenticated ON public.news_post_members;
CREATE POLICY news_post_members_read_authenticated
ON public.news_post_members
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS news_post_members_admin_write ON public.news_post_members;
CREATE POLICY news_post_members_admin_write
ON public.news_post_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('trip_admin', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('trip_admin', 'admin', 'super_admin')
  )
);

GRANT SELECT ON public.news_posts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT SELECT ON public.news_post_trips TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_post_trips TO authenticated;
GRANT SELECT ON public.news_post_members TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_post_members TO authenticated;
