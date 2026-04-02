'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { formatDate, formatDateShort } from '@/lib/utils';
import Link from 'next/link';
import { Clock3, MapPin, Users } from 'lucide-react';
import type { Trip } from '@/lib/types/database';
import { WorldMap } from '@/components/map/WorldMap';

type NextTripTicker = {
  trip: Trip;
  targetDate: Date;
};

function getCountdownTargetDate(trip: Pick<Trip, 'start_date' | 'countdown_target_at'>): Date | null {
  if (trip.countdown_target_at) {
    const explicitDate = new Date(trip.countdown_target_at);
    if (!Number.isNaN(explicitDate.getTime())) {
      return explicitDate;
    }
  }

  const fallbackDate = new Date(`${trip.start_date}T00:00:00`);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

function getCountdownParts(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export default function TripsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [myTripIds, setMyTripIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const loadTripsAndMemberships = async () => {
      try {
        // Get current user
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;

        // Fetch all trips
        const { data } = await supabase
          .from('trips')
          .select('*')
          .order('start_date', { ascending: false });
        if (data) {
          setTrips(data);
        }

        // Fetch user's trip memberships
        if (userId) {
          const { data: memberships } = await supabase
            .from('trip_members')
            .select('trip_id')
            .eq('user_id', userId);

          if (memberships) {
            setMyTripIds(new Set(memberships.map((m) => m.trip_id)));
          }
        }
      } catch (err) {
        console.error('Failed to load trips:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTripsAndMemberships();
  }, [supabase]);

  const nextTripTicker = useMemo<NextTripTicker | null>(() => {
    const candidates = trips
      .filter((trip) => trip.countdown_enabled === true && trip.status !== 'cancelled')
      .map((trip) => {
        const targetDate = getCountdownTargetDate(trip);
        if (!targetDate) return null;
        return { trip, targetDate };
      })
      .filter((entry): entry is NextTripTicker => Boolean(entry))
      .filter((entry) => entry.targetDate.getTime() > nowMs)
      .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

    return candidates[0] || null;
  }, [trips, nowMs]);

  useEffect(() => {
    if (!nextTripTicker) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [nextTripTicker]);

  const tickerTimeLeft = useMemo(() => {
    if (!nextTripTicker) return null;
    return getCountdownParts(nextTripTicker.targetDate.getTime() - nowMs);
  }, [nextTripTicker, nowMs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }
  // Filter trips based on membership
  const myTrips = trips.filter((t) => myTripIds.has(t.id));
  const tripsNotOn = trips.filter((t) => !myTripIds.has(t.id));

  const upcomingTrips = myTrips.filter((t) => t.status === 'upcoming');
  const activeTrips = myTrips.filter((t) => t.status === 'active');
  const completedTrips = myTrips.filter((t) => t.status === 'completed');

  const upcomingTripsNotOn = tripsNotOn.filter((t) => t.status === 'upcoming');
  const activeTripsNotOn = tripsNotOn.filter((t) => t.status === 'active');
  const completedTripsNotOn = tripsNotOn.filter((t) => t.status === 'completed');
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Adventures</h1>
        <p className="text-brand-cream/70">Your motorcycle adventures</p>
      </div>

      {/* Next Trip Ticker */}
      {nextTripTicker && tickerTimeLeft && (
        <Link href={`/trips/${nextTripTicker.trip.slug}`} className="block">
          <div className="rounded-xl border border-brand-brown/30 bg-brand-dark-grey/60 px-3 sm:px-4 py-2.5 hover:border-brand-brown/50 transition-colors">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-brand-tan font-semibold uppercase tracking-wide text-xs">
                <Clock3 className="w-3.5 h-3.5" />
                Next Trip
              </span>
              <span className="text-brand-cream font-semibold">{nextTripTicker.trip.name}</span>
              <span className="text-brand-cream/40 hidden sm:inline">•</span>
              <span className="text-brand-cream/70 text-xs sm:text-sm">
                {formatDate(nextTripTicker.targetDate, 'MMM d, yyyy h:mm a')}
              </span>
              <div className="ml-auto flex items-center gap-1.5 text-brand-cream text-xs sm:text-sm">
                <span className="font-semibold">{tickerTimeLeft.days}d</span>
                <span className="text-brand-cream/50">:</span>
                <span className="font-semibold">{String(tickerTimeLeft.hours).padStart(2, '0')}h</span>
                <span className="text-brand-cream/50">:</span>
                <span className="font-semibold">{String(tickerTimeLeft.minutes).padStart(2, '0')}m</span>
                <span className="text-brand-cream/50">:</span>
                <span className="font-semibold">{String(tickerTimeLeft.seconds).padStart(2, '0')}s</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* World Map — shows all trips */}
      <div className="rounded-2xl border border-brand-brown/20 bg-brand-dark-grey/40 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-brand-cream mb-4">Ride Map</h2>
        <WorldMap trips={trips} showStats />
      </div>
      {/* Your Trips Section */}
      {myTrips.length > 0 ? (
        <>
          {/* Upcoming Trips */}
          {upcomingTrips.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Upcoming</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
          {/* Active Trips */}
          {activeTrips.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Currently Happening</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
          {/* Completed Trips */}
          {completedTrips.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Past Adventures</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">You haven't been on any trips yet.</p>
            <p className="text-sm text-brand-cream/50">Check out available trips below!</p>
          </CardContent>
        </Card>
      )}

      {/* Trips I Wasn't On Section */}
      {showAllTrips && tripsNotOn.length > 0 && (
        <div className="border-t border-brand-tan/20 pt-8">
          <h2 className="text-2xl font-bold text-brand-cream mb-4">Trips I Wasn't On</h2>
          {/* Upcoming Trips Not On */}
          {upcomingTripsNotOn.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-brand-cream/90 mb-4">Upcoming</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingTripsNotOn.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
          {/* Active Trips Not On */}
          {activeTripsNotOn.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-brand-cream/90 mb-4">Currently Happening</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTripsNotOn.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
          {/* Completed Trips Not On */}
          {completedTripsNotOn.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-brand-cream/90 mb-4">Past Adventures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedTripsNotOn.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toggle Trips I Wasn't On Button */}
      {tripsNotOn.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setShowAllTrips(!showAllTrips)}
            className="text-brand-cream border-brand-tan/30 hover:bg-brand-dark-grey/50"
          >
            {showAllTrips ? 'Hide Trips I Wasn\'t On' : 'Show Trips I Wasn\'t On'}
          </Button>
        </div>
      )}
    </div>
  );
}
function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link href={`/trips/${trip.slug}`}>
      <Card hoverable className="h-full flex flex-col">
        {/* Cover image or gradient */}
        <div className="h-48 bg-gradient-to-br from-brand-brown to-brand-tan relative overflow-hidden rounded-t-lg">
          {trip.cover_image_url && (
            <img
              src={trip.cover_image_url}
              alt={trip.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-brand-black/40" />
          <div className="absolute bottom-4 left-4 right-4">
            <Badge variant="primary">{trip.status}</Badge>
          </div>
        </div>
        <CardHeader className="pt-4">
          <CardTitle className="line-clamp-2">{trip.name}</CardTitle>
          <CardDescription className="flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4" />
            {trip.destination}, {trip.country}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-sm text-brand-cream/70 mb-3">
            {formatDateShort(trip.start_date)} - {formatDateShort(trip.end_date)}
          </p>
          {trip.description && (
            <p className="text-sm text-brand-cream/60 line-clamp-2">
              {trip.description}
            </p>
          )}
        </CardContent>
        {trip.max_members && (
          <div className="px-6 pb-4 flex items-center gap-2 text-sm text-brand-cream/70">
            <Users className="w-4 h-4" />
            <span>Up to {trip.max_members} riders</span>
          </div>
        )}
      </Card>
    </Link>
  );
}
