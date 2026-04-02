-- Adds archive workflow and targeting flags for news posts.
-- Safe to run multiple times.
-- @auto-migrate

ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tag_all_members boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_news_posts_status_publish
  ON public.news_posts (is_archived, is_published, published_at DESC, created_at DESC);

COMMENT ON COLUMN public.news_posts.is_archived IS 'When true, item is hidden from member-facing news feeds';
COMMENT ON COLUMN public.news_posts.archived_at IS 'Timestamp when item was archived';
COMMENT ON COLUMN public.news_posts.is_global IS 'When true, item applies to all trips (not trip-specific)';
COMMENT ON COLUMN public.news_posts.tag_all_members IS 'When true, item applies to all members (not member-specific)';
