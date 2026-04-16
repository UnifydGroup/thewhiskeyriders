-- Adds a persisted admin toggle for news emails and delivery tracking.
-- Safe to run multiple times.
-- @auto-migrate

ALTER TABLE IF EXISTS public.site_settings
  ADD COLUMN IF NOT EXISTS news_email_notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.site_settings.news_email_notifications_enabled IS 'When false, member emails for published news posts are disabled globally';

CREATE TABLE IF NOT EXISTS public.news_email_deliveries (
  news_post_id uuid NOT NULL,
  member_id uuid NOT NULL,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_post_id, member_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_email_deliveries_news_post_id_fkey'
      AND conrelid = 'public.news_email_deliveries'::regclass
  ) THEN
    ALTER TABLE public.news_email_deliveries
      ADD CONSTRAINT news_email_deliveries_news_post_id_fkey
      FOREIGN KEY (news_post_id) REFERENCES public.news_posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_email_deliveries_member_id_fkey'
      AND conrelid = 'public.news_email_deliveries'::regclass
  ) THEN
    ALTER TABLE public.news_email_deliveries
      ADD CONSTRAINT news_email_deliveries_member_id_fkey
      FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_news_email_deliveries_member_id
  ON public.news_email_deliveries (member_id);

CREATE INDEX IF NOT EXISTS idx_news_email_deliveries_sent_at
  ON public.news_email_deliveries (sent_at DESC);

ALTER TABLE public.news_email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS news_email_deliveries_admin_read ON public.news_email_deliveries;
CREATE POLICY news_email_deliveries_admin_read
ON public.news_email_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
);

GRANT SELECT ON public.news_email_deliveries TO authenticated;
