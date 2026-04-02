-- Creates site settings used by the landing page and admin branding controls.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text NOT NULL DEFAULT '/3.png',
  background_image_url text NOT NULL DEFAULT '/swirl-bg.svg',
  background_position_x integer NOT NULL DEFAULT 50,
  background_position_y integer NOT NULL DEFAULT 50,
  background_zoom integer NOT NULL DEFAULT 100,
  background_opacity integer NOT NULL DEFAULT 40,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_background_position_x_check CHECK (background_position_x BETWEEN 0 AND 100),
  CONSTRAINT site_settings_background_position_y_check CHECK (background_position_y BETWEEN 0 AND 100),
  CONSTRAINT site_settings_background_zoom_check CHECK (background_zoom BETWEEN 25 AND 300),
  CONSTRAINT site_settings_background_opacity_check CHECK (background_opacity BETWEEN 0 AND 100)
);

ALTER TABLE IF EXISTS public.site_settings
  ADD COLUMN IF NOT EXISTS background_position_x integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS background_position_y integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS background_zoom integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS background_opacity integer NOT NULL DEFAULT 40;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_background_position_x_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_background_position_x_check CHECK (background_position_x BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_background_position_y_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_background_position_y_check CHECK (background_position_y BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_background_zoom_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_background_zoom_check CHECK (background_zoom BETWEEN 25 AND 300);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_background_opacity_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_background_opacity_check CHECK (background_opacity BETWEEN 0 AND 100);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_site_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_site_settings_updated_at ON public.site_settings;

CREATE TRIGGER trg_set_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_site_settings_updated_at();

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;
CREATE POLICY site_settings_public_read
ON public.site_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS site_settings_admin_insert ON public.site_settings;
CREATE POLICY site_settings_admin_insert
ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS site_settings_admin_update ON public.site_settings;
CREATE POLICY site_settings_admin_update
ON public.site_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id::text = auth.uid()::text OR p.user_id::text = auth.uid()::text)
      AND p.role IN ('admin', 'super_admin')
  )
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;

INSERT INTO public.site_settings (
  logo_url,
  background_image_url,
  background_position_x,
  background_position_y,
  background_zoom,
  background_opacity,
  updated_by
)
SELECT
  '/3.png',
  '/swirl-bg.svg',
  50,
  50,
  100,
  40,
  'system'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);
