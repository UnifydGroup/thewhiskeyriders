'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent } from '@/components/ui/Card';
import PhotoUploadDropzone from './PhotoUploadDropzone';
import PhotoGrid from './PhotoGrid';

interface Photo {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploaded_by: string;
  uploader_name?: string;
  url: string;
}

interface PhotosTabContentProps {
  tripId: string;
  isAdmin?: boolean;
  currentUserId?: string;
}

export default function PhotosTabContent({
  tripId,
  isAdmin = false,
  currentUserId,
}: PhotosTabContentProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const fetchPhotos = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/trips/${tripId}/photos`);

      if (!response.ok) {
        throw new Error('Failed to load photos');
      }

      const data = await response.json();
      setPhotos(Array.isArray(data) ? data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load photos';
      setError(errorMessage);
      console.error('Error fetching photos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [tripId]);

  const handleUploadComplete = (count: number) => {
    setUploadMessage(`Successfully uploaded ${count} photo${count !== 1 ? 's' : ''}!`);
    setTimeout(() => setUploadMessage(null), 3000);
    // Refresh photos
    fetchPhotos();
  };

  const handleUploadError = (error: string) => {
    setError(error);
    setTimeout(() => setError(null), 5000);
  };

  const handlePhotoDelete = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <PhotoUploadDropzone
        tripId={tripId}
        onUploadComplete={handleUploadComplete}
        onError={handleUploadError}
      />

      {/* Messages */}
      {uploadMessage && (
        <Card className="bg-green-500/10 border-green-500/50">
          <CardContent className="pt-4 text-green-400 text-sm">
            {uploadMessage}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-red-500/10 border-red-500/50">
          <CardContent className="pt-4 text-red-400 text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Gallery Section */}
      <div>
        <h3 className="text-lg font-semibold text-brand-cream mb-4">
          Gallery ({photos.length} photos)
        </h3>
        {photos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-brand-cream/70">No photos yet. Upload your first photo above!</p>
            </CardContent>
          </Card>
        ) : (
          <PhotoGrid
            photos={photos}
            tripId={tripId}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onPhotoDelete={handlePhotoDelete}
          />
        )}
      </div>
    </div>
  );
}
