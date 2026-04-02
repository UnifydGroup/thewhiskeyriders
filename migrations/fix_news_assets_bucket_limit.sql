-- Ensures the news-assets storage bucket supports larger files (up to 250MB).
-- Safe to run multiple times.
-- @auto-migrate

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('news-assets', 'news-assets', true, 262144000)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), EXCLUDED.file_size_limit);

