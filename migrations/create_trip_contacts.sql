-- @auto-migrate
-- Trip-level key contacts (guides, accommodation, embassy, insurance, emergency, etc.)
-- shown together with itinerary and documents in the Trip Bible.

create table if not exists public.trip_contacts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null default 'general',
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  sort_order integer not null default 0,
  member_visible boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_contacts_trip_id_idx on public.trip_contacts(trip_id);

alter table public.trip_contacts enable row level security;

drop policy if exists "admins_manage_trip_contacts" on public.trip_contacts;
create policy "admins_manage_trip_contacts"
  on public.trip_contacts
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['admin', 'super_admin', 'trip_admin'])
    )
  );

drop policy if exists "members_view_visible_trip_contacts" on public.trip_contacts;
create policy "members_view_visible_trip_contacts"
  on public.trip_contacts
  for select
  using (
    member_visible = true
    and exists (
      select 1 from public.trip_members
      where trip_members.trip_id = trip_contacts.trip_id
        and trip_members.user_id = auth.uid()
    )
  );
