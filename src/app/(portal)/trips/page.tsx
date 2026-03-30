'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatDateShort } from '@/lib/utils';
import Link from 'next/link';
import { MapPin, Users } from 'lucide-react';
import type { Trip } from '@/lib/types/database';

export default function TripsPage() {
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const { data } = await supabase
          .from('trips')
          .select('*')
          .order('start_date', { ascending: false });

        if (data) {
          setTrips(data);
        }
      } catch (err) {
        console.error('Failed to load trips:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const upcomingTrips = trips.filter((t) => t.status === 'upcoming');
  const activeTrips = trips.filter((t) => t.status === 'active');
  const completedTrips = trips.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Adventures</h1>
        <p className="text-brand-cream/70">Explore upcoming motorcycle adventures</p>
      </div>

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

      {/* Empty state */}
      {trips.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No trips available yet.</p>
            <p className="text-sm text-brand-cream/50">
              Check back soon for upcoming adventures!
            </p>
          </CardContent>
        </Card>
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
