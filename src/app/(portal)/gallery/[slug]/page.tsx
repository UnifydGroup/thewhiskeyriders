'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Trip } from '@/lib/types/database';

export default function TripGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const slug = params.slug as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrip = async () => {
      try {
        const { data } = await supabase
          .from('trips')
          .select('*')
          .eq('slug', slug)
          .single();

        if (!data) {
          router.push('/gallery');
          return;
        }

        setTrip(data);
      } catch (err) {
        console.error('Failed to load trip:', err);
        router.push('/gallery');
      } finally {
        setLoading(false);
      }
    };

    loadTrip();
  }, [slug, supabase, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-brand-cream">Gallery not found</h1>
        <Link href="/gallery">
          <Button variant="primary">Back to Gallery</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/gallery" className="text-brand-brown hover:text-brand-tan transition-colors mb-4 inline-block">
          ← Back to Gallery
        </Link>
        <h1 className="text-4xl font-bold text-brand-cream mb-2">{trip.name} Gallery</h1>
        <p className="text-brand-cream/70">{trip.destination}, {trip.country}</p>
      </div>

      {/* Empty gallery */}
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-brand-cream/70 mb-4">Photos coming soon</p>
          <p className="text-sm text-brand-cream/50">
            Trip photos will be shared here once uploaded
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
