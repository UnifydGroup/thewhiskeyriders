-- Creates the email campaigns system for sending direct emails to members.
-- This is separate from news post notifications — campaigns are standalone
-- composed emails with their own delivery tracking.
-- Safe to run multiple times.
-- @auto-migrate

-- Main campaigns table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  is_global boolean NOT NULL DEFAULT false,
  tag_all_members boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_campaigns IS 'Standalone email campaigns composed and sent by admins to members';
COMMENT ON COLUMN public.email_campaigns.is_global IS 'When true, not tied to a specific trip — sent to all targeted members';
COMMENT ON COLUMN public.email_campaigns.tag_all_members IS 'When true, overrides member targeting and sends to all active members';

-- Auto-update trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_email_campaigns_updated_at'
      AND tgrelid = 'public.email_campaigns'::regclass
  ) THEN
    CREATE TRIGGER set_email_campaigns_updated_at
      BEFORE UPDATE ON public.email_campaigns
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- Trip targeting junction
CREATE TABLE IF NOT EXISTS public.email_campaign_trips (
  email_campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email_campaign_id, trip_id)
);

-- Member targeting junction
CREATE TABLE IF NOT EXISTS public.email_campaign_members (
  email_campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email_campaign_id, member_id)
);

-- Delivery tracking
CREATE TABLE IF NOT EXISTS public.email_campaign_deliveries (
  email_campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email_campaign_id, member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status
  ON public.email_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_sent_at_desc
  ON public.email_campaigns (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_trips_trip_id
  ON public.email_campaign_trips (trip_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_members_member_id
  ON public.email_campaign_members (member_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_deliveries_member_id
  ON public.email_campaign_deliveries (member_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_deliveries_sent_at
  ON public.email_campaign_deliveries (sent_at DESC);

-- RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_deliveries ENABLE ROW LEVEL SECURITY;

-- email_campaigns: admins can do everything; members cannot see drafts
DROP POLICY IF EXISTS email_campaigns_admin_all ON public.email_campaigns;
CREATE POLICY email_campaigns_admin_all
ON public.email_campaigns
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
);

-- junction tables: admin only
DROP POLICY IF EXISTS email_campaign_trips_admin_all ON public.email_campaign_trips;
CREATE POLICY email_campaign_trips_admin_all
ON public.email_campaign_trips
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
);

DROP POLICY IF EXISTS email_campaign_members_admin_all ON public.email_campaign_members;
CREATE POLICY email_campaign_members_admin_all
ON public.email_campaign_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
);

DROP POLICY IF EXISTS email_campaign_deliveries_admin_read ON public.email_campaign_deliveries;
CREATE POLICY email_campaign_deliveries_admin_read
ON public.email_campaign_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin', 'trip_admin')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_members TO authenticated;
GRANT SELECT ON public.email_campaign_deliveries TO authenticated;
