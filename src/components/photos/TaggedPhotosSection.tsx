'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { buildFramedPhotoUrl } from '@/lib/photos/imageTransforms';
import { framingStyle, isDefaultFraming, parseFraming } from '@/lib/images/framing';
import { loadTaggedPhotos, type TaggedPhoto } from '@/lib/photos/taggedPhotos';
import type { Profile } from '@/lib/types/database';

export default function TaggedPhotosSection({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<TaggedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailFallbackIds, setThumbnailFallbackIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const taggedPhotos = await loadTaggedPhotos(supabase, profile);
        if (!cancelled) {
          setPhotos(taggedPhotos);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load tagged photos';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [profile, supabase]);

  useEffect(() => {
    const validPhotoIds = new Set(photos.map((photo) => photo.id));
    setThumbnailFallbackIds((previous) =>
      previous.filter((photoId) => validPhotoIds.has(photoId))
    );
  }, [photos]);

  return (
    <div id="tagged-photos" className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-brand-cream mb-4">Tagged Photos</h2>

      {loading ? (
        <div className="py-8 flex justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-red-400">
            {error}
          </CardContent>
        </Card>
      ) : photos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-brand-cream/70">No tagged photos yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <Link
              key={photo.id}
              href={`/gallery/${photo.trip_slug}?person=${profile.id}`}
              className="group rounded-lg overflow-hidden border border-brand-brown/20 bg-brand-brown/10"
            >
              <div className="relative aspect-square overflow-hidden">
                {photo.media_type === 'video' ? (
                  <video
                    src={photo.url}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <Image
                    src={
                      thumbnailFallbackIds.includes(photo.id)
                        ? photo.url
                        : buildFramedPhotoUrl(photo.url, 'thumbnail', !isDefaultFraming(parseFraming(photo.thumbnail_framing))) || photo.url
                    }
                    alt={photo.caption || `Tagged photo from ${photo.trip_name}`}
                    fill
                    className="object-cover"
                    style={framingStyle(photo.thumbnail_framing)}
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized
                    onError={() =>
                      setThumbnailFallbackIds((previous) =>
                        previous.includes(photo.id) ? previous : [...previous, photo.id]
                      )
                    }
                  />
                )}
              </div>
              <div className="p-2 space-y-1">
                <p className="text-xs text-brand-cream/80 truncate">{photo.trip_name}</p>
                {photo.matched_tag && (
                  <p className="text-xs text-brand-gold truncate">Tagged as: {photo.matched_tag}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
