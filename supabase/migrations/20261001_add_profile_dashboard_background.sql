-- Let members choose their own dashboard hero background.
-- When null, the dashboard falls back to the next trip's cover image.
alter table public.profiles
  add column if not exists dashboard_background_url text;

comment on column public.profiles.dashboard_background_url is
  'Member-chosen dashboard hero background image (public storage URL). Null = use next trip cover.';
