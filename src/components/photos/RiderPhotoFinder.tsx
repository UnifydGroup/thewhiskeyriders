'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { framingStyle, isDefaultFraming, parseFraming } from '@/lib/images/framing';
import { buildFramedPhotoUrl } from '@/lib/photos/imageTransforms';
import { getPersonDisplayName, isProfileId, parsePersonParam } from '@/lib/photos/people';
import { cn } from '@/lib/utils';

interface TripSummary {
  id: string;
  name: string;
  slug: string;
  start_date: string;
}

interface TagRow {
  tag_value: string;
  photos: {
    id: string;
    trip_id: string;
    storage_path: string;
    media_type: string | null;
    thumbnail_framing: unknown;
    created_at: string;
    caption: string | null;
  } | null;
}

interface PersonProfile {
  id: string;
  nickname: string | null;
  full_name: string | null;
  avatar_url: string | null;
  avatar_framing: unknown;
}

interface RiderPhoto {
  id: string;
  tripId: string;
  url: string;
  isVideo: boolean;
  framing: unknown;
  createdAt: string;
  caption: string | null;
}

interface Rider {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarFraming: unknown;
  photos: RiderPhoto[];
}

const THUMBS_PER_TRIP = 6;

/**
 * "Find a rider": everyone tagged in photos you can see, and the trips they appear in.
 * Selecting someone (or opening /gallery?person=<id>) lists their photos grouped by trip,
 * each linking to that trip's gallery filtered to them.
 */
