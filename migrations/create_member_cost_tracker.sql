-- @auto-migrate
-- Member Cost Tracker tables for Financial Manager.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.trip_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_cost_items_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.member_cost_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cost_item_id uuid NOT NULL REFERENCES public.trip_cost_items(id) ON DELETE CASCADE,
  is_self_funded boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, member_id, cost_item_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_cost_items_trip_id
  ON public.trip_cost_items(trip_id);

CREATE INDEX IF NOT EXISTS idx_member_cost_assignments_trip_id
  ON public.member_cost_assignments(trip_id);

CREATE INDEX IF NOT EXISTS idx_member_cost_assignments_cost_item_id
  ON public.member_cost_assignments(cost_item_id);

DROP TRIGGER IF EXISTS update_trip_cost_items_updated_at ON public.trip_cost_items;
CREATE TRIGGER update_trip_cost_items_updated_at
  BEFORE UPDATE ON public.trip_cost_items
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_cost_assignments_updated_at ON public.member_cost_assignments;
CREATE TRIGGER update_member_cost_assignments_updated_at
  BEFORE UPDATE ON public.member_cost_assignments
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.trip_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_cost_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_trip_cost_items" ON public.trip_cost_items;
CREATE POLICY "admins_manage_trip_cost_items" ON public.trip_cost_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'trip_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'trip_admin')
    )
  );

DROP POLICY IF EXISTS "trip_members_read_trip_cost_items" ON public.trip_cost_items;
CREATE POLICY "trip_members_read_trip_cost_items" ON public.trip_cost_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_cost_items.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admins_manage_member_cost_assignments" ON public.member_cost_assignments;
CREATE POLICY "admins_manage_member_cost_assignments" ON public.member_cost_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'trip_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'trip_admin')
    )
  );

DROP POLICY IF EXISTS "trip_members_read_member_cost_assignments" ON public.member_cost_assignments;
CREATE POLICY "trip_members_read_member_cost_assignments" ON public.member_cost_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = member_cost_assignments.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );
