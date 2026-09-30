'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import type { Trip } from '@/lib/types/database';
import { TripTypeBadge } from '@/components/trip/TripTypeBadge';
import { TripTypeFilter } from '@/components/trip/TripTypeFilter';
import { countByTripType, isTweener, matchesTripTypeFilter, type TripTypeFilterValue } from '@/lib/trip-type';
import { cn } from '@/lib/utils';

interface TripWithCover extends Trip {
  coverPhotoUrl?: string;
  coverMediaType?: 'image' | 'video';
}

export default function GalleryPage() {
  const [trips, setTrips] = useState<TripWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TripTypeFilterValue>('all');

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const response = await fetch('/api/public/galleries', {
          method: 'GET',
          credentials: 'include',
        });

        const payload = await response.json().catch(() => null) as
          | { trips?: TripWithCover[]; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load public galleries');
        }

        setTrips(Array.isArray(payload?.trips) ? payload!.trips : []);
        setErrorMessage(null);
      } catch (err) {
        console.error('Failed to load trips:', err);
        setTrips([]);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load public galleries');
      } finally {
        setLoading(false);
      }
    };
    void loadTrips();
  }, []);

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

      return matchesCountry && matchesQuery && matchesTripTypeFilter(trip, typeFilter);
    });
  }, [countryFilter, searchQuery, trips, typeFilter]);

  const typeCounts = useMemo(() => countByTripType(trips), [trips]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Gallery</h1>
        <p className="text-brand-cream/70">Memories from our adventures</p>
      </div>
      {errorMessage && (
        <Card className="border border-red-500/50 bg-red-900/20">
          <CardContent className="pt-4 text-sm text-red-300">{errorMessage}</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {typeCounts.tweener > 0 && (
          <TripTypeFilter value={typeFilter} onChange={setTypeFilter} counts={typeCounts} />
        )}
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
          Showing {filteredTrips.length} of {trips.length} galler{trips.length !== 1 ? 'ies' : 'y'}
          {typeCounts.tweener > 0 && (
            <span className="text-brand-cream/50">
              {' '}· {typeCounts.trip} official trip{typeCounts.trip !== 1 ? 's' : ''}, {typeCounts.tweener} tweener{typeCounts.tweener !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Trip Galleries */}
      {filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => (
            <Link
              key={trip.id}
              href={`/public/gallery/${trip.slug}`}
            >
              <Card hoverable className={cn('h-full', isTweener(trip) && 'border-dashed border-brand-tan/50')}>
                <div
                  className={cn(
                    'h-40 bg-gradient-to-br relative overflow-hidden rounded-t-lg',
                    isTweener(trip) ? 'from-brand-tan/80 to-brand-dark-grey' : 'from-brand-brown to-brand-tan'
                  )}
                >
                  {trip.coverPhotoUrl && (
                    trip.coverMediaType === 'video' ? (
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
                      <img
                        src={trip.coverPhotoUrl}
                        alt={trip.name}
                        className="w-full h-full object-cover"
                      />
                    )
                  )}
                  <div className="absolute inset-0 bg-brand-black/40" />
                  <div className="absolute top-3 left-3">
                    <TripTypeBadge trip={trip} size="sm" className="bg-brand-black/70" />
                  </div>
                </div>
                <CardHeader className="pt-4">
                  <CardTitle className="line-clamp-1">{trip.name}</CardTitle>
                  <CardDescription>{trip.destination}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brand-cream/60">
                    {isTweener(trip) ? 'Media from this tweener' : 'Media from this adventure'}
                  </p>
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
      {!loading && trips.length === 0 && errorMessage && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">Public galleries are temporarily unavailable.</p>
            <p className="text-sm text-brand-cream/50">Please try again in a moment.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
