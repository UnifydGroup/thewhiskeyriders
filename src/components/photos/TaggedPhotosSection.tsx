'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/database';

interface TaggedPhoto {
  id: string;
  trip_id: string;
  caption: string | null;
  created_at: string;
  url: string;
  trip_name: string;
  trip_slug: string;
  matched_tag: string;
}

interface PhotoTagRow {
  photo_id: string;
  tag_value: string;
}

interface PhotoRow {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

interface TripRow {
  id: string;
  name: string;
  slug: string;
}

function getCandidateNames(profile: Profile): string[] {
  const fullFromParts = [profile.first_name, profile.middle_name, profile.surname]
    .filter(Boolean)
    .join(' ')
    .trim();

  const candidates = [fullFromParts, profile.full_name || '', profile.nickname || '']
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return Array.from(new Set(candidates));
}

function getMatchedTagDisplay(profile: Profile, rawTagValue: string): string {
  if (rawTagValue === profile.id) {
    const preferred = profile.nickname?.trim() || profile.full_name?.trim();
    return preferred || rawTagValue;
  }

  return rawTagValue;
}

export default function TaggedPhotosSection({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<TaggedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTaggedPhotos = async () => {
      setLoading(true);
      setError(null);

      try {
        const tagRows: PhotoTagRow[] = [];
        const seenTags = new Set<string>();

        const addRows = (rows: Array<{ photo_id: string; tag_value: string }> | null) => {
          (rows || []).forEach((row) => {
            if (!row.photo_id || !row.tag_value) {
              return;
            }

            const key = `${row.photo_id}:${row.tag_value}`;
            if (seenTags.has(key)) {
              return;
            }

            seenTags.add(key);
            tagRows.push({
              photo_id: row.photo_id,
              tag_value: row.tag_value,
            });
          });
        };

        const { data: idTags, error: idTagsError } = await supabase
          .from('photo_tags')
          .select('photo_id, tag_value')
          .eq('tag_type', 'person')
          .eq('tag_value', profile.id);

        if (idTagsError) {
          throw new Error(idTagsError.message);
        }

        addRows(idTags as Array<{ photo_id: string; tag_value: string }> | null);

        const candidateNames = getCandidateNames(profile);
        if (candidateNames.length > 0) {
          const legacyTagResponses = await Promise.all(
            candidateNames.map(async (name) =>
              supabase
                .from('photo_tags')
                .select('photo_id, tag_value')
                .eq('tag_type', 'person')
                .ilike('tag_value', name)
            )
          );

          legacyTagResponses.forEach(({ data }) => {
            addRows(data as Array<{ photo_id: string; tag_value: string }> | null);
          });
        }

        const uniquePhotoIds = Array.from(new Set(tagRows.map((tag) => tag.photo_id)));
        if (uniquePhotoIds.length === 0) {
          setPhotos([]);
          return;
        }

        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('id, trip_id, storage_path, caption, created_at')
          .in('id', uniquePhotoIds)
          .order('created_at', { ascending: false });

        if (photosError) {
          throw new Error(photosError.message);
        }

        const typedPhotos = (photosData || []) as PhotoRow[];
        const tripIds = Array.from(new Set(typedPhotos.map((photo) => photo.trip_id)));

        const { data: tripsData, error: tripsError } = await supabase
          .from('trips')
          .select('id, name, slug')
          .in('id', tripIds);

        if (tripsError) {
          throw new Error(tripsError.message);
        }

        const tripsById = new Map<string, TripRow>();
        (tripsData || []).forEach((trip) => {
          tripsById.set(trip.id, trip as TripRow);
        });

        const firstTagByPhotoId = new Map<string, string>();
        tagRows.forEach((row) => {
          if (!firstTagByPhotoId.has(row.photo_id)) {
            firstTagByPhotoId.set(row.photo_id, getMatchedTagDisplay(profile, row.tag_value));
          }
        });

        const enrichedPhotos: TaggedPhoto[] = typedPhotos
          .map((photo) => {
            const trip = tripsById.get(photo.trip_id);
            if (!trip) {
              return null;
            }

            const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path);

            return {
              id: photo.id,
              trip_id: photo.trip_id,
              caption: photo.caption,
              created_at: photo.created_at,
              url: data.publicUrl,
              trip_name: trip.name,
              trip_slug: trip.slug,
              matched_tag: firstTagByPhotoId.get(photo.id) || '',
            };
          })
          .filter((photo): photo is TaggedPhoto => Boolean(photo));

        if (!cancelled) {
          setPhotos(enrichedPhotos);
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

    loadTaggedPhotos();

    return () => {
      cancelled = true;
    };
  }, [profile, supabase]);

  return (
    <div>
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
              href={`/gallery/${photo.trip_slug}`}
              className="group rounded-lg overflow-hidden border border-brand-brown/20 bg-brand-brown/10"
            >
              <div className="relative aspect-square">
                <Image
                  src={photo.url}
                  alt={photo.caption || `Tagged photo from ${photo.trip_name}`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                  sizes="(max-width: 768px) 50vw, 25vw"
                  unoptimized
                />
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
