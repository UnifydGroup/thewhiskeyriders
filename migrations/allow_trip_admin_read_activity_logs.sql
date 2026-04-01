-- Allow trip admins to read activity logs as part of admin portal access.
-- Safe to run multiple times.
-- @auto-migrate

ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_admin_read ON public.activity_logs;
CREATE POLICY activity_logs_admin_read
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('trip_admin', 'admin', 'super_admin')
  )
);
