-- Trip itinerary segments
-- Replaces the free-text itinerary field with structured per-segment records

create table if not exists public.trip_itinerary_segments (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,

  -- Ordering
  date            date not null,
  sort_order      integer not null default 0,

  -- Core fields
  category        text not null check (category in ('flight', 'transfer', 'accommodation', 'activity')),
  title           text not null,
  location_from   text,
  location_to     text,
  start_time      time,
  end_time        time,

  -- Booking / status
  reference_number  text,
  status            text not null default 'pending'
                    check (status in ('paid', 'partially_paid', 'confirmed', 'booked', 'pending', 'cancelled')),

  -- Contacts: JSON array of { name, phone, role }
  contacts        jsonb not null default '[]'::jsonb,

  -- Descriptions
  member_description  text,   -- shown to members when visible
  internal_notes      text,   -- admin only, never shown to members

  -- Visibility
  member_visible  boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for ordered retrieval
create index if not exists trip_itinerary_segments_trip_date_idx
  on public.trip_itinerary_segments (trip_id, date, sort_order);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trip_itinerary_segments_updated_at on public.trip_itinerary_segments;
create trigger trip_itinerary_segments_updated_at
  before update on public.trip_itinerary_segments
  for each row execute function public.set_updated_at();

-- RLS
alter table public.trip_itinerary_segments enable row level security;

-- Admins: full access
create policy "Admins can manage itinerary segments"
  on public.trip_itinerary_segments
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin', 'trip_admin')
    )
  );

-- Members: read-only, member_visible segments only, and only for trips they belong to
create policy "Members can view visible itinerary segments"
  on public.trip_itinerary_segments
  for select
  using (
    member_visible = true
    and exists (
      select 1 from public.trip_members
      where trip_members.trip_id = trip_itinerary_segments.trip_id
        and trip_members.user_id = auth.uid()
    )
  );
