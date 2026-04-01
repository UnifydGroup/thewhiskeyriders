-- Add dedicated itinerary/schedule content to trips.
ALTER TABLE IF EXISTS public.trips
ADD COLUMN IF NOT EXISTS itinerary text;
