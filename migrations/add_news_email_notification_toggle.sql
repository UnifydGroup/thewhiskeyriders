-- Adds a per-post email notification toggle to news_posts.
-- When false, no member emails are sent when this post is published,
-- even if the global site_settings toggle is enabled.
-- Safe to run multiple times.
-- @auto-migrate

ALTER TABLE IF EXISTS public.news_posts
  ADD COLUMN IF NOT EXISTS send_email_notification boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.news_posts.send_email_notification IS 'When false, member notification emails are suppressed for this post even if global email notifications are enabled';
