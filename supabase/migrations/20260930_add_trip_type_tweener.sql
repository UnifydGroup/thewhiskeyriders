-- Distinguish official Whiskey Riders trips from "tweeners"
-- (shorter, smaller in-between rides). Existing trips default to 'trip'.
alter table public.trips
  add column if not exists trip_type text not null default 'trip';

alter table public.trips
  drop constraint if exists trips_trip_type_check;
alter table public.trips
  add constraint trips_trip_type_check check (trip_type in ('trip', 'tweener'));

create index if not exists trips_trip_type_idx on public.trips (trip_type);

comment on column public.trips.trip_type is
  'trip = official Whiskey Riders trip; tweener = shorter in-between ride with fewer riders';
