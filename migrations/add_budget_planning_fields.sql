-- @auto-migrate
-- Add planning/headcount fields to trip_budget_settings
-- projected_member_count: admin-set estimate for pre-confirmation planning mode
-- When null, the live trip member count is used instead

ALTER TABLE public.trip_budget_settings
  ADD COLUMN IF NOT EXISTS projected_member_count integer;
