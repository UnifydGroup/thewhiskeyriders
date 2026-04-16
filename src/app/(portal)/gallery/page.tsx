'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { buildOptimizedPhotoUrl } from '@/lib/photos/imageTransforms';
import type { Trip } from '@/lib/types/database';

interface TripWithCover extends Trip {
  coverPhotoUrl?: string | null;
  coverMediaType?: 'image' | 'video' | null;
}

interface PhotoCoverRow {
  storage_path: string;
  media_type: 'image' | 'video' | null;
}

export default function GalleryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [trips, setTrips] = useState<TripWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const { data: tripRows, error: tripsError } = await supabase
          .from('trips')
          .select('*')
          .neq('status', 'cancelled')
          .order('start_date', { ascending: false });

        if (tripsError) {
          throw new Error(tripsError.message);
        }

        const tripsWithCovers = await Promise.all(
          (tripRows || []).map(async (trip) => {
            if (trip.cover_image_url) {
              return {
                ...trip,
                coverPhotoUrl: buildOptimizedPhotoUrl(trip.cover_image_url, 'cover'),
                coverMediaType: 'image' as const,
              };
            }

            const { data: photosData, error: photosError } = await supabase
              .from('photos')
              .select('storage_path, media_type')
              .eq('trip_id', trip.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (photosError || !photosData || photosData.length === 0) {
              return {
                ...trip,
                coverPhotoUrl: null,
                coverMediaType: null,
              };
            }

            const latest = photosData[0] as PhotoCoverRow;
            const {
              data: { publicUrl },
            } = supabase.storage.from('photos').getPublicUrl(latest.storage_path);

            return {
              ...trip,
              coverPhotoUrl: latest.media_type === 'video'
                ? publicUrl
                : buildOptimizedPhotoUrl(publicUrl, 'cover'),
              coverMediaType: (latest.media_type === 'video' ? 'video' : 'image') as 'image' | 'video',
            };
          })
        );

        setTrips(tripsWithCovers);
        setErrorMessage(null);
      } catch (err) {
        console.error('Failed to load member galleries:', err);
        setTrips([]);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to load galleries'
        );
      } finally {
        setLoading(false);
      }
    };

    void loadTrips();
  }, [supabase]);

  const countryOptions = useMemo(() => {
    const countries = new Set(
      trips.map((trip) => trip.country).filter((country): country is string => Boolean(country))
    );
    return Array.from(countries).sort((a, b) => a.localeCompare(b));
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const loweredQuery = searchQuery.trim().toLowerCase();

    return trips.filter((trip) => {
      const matchesCountry = countryFilter === 'all' || trip.country === countryFilter;
      const searchableContent = [trip.name, trip.destination, trip.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = !loweredQuery || searchableContent.includes(loweredQuery);

      return matchesCountry && matchesQuery;
    });
  }, [countryFilter, searchQuery, trips]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Member Gallery</h1>
        <p className="text-brand-cream/70">Upload, tag, and discuss trip media</p>
      </div>

      {errorMessage && (
        <Card className="border border-red-500/50 bg-red-900/20">
          <CardContent className="pt-4 text-sm text-red-300">{errorMessage}</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wider text-brand-cream/60 mb-1 block">
              Search Trips
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by trip name, destination, or country"
              className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-brand-cream placeholder:text-brand-cream/40 focus:outline-none focus:border-brand-brown"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-brand-cream/60 mb-1 block">
              Country
            </label>
            <select
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-brand-cream focus:outline-none focus:border-brand-brown"
            >
              <option value="all">All countries</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-brand-cream/70">
          Showing {filteredTrips.length} of {trips.length} trip{trips.length !== 1 ? 's' : ''}
        </p>
      </div>

      {filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => (
            <Link key={trip.id} href={`/gallery/${trip.slug}`}>
              <Card hoverable className="h-full">
                <div className="h-40 bg-gradient-to-br from-brand-brown to-brand-tan relative overflow-hidden rounded-t-lg">
                  {trip.coverPhotoUrl &&
                    (trip.coverMediaType === 'video' ? (
                      <video
                        src={trip.coverPhotoUrl}
                        className="w-full h-full object-cover"
                        muted
                        autoPlay
                        loop
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img src={trip.coverPhotoUrl} alt={trip.name} className="w-full h-full object-cover" />
                    ))}
                  <div className="absolute inset-0 bg-brand-black/40" />
                </div>
                <CardHeader className="pt-4">
                  <CardTitle className="line-clamp-1">{trip.name}</CardTitle>
                  <CardDescription>{trip.destination}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brand-cream/60">Open gallery to upload and manage media</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : !errorMessage ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No trips match your search</p>
            <p className="text-sm text-brand-cream/50">
              Try a different search query or clear the country filter
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
