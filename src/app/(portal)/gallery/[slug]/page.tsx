'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Trip } from '@/lib/types/database';
import PhotoGrid from '@/components/photos/PhotoGrid';

interface Photo {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  media_type: 'image' | 'video';
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploaded_by: string;
  uploader_name?: string;
  url: string;
}

export default function TripGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadTrip();
  }, [slug, router]);

  const loadTrip = async () => {
    try {
      const response = await fetch(`/api/public/galleries/${slug}`, {
        method: 'GET',
        credentials: 'include',
      });

      const payload = await response.json().catch(() => null) as
        | { trip?: Trip; photos?: Photo[]; error?: string }
        | null;

      if (response.status === 404) {
        setTrip(null);
        setPhotos([]);
        setErrorMessage('Gallery not found.');
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load gallery');
      }

      setTrip(payload?.trip || null);
      setPhotos(Array.isArray(payload?.photos) ? payload!.photos : []);
      setErrorMessage(null);
    } catch (err) {
      console.error('Failed to load trip:', err);
      setTrip(null);
      setPhotos([]);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

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
        {errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}
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
        <p className="text-sm text-brand-cream/60 mt-2">
          Public gallery view: likes are visible, while tags and comments are members-only.
        </p>
      </div>

      {/* Photos Gallery */}
      {photos.length > 0 ? (
        <PhotoGrid
          photos={photos}
          tripId={trip.id}
          publicView
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No media yet</p>
            <p className="text-sm text-brand-cream/50">
              Photos and videos will appear here once uploaded
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
