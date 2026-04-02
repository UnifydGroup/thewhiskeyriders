-- @auto-migrate
-- Add countdown controls to trips table
-- countdown_enabled: toggles whether this trip is eligible for the portal countdown widget
-- countdown_target_at: optional explicit countdown target; falls back to trip start_date when null

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS countdown_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS countdown_target_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN trips.countdown_enabled IS 'Enable/disable countdown display eligibility for this trip';
COMMENT ON COLUMN trips.countdown_target_at IS 'Optional explicit countdown target timestamp (falls back to start_date when null)';
