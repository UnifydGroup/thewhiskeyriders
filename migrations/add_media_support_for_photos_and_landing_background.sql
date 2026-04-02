-- @auto-migrate
-- Adds first-class media support for trip/gallery assets and landing background video.
-- Safe to run multiple times.

-- 1) Photos table: support image + video records.
ALTER TABLE IF EXISTS public.photos
  ADD COLUMN IF NOT EXISTS media_type varchar(16) NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS mime_type text;

UPDATE public.photos
SET media_type = CASE
  WHEN storage_path ~* '\.(mp4|mov|webm|ogg|m4v)$' THEN 'video'
  ELSE 'image'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'photos_media_type_check'
  ) THEN
    ALTER TABLE public.photos
      ADD CONSTRAINT photos_media_type_check
      CHECK (media_type IN ('image', 'video'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.photos.media_type IS 'Media category: image or video';
COMMENT ON COLUMN public.photos.mime_type IS 'Original MIME type uploaded by client (e.g. image/jpeg, video/mp4)';

-- 2) Site settings: support image OR video landing background.
ALTER TABLE IF EXISTS public.site_settings
  ADD COLUMN IF NOT EXISTS background_media_type varchar(16) NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS background_video_url text;

UPDATE public.site_settings
SET background_media_type = 'image'
WHERE background_media_type IS NULL OR background_media_type = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_settings_background_media_type_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_background_media_type_check
      CHECK (background_media_type IN ('image', 'video'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.site_settings.background_media_type IS 'Landing background media mode: image or video';
COMMENT ON COLUMN public.site_settings.background_video_url IS 'Optional landing background video URL when media mode is video';