export function RiderPhotoFinder({ trips }: { trips: TripSummary[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => parsePersonParam(searchParams.get('person'))[0] ?? null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Row-level security limits this to photos the member can see.
      const { data, error } = await supabase
        .from('photo_tags')
        .select('tag_value, photos!inner(id, trip_id, storage_path, media_type, thumbnail_framing, created_at, caption)')
        .eq('tag_type', 'person');

      if (error || cancelled) {
        if (error) console.error('Failed to load people tags:', error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as TagRow[];
      const profileIds = Array.from(new Set(rows.map((row) => row.tag_value).filter(isProfileId)));
      const { data: profiles } = profileIds.length
        ? await supabase.from('profiles').select('id, nickname, full_name, avatar_url, avatar_framing').in('id', profileIds)
        : { data: [] as PersonProfile[] };
      const profilesById = new Map(((profiles ?? []) as PersonProfile[]).map((profile) => [profile.id, profile]));

      const byPerson = new Map<string, Rider>();
      rows.forEach((row) => {
        if (!row.photos) return;
        const profile = profilesById.get(row.tag_value);
        const id = profile ? profile.id : `name:${row.tag_value.trim().toLowerCase()}`;
        const rider =
          byPerson.get(id) ??
          {
            id,
            name: profile ? getPersonDisplayName(profile, row.tag_value) : row.tag_value.trim(),
            avatarUrl: profile?.avatar_url ?? null,
            avatarFraming: profile?.avatar_framing ?? null,
            photos: [],
          };
        if (!rider.photos.some((photo) => photo.id === row.photos!.id)) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(row.photos.storage_path);
          const framing = row.photos.thumbnail_framing;
          rider.photos.push({
            id: row.photos.id,
            tripId: row.photos.trip_id,
            url: buildFramedPhotoUrl(urlData.publicUrl, 'thumbnail', !isDefaultFraming(parseFraming(framing))) || urlData.publicUrl,
            isVideo: row.photos.media_type === 'video',
            framing,
            createdAt: row.photos.created_at,
            caption: row.photos.caption,
          });
        }
        byPerson.set(id, rider);
      });

      if (!cancelled) {
        setRiders(
          Array.from(byPerson.values()).sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name))
        );
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const select = (id: string | null) => {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('person', id);
    else params.delete('person');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const visibleRiders = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return lowered ? riders.filter((rider) => rider.name.toLowerCase().includes(lowered)) : riders;
  }, [query, riders]);

  const selected = riders.find((rider) => rider.id === selectedId) ?? null;

  const tripGroups = useMemo(() => {
    if (!selected) return [];
    const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
    const groups = new Map<string, { trip: TripSummary; photos: RiderPhoto[] }>();
    selected.photos.forEach((photo) => {
      const trip = tripsById.get(photo.tripId);
      if (!trip) return;
      const group = groups.get(trip.id) ?? { trip, photos: [] };
      group.photos.push(photo);
      groups.set(trip.id, group);
    });
    return Array.from(groups.values())
      .map((group) => ({ ...group, photos: group.photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
      .sort((a, b) => b.trip.start_date.localeCompare(a.trip.start_date));
  }, [selected, trips]);

  if (!loading && riders.length === 0) return null;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-cream">Find a rider</h2>
          <p className="text-sm text-brand-cream/65">Pick someone to see every photo they&apos;re tagged in, across all trips.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <label htmlFor="rider-search" className="sr-only">Search riders</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cream/40" />
          <input
            id="rider-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search riders"
            className="w-full rounded border border-brand-brown/20 bg-brand-black py-2 pl-9 pr-3 text-base text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none sm:text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex gap-2 overflow-hidden" aria-hidden>
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="h-10 w-32 flex-shrink-0 animate-pulse rounded-full bg-brand-black/60" />
          ))}
        </div>
      ) : (
        <div role="group" aria-label="Riders" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {visibleRiders.map((rider) => {
            const isSelected = rider.id === selectedId;
            return (
              <button
                key={rider.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => select(isSelected ? null : rider.id)}
                className={cn(
                  'flex flex-shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors',
                  isSelected
                    ? 'border-brand-brown bg-brand-brown text-brand-cream'
                    : 'border-brand-brown/30 bg-brand-black/40 text-brand-cream/85 hover:border-brand-brown/70'
                )}
              >
                <Avatar src={rider.avatarUrl} framing={rider.avatarFraming} alt={rider.name} size="md" />
                <span className="whitespace-nowrap font-medium">{rider.name}</span>
                <span className={cn('text-xs tabular-nums', isSelected ? 'text-brand-cream/80' : 'text-brand-cream/50')}>
                  {rider.photos.length}
                </span>
              </button>
            );
          })}
          {visibleRiders.length === 0 && <p className="py-2 text-sm text-brand-cream/60">No riders match &ldquo;{query}&rdquo;.</p>}
        </div>
      )}

      {selected && (
        <div className="space-y-5 border-t border-brand-brown/20 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar src={selected.avatarUrl} framing={selected.avatarFraming} alt={selected.name} size="lg" />
              <div>
                <p className="text-lg font-bold text-brand-cream">{selected.name}</p>
                <p className="text-sm text-brand-cream/65">
                  {selected.photos.length} photo{selected.photos.length !== 1 ? 's' : ''} across {tripGroups.length} trip
                  {tripGroups.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => select(null)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-brand-brown hover:text-brand-tan"
            >
              <X className="h-4 w-4" /> Clear
            </button>
          </div>

          {tripGroups.map(({ trip, photos }) => (
            <section key={trip.id} aria-label={`${selected.name} on ${trip.name}`} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold text-brand-cream">
                  {trip.name} <span className="text-sm font-normal text-brand-cream/55">· {photos.length}</span>
                </h3>
                <Link
                  href={`/gallery/${trip.slug}?person=${encodeURIComponent(selected.id)}`}
                  className="text-sm font-semibold text-brand-brown hover:text-brand-tan"
                >
                  {photos.length > THUMBS_PER_TRIP ? `See all ${photos.length} →` : 'Open gallery →'}
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {photos.slice(0, THUMBS_PER_TRIP).map((photo) => (
                  <Link
                    key={photo.id}
                    href={`/gallery/${trip.slug}?person=${encodeURIComponent(selected.id)}`}
                    className="group relative aspect-square overflow-hidden rounded-md border border-brand-brown/20 bg-brand-black"
                  >
                    {photo.isVideo ? (
                      <video src={photo.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt={photo.caption || `${selected.name} on ${trip.name}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        style={framingStyle(photo.framing)}
                      />
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
