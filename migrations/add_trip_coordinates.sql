-- Add map coordinates and country code to trips table
-- latitude / longitude: decimal coordinates for the trip pin on the world map
-- country_code: ISO 3166-1 alpha-3 (e.g. 'MAR' for Morocco, 'ESP' for Spain)
--   Used to highlight visited countries on the map.
--   Reference: https://www.iban.com/country-codes

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10, 7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(3)  DEFAULT NULL;

COMMENT ON COLUMN trips.latitude     IS 'Decimal latitude for map pin (e.g. 31.7917 for Morocco)';
COMMENT ON COLUMN trips.longitude    IS 'Decimal longitude for map pin (e.g. -7.0926 for Morocco)';
COMMENT ON COLUMN trips.country_code IS 'ISO 3166-1 alpha-3 country code for country highlighting (e.g. MAR, ESP, AUS)';
