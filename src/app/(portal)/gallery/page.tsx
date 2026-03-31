'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import type { Trip } from '@/lib/types/database';
export default function GalleryPage() {
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
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Gallery</h1>
        <p className="text-brand-cream/70">Memories from our adventures</p>
      </div>
      {/* Trip Galleries */}
      {trips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/gallery/${trip.slug}`}
            >
              <Card hoverable className="h-full">
                <div className="h-40 bg-gradient-to-br from-brand-brown to-brand-tan relative overflow-hidden rounded-t-lg">
                  {trip.cover_image_url && (
                    <img
                      src={trip.cover_image_url}
                      alt={trip.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-brand-black/40" />
                </div>
                <CardHeader className="pt-4">
                  <CardTitle className="line-clamp-1">{trip.name}</CardTitle>
                  <CardDescription>{trip.destination}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brand-cream/60">
                    Photos from this adventure
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No trips with photos yet</p>
            <p className="text-sm text-brand-cream/50">
              Check back as adventures are completed and photos are shared
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
