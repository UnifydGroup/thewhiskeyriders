-- @auto-migrate
-- Controls which profile fields are shown for trip members inside the
-- Trip Bible's Key Contacts section (first/last name, email, phone).

alter table public.trips
  add column if not exists bible_member_fields jsonb not null default '{"first_name": false, "surname": false, "email": false, "phone": false}'::jsonb;
