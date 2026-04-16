-- Fix site settings RLS admin checks to match auth.uid() against profiles.id.
-- Safe to run multiple times.
-- @auto-migrate

DO $$
BEGIN
  IF to_regclass('public.site_settings') IS NULL OR to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'Skipping site settings policy fix because required table is missing.';
  ELSE
    ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

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
  END IF;
END;
$$;
