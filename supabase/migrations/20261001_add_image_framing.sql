-- Non-destructive image framing: a focal point (x, y as 0-100 %) and zoom (1-3)
-- saved alongside an image so it can be positioned inside avatars, banners and
-- thumbnails without re-uploading. Null = centred, no zoom.
alter table public.profiles
  add column if not exists avatar_framing jsonb,
  add column if not exists dashboard_background_framing jsonb;

alter table public.trips
  add column if not exists cover_image_framing jsonb;

alter table public.photos
  add column if not exists thumbnail_framing jsonb;

comment on column public.profiles.avatar_framing is 'Profile photo framing {x, y, zoom}. Null = centred.';
comment on column public.profiles.dashboard_background_framing is 'Dashboard background framing {x, y, zoom}. Null = centred.';
comment on column public.trips.cover_image_framing is 'Trip/gallery cover framing {x, y, zoom}. Null = centred.';
comment on column public.photos.thumbnail_framing is 'Gallery thumbnail framing {x, y, zoom}. Null = centred.';
