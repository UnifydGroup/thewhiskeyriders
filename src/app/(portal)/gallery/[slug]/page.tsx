'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
  const supabase = createClient();
  const slug = params.slug as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrip();
  }, [slug, supabase, router]);

  const loadTrip = async () => {
    try {
      // Get trip
      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!tripData) {
        router.push('/gallery');
        return;
      }

      setTrip(tripData);

      // Load all photos for this trip
      const { data: photosData } = await supabase
        .from('photos')
        .select(`
          *,
          profiles!uploaded_by(full_name, nickname)
        `)
        .eq('trip_id', tripData.id)
        .order('created_at', { ascending: false });

      if (photosData) {
        const photosWithUrls = photosData.map((photo: any) => {
          const { data: { publicUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(photo.storage_path);

          return {
            id: photo.id,
            trip_id: photo.trip_id,
            storage_path: photo.storage_path,
            caption: photo.caption,
            media_type: photo.media_type === 'video' ? 'video' : 'image',
            mime_type: photo.mime_type || null,
            width: photo.width,
            height: photo.height,
            created_at: photo.created_at,
            uploaded_by: photo.uploaded_by,
            uploader_name: photo.profiles?.full_name || photo.profiles?.nickname || 'Unknown',
            url: publicUrl,
          };
        });

        setPhotos(photosWithUrls);
      }
    } catch (err) {
      console.error('Failed to load trip:', err);
      router.push('/gallery');
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
