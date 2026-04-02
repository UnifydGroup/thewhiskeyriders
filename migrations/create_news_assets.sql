-- Creates persisted asset metadata for rich news content.
-- Safe to run multiple times.
-- @auto-migrate

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.news_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_url text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_assets_uploaded_by_fkey'
      AND conrelid = 'public.news_assets'::regclass
  ) THEN
    ALTER TABLE public.news_assets
      ADD CONSTRAINT news_assets_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_news_assets_created_at_desc
  ON public.news_assets (created_at DESC);

ALTER TABLE public.news_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS news_assets_read_authenticated ON public.news_assets;
CREATE POLICY news_assets_read_authenticated
ON public.news_assets
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS news_assets_admin_write ON public.news_assets;
CREATE POLICY news_assets_admin_write
ON public.news_assets
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

GRANT SELECT ON public.news_assets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_assets TO authenticated;
