-- Ensure the shared photos bucket accepts trip/gallery media uploads.
-- This is idempotent and expands allowed MIME types while preserving existing ones.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'photos',
  'photos',
  true,
  524288000,
  ARRAY[
    -- Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/bmp',
    'image/svg+xml',
    'image/tiff',
    -- Videos
    'video/mp4',
    'video/quicktime',
    'video/x-quicktime',
    'video/x-m4v',
    'video/webm',
    'video/ogg',
    'video/x-msvideo',
    'video/x-matroska',
    'video/3gpp',
    'video/3gpp2',
    'video/mpeg',
    'video/mp2t',
    'video/x-ms-wmv',
    'video/x-flv'
  ]::text[]
)
ON CONFLICT (id)
DO UPDATE
SET
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), EXCLUDED.file_size_limit),
  allowed_mime_types = (
    SELECT ARRAY(
      SELECT DISTINCT mime
      FROM unnest(
        COALESCE(storage.buckets.allowed_mime_types, '{}'::text[]) ||
        COALESCE(EXCLUDED.allowed_mime_types, '{}'::text[])
      ) AS mime
      WHERE mime IS NOT NULL AND length(trim(mime)) > 0
      ORDER BY mime
    )
  );
