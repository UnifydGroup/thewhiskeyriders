'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Trip } from '@/lib/types/database';
import PhotoGrid from '@/components/photos/PhotoGrid';
import PhotoUploadDropzone from '@/components/photos/PhotoUploadDropzone';

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

interface ProfileLite {
  full_name: string | null;
  nickname: string | null;
}

interface PhotoQueryRow {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  media_type: 'image' | 'video' | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploaded_by: string;
  profiles: ProfileLite | ProfileLite[] | null;
}

function getUploaderName(profile: ProfileLite | ProfileLite[] | null | undefined) {
  const value = Array.isArray(profile) ? profile[0] : profile;
  return value?.nickname || value?.full_name || 'Unknown';
}

export default function TripGalleryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = useMemo(() => createClient(), []);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTrip(null);
        setPhotos([]);
        setErrorMessage('You must be logged in to access member galleries.');
        return;
      }

      setCurrentUserId(user.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const role = profileData?.role || '';
      setIsAdmin(role === 'admin' || role === 'super_admin' || role === 'trip_admin');

      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('slug', slug)
        .neq('status', 'cancelled')
        .single();

      if (tripError || !tripData) {
        setTrip(null);
        setPhotos([]);
        setErrorMessage('Gallery not found.');
        return;
      }

      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select(`
          id,
          trip_id,
          storage_path,
          caption,
          media_type,
          mime_type,
          width,
          height,
          created_at,
          uploaded_by,
          profiles:uploaded_by(full_name, nickname)
        `)
        .eq('trip_id', tripData.id)
        .order('created_at', { ascending: false });

      if (photosError) {
        throw new Error(photosError.message);
      }

      const rows = (photosData || []) as PhotoQueryRow[];
      const photosWithUrls = rows.map((photo) => {
        const {
          data: { publicUrl },
        } = supabase.storage.from('photos').getPublicUrl(photo.storage_path);

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
          uploader_name: getUploaderName(photo.profiles),
          url: publicUrl,
        };
      });

      setTrip(tripData as Trip);
      setPhotos(photosWithUrls);
      setErrorMessage(null);
    } catch (err) {
      console.error('Failed to load trip gallery:', err);
      setTrip(null);
      setPhotos([]);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [slug, supabase]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  const handleUploadComplete = (count: number) => {
    setUploadMessage(`Successfully uploaded ${count} media file${count !== 1 ? 's' : ''}!`);
    setUploadError(null);
    window.setTimeout(() => setUploadMessage(null), 3000);
    void loadTrip();
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
    window.setTimeout(() => setUploadError(null), 5000);
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
      <div>
        <Link
          href="/gallery"
          className="text-brand-brown hover:text-brand-tan transition-colors mb-4 inline-block"
        >
          ← Back to Gallery
        </Link>
        <h1 className="text-4xl font-bold text-brand-cream mb-2">{trip.name} Gallery</h1>
        <p className="text-brand-cream/70">
          {trip.destination}, {trip.country}
        </p>
      </div>

      <PhotoUploadDropzone
        tripId={trip.id}
        onUploadComplete={handleUploadComplete}
        onError={handleUploadError}
      />

      {uploadMessage && (
        <Card className="bg-green-500/10 border-green-500/50">
          <CardContent className="pt-4 text-green-400 text-sm">{uploadMessage}</CardContent>
        </Card>
      )}

      {uploadError && (
        <Card className="bg-red-500/10 border-red-500/50">
          <CardContent className="pt-4 text-red-400 text-sm">{uploadError}</CardContent>
        </Card>
      )}

      {photos.length > 0 ? (
        <PhotoGrid
          photos={photos}
          tripId={trip.id}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onPhotoDelete={(photoId) => {
            setPhotos((previous) => previous.filter((photo) => photo.id !== photoId));
          }}
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
