'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import PhotoGrid from '@/components/photos/PhotoGrid';
import type { Gallery, Trip } from '@/lib/types/database';

interface GalleryWithTrip extends Gallery {
  trip?: Trip;
  photoCount: number;
  lastUpdatedAt: string | null;
  albumThumbnailUrl: string | null;
  source: 'trip_all' | 'gallery';
}

interface GalleryPhoto {
  id: string;
  trip_id: string;
  gallery_id: string | null;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  media_type: 'image' | 'video';
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploader_name?: string;
  url: string;
}

interface RawPhotoResponse {
  id?: string;
  trip_id?: string;
  gallery_id?: string | null;
  uploaded_by?: string;
  storage_path?: string;
  caption?: string | null;
  media_type?: 'image' | 'video';
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  created_at?: string;
  uploader_name?: string;
  profiles?:
    | { full_name?: string | null; nickname?: string | null }
    | Array<{ full_name?: string | null; nickname?: string | null }>
    | null;
  url?: string;
}

type UploadItemStatus = 'queued' | 'uploading' | 'success' | 'failed' | 'skipped';

interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: UploadItemStatus;
  error?: string;
}

type EditableGalleryForm = {
  name: string;
  description: string;
  trip_id: string;
};

interface GalleryMetric {
  count: number;
  lastPhotoAt: string | null;
}

interface GalleryMetricsPayload {
  byTrip: Record<string, GalleryMetric>;
  byGallery: Record<string, GalleryMetric>;
}

export default function GalleriesPage() {
  const supabase = useMemo(() => createClient(), []);
  const managementSectionRef = useRef<HTMLDivElement | null>(null);
  const tripHashCacheRef = useRef<Record<string, Record<string, string>>>({});

  const [galleries, setGalleries] = useState<GalleryWithTrip[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingGalleryId, setUploadingGalleryId] = useState<string | null>(null);
  const [settingThumbnailPhotoId, setSettingThumbnailPhotoId] = useState<string | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadBatchInfo, setUploadBatchInfo] = useState({ current: 0, total: 0 });
  const [photosLoading, setPhotosLoading] = useState(false);

  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [editingGalleryId, setEditingGalleryId] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [tripFilter, setTripFilter] = useState<string>('all');
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  const [formData, setFormData] = useState({
    tripId: '',
    name: '',
    description: '',
  });

  const [editForm, setEditForm] = useState<EditableGalleryForm>({
    name: '',
    description: '',
    trip_id: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedGallery = useMemo(
    () => galleries.find((gallery) => gallery.id === selectedGalleryId) ?? null,
    [galleries, selectedGalleryId]
  );

  const filteredGalleries = useMemo(() => {
    if (tripFilter === 'all') {
      return galleries;
    }
    return galleries.filter((gallery) => gallery.trip_id === tripFilter);
  }, [galleries, tripFilter]);

  const uploadSummary = useMemo(() => {
    const total = uploadItems.length;
    const success = uploadItems.filter((item) => item.status === 'success').length;
    const failed = uploadItems.filter((item) => item.status === 'failed').length;
    const skipped = uploadItems.filter((item) => item.status === 'skipped').length;
    const uploading = uploadItems.filter((item) => item.status === 'uploading').length;
    const queued = uploadItems.filter((item) => item.status === 'queued').length;
    const completed = success + failed + skipped;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      success,
      failed,
      skipped,
      uploading,
      queued,
      completed,
      progressPercent,
    };
  }, [uploadItems]);

  const hashArrayBuffer = async (buffer: ArrayBuffer) => {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const parseJsonSafely = async (response: Response): Promise<unknown> => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const extractErrorMessage = (payload: unknown, fallback: string) => {
    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
    ) {
      return payload.error;
    }

    return fallback;
  };

  const inferMimeTypeFromFileName = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const byExtension: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif',
      heic: 'image/heic',
      heif: 'image/heif',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      tif: 'image/tiff',
      tiff: 'image/tiff',
      mp4: 'video/mp4',
      mov: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      ogv: 'video/ogg',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      '3gp': 'video/3gpp',
      '3g2': 'video/3gpp2',
      mpeg: 'video/mpeg',
      mpg: 'video/mpeg',
      mts: 'video/mp2t',
      m2ts: 'video/mp2t',
      ts: 'video/mp2t',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
    };

    return byExtension[extension] || null;
  };

  const resolveUploadMimeType = (file: File, signedMimeType?: string | null) => {
    const raw =
      (signedMimeType || file.type || inferMimeTypeFromFileName(file.name) || '').toLowerCase();

    if (!raw) {
      return null;
    }

    if (
      raw === 'application/octet-stream' ||
      raw === 'binary/octet-stream' ||
      raw === 'application/x-binary'
    ) {
      return inferMimeTypeFromFileName(file.name);
    }

    if (raw === 'video/quicktime' || raw === 'video/x-quicktime' || raw === 'video/x-m4v') {
      return 'video/mp4';
    }

    if (raw.startsWith('image/') || raw.startsWith('video/')) {
      return raw;
    }

    return inferMimeTypeFromFileName(file.name);
  };

  const isImageUploadFile = (file: File) => {
    const mimeType = resolveUploadMimeType(file);
    return Boolean(mimeType?.startsWith('image/'));
  };

  const hashFile = async (file: File) => hashArrayBuffer(await file.arrayBuffer());

  const hashPhotoUrl = async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch existing photo (${response.status})`);
    }

    return hashArrayBuffer(await response.arrayBuffer());
  };

  const getTripPhotoHashes = async (tripId: string) => {
    const cachedHashes = tripHashCacheRef.current[tripId] || {};

    const response = await fetch(`/api/trips/${tripId}/photos`, {
      credentials: 'include',
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          data,
          `Failed to fetch trip photos for duplicate check (HTTP ${response.status})`
        )
      );
    }

    if (!Array.isArray(data)) {
      throw new Error('Failed to fetch trip photos for duplicate check');
    }

    for (const photo of data) {
      if (
        !photo ||
        typeof photo !== 'object' ||
        !('id' in photo) ||
        !('url' in photo) ||
        typeof photo.id !== 'string' ||
        typeof photo.url !== 'string' ||
        cachedHashes[photo.id]
      ) {
        continue;
      }

      const mediaType =
        'media_type' in photo && (photo.media_type === 'video' || photo.media_type === 'image')
          ? photo.media_type
          : 'image';

      if (mediaType !== 'image') {
        continue;
      }

      try {
        cachedHashes[photo.id] = await hashPhotoUrl(photo.url);
      } catch {
        // Skip photos we cannot hash; upload still proceeds.
      }
    }

    tripHashCacheRef.current[tripId] = cachedHashes;
    return new Set(Object.values(cachedHashes));
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const tripId = new URLSearchParams(window.location.search).get('tripId');
    if (!tripId) {
      return;
    }

    setTripFilter(tripId);
    setFormData((previous) => ({
      ...previous,
      tripId,
    }));
  }, []);

  useEffect(() => {
    void loadData();
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!selectedGalleryId) {
      setGalleryPhotos([]);
      return;
    }

    const selected = galleries.find((gallery) => gallery.id === selectedGalleryId);
    if (selected) {
      void loadGalleryPhotos(selected);
    }
  }, [selectedGalleryId, galleries]);

  useEffect(() => {
    if (filteredGalleries.length === 0) {
      setSelectedGalleryId(null);
      return;
    }

    if (!selectedGalleryId || !filteredGalleries.some((gallery) => gallery.id === selectedGalleryId)) {
      setSelectedGalleryId(filteredGalleries[0].id);
    }
  }, [filteredGalleries, selectedGalleryId]);

  const loadCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      setIsAdmin(profile.role === 'admin' || profile.role === 'super_admin');
    }
  };

  const loadData = async (preferredGalleryId?: string) => {
    try {
      setLoading(true);
      setError('');

      const [
        { data: tripsData, error: tripsError },
        { data: galleriesData, error: galleriesError },
        metricsResponse,
      ] = await Promise.all([
        supabase.from('trips').select('*').order('start_date', { ascending: false }),
        supabase.from('galleries').select('*').order('created_at', { ascending: false }),
        fetch('/api/galleries/metrics', { credentials: 'include' }),
      ]);

      if (tripsError || galleriesError) {
        throw new Error(tripsError?.message || galleriesError?.message || 'Failed to load galleries');
      }

      const nextTrips = tripsData || [];
      const nextGalleries = galleriesData || [];

      setTrips(nextTrips);

      let metrics: GalleryMetricsPayload = { byTrip: {}, byGallery: {} };
      if (metricsResponse.ok) {
        const payload: unknown = await metricsResponse.json();
        if (payload && typeof payload === 'object') {
          const maybePayload = payload as Partial<GalleryMetricsPayload>;
          if (maybePayload.byTrip && maybePayload.byGallery) {
            metrics = {
              byTrip: maybePayload.byTrip,
              byGallery: maybePayload.byGallery,
            };
          }
        }
      } else {
        const metricsError = await metricsResponse.json().catch(() => null);
        console.warn('Gallery metrics request failed; rendering counts as zero:', metricsError);
      }

      const tripAllEntries: GalleryWithTrip[] = nextTrips.map((trip) => {
        const tripMetric = metrics.byTrip[trip.id];
        return {
          id: `trip-all:${trip.id}`,
          trip_id: trip.id,
          name: `${trip.name} (All Photos)`,
          description: 'Master trip gallery shown in the public website gallery.',
          created_by: trip.created_by,
          created_at: trip.created_at,
          updated_at: trip.updated_at,
          trip,
          photoCount: tripMetric?.count || 0,
          lastUpdatedAt: tripMetric?.lastPhotoAt || trip.updated_at || trip.created_at,
          albumThumbnailUrl: trip.cover_image_url || null,
          source: 'trip_all',
        };
      });

      const namedGalleryEntries: GalleryWithTrip[] = nextGalleries.map((gallery) => {
        const galleryMetric = metrics.byGallery[gallery.id];
        const linkedTrip = nextTrips.find((trip) => trip.id === gallery.trip_id);
        return {
          ...gallery,
          trip: linkedTrip,
          photoCount: galleryMetric?.count || 0,
          lastUpdatedAt: galleryMetric?.lastPhotoAt || gallery.updated_at || gallery.created_at,
          albumThumbnailUrl: linkedTrip?.cover_image_url || null,
          source: 'gallery',
        };
      });

      const enriched = [...tripAllEntries, ...namedGalleryEntries];

      setGalleries(enriched);

      const targetGalleryId = preferredGalleryId || selectedGalleryId;
      if (targetGalleryId && enriched.some((gallery) => gallery.id === targetGalleryId)) {
        setSelectedGalleryId(targetGalleryId);
      } else if (enriched.length > 0) {
        setSelectedGalleryId(enriched[0].id);
      } else {
        setSelectedGalleryId(null);
      }
    } catch (err) {
      console.error('Failed to load gallery data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load galleries and trips');
    } finally {
      setLoading(false);
    }
  };

  const loadGalleryPhotos = async (gallery: GalleryWithTrip) => {
    try {
      setPhotosLoading(true);

      const endpoint =
        gallery.source === 'trip_all'
          ? `/api/trips/${gallery.trip_id}/photos`
          : `/api/galleries/${gallery.id}`;

      const response = await fetch(endpoint, { credentials: 'include' });
      const data = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(data, `Failed to load gallery photos (HTTP ${response.status})`)
        );
      }

      const rawPhotos =
        gallery.source === 'trip_all'
          ? data
          : data && typeof data === 'object' && 'photos' in data
            ? data.photos
            : null;

      const parsedPhotos: GalleryPhoto[] = Array.isArray(rawPhotos)
        ? rawPhotos
            .map((photo): GalleryPhoto | null => {
              if (!photo || typeof photo !== 'object') {
                return null;
              }

              const raw = photo as RawPhotoResponse;
              if (
                !raw.id ||
                !raw.trip_id ||
                !raw.uploaded_by ||
                !raw.storage_path ||
                !raw.created_at ||
                !raw.url
              ) {
                return null;
              }

              return {
                id: raw.id,
                trip_id: raw.trip_id,
                gallery_id: raw.gallery_id ?? null,
                uploaded_by: raw.uploaded_by,
                storage_path: raw.storage_path,
                caption: raw.caption ?? null,
                media_type: raw.media_type === 'video' ? 'video' : 'image',
                mime_type: raw.mime_type ?? null,
                width: raw.width ?? null,
                height: raw.height ?? null,
                created_at: raw.created_at,
                uploader_name:
                  raw.uploader_name ||
                  (Array.isArray(raw.profiles)
                    ? raw.profiles[0]?.nickname || raw.profiles[0]?.full_name || 'Unknown'
                    : raw.profiles?.nickname || raw.profiles?.full_name || 'Unknown'),
                url: raw.url,
              };
            })
            .filter((photo): photo is GalleryPhoto => photo !== null)
        : [];

      setGalleryPhotos(parsedPhotos);
    } catch (err) {
      console.error('Failed to load selected gallery photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load gallery photos');
      setGalleryPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) {
      return 'Unknown';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown';
    }
    return parsed.toLocaleDateString();
  };

  const handleCreateGallery = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();

    if (!formData.tripId || !formData.name.trim()) {
      setError('Trip and gallery name are required.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trip_id: formData.tripId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create gallery');
      }

      const newGalleryId = data.gallery?.id as string | undefined;
      setSuccess('Gallery created successfully.');
      setFormData({
        tripId: formData.tripId,
        name: '',
        description: '',
      });
      await loadData(newGalleryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create gallery');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingGallery = (gallery: GalleryWithTrip) => {
    if (gallery.source !== 'gallery') {
      return;
    }

    setEditingGalleryId(gallery.id);
    setEditForm({
      name: gallery.name,
      description: gallery.description || '',
      trip_id: gallery.trip_id,
    });
  };

  const handleUpdateGallery = async (galleryId: string) => {
    resetMessages();

    if (!editForm.name.trim()) {
      setError('Gallery name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/galleries/${galleryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          trip_id: editForm.trip_id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update gallery');
      }

      setEditingGalleryId(null);
      setSuccess('Gallery updated successfully.');
      await loadData(galleryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update gallery');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGallery = async (gallery: GalleryWithTrip) => {
    if (gallery.source !== 'gallery') {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${gallery.name}" and all ${gallery.photoCount} linked item(s)? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    resetMessages();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/galleries/${gallery.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete gallery');
      }

      setSuccess(`Gallery deleted. Removed ${data.deleted_photos || 0} item(s).`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete gallery');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadToGallery = async (gallery: GalleryWithTrip, files: File[]) => {
    if (files.length === 0) {
      return;
    }

    resetMessages();
    setUploadingGalleryId(gallery.id);
    const imageFiles = files.filter((file) => isImageUploadFile(file));
    const blockedCount = files.length - imageFiles.length;

    if (imageFiles.length === 0) {
      setError('Video uploads are temporarily disabled. Please upload images only.');
      setUploadingGalleryId(null);
      return;
    }

    const uploadFileItems = imageFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.size}`,
      file,
    }));
    setUploadItems(
      uploadFileItems.map((item) => ({
        id: item.id,
        name: item.file.name,
        size: item.file.size,
        status: 'queued',
      }))
    );
    setUploadStatusText(
      `Preparing ${imageFiles.length} file${imageFiles.length !== 1 ? 's' : ''}${
        blockedCount > 0 ? ` (${blockedCount} video file${blockedCount !== 1 ? 's' : ''} skipped)` : ''
      }...`
    );
    if (blockedCount > 0) {
      setError(
        `Skipped ${blockedCount} video file${blockedCount !== 1 ? 's' : ''}. Video uploads are temporarily disabled.`
      );
    }
    setUploadBatchInfo({ current: 0, total: 0 });

    let successCount = 0;
    const failedFiles: string[] = [];
    const MAX_FILES_PER_BATCH = 10;
    const MAX_BATCH_BYTES = 25 * 1024 * 1024;

    try {
      const imageUploadItems = uploadFileItems.filter((item) => isImageUploadFile(item.file));

      let filesToUpload = uploadFileItems;
      if (imageUploadItems.length > 0) {
        setUploadStatusText('Checking for duplicate images...');

        const selectedHashEntries = await Promise.all(
          imageUploadItems.map(async (item) => ({
            id: item.id,
            hash: await hashFile(item.file),
          }))
        );

        const firstSeenByHash = new Map<string, string>();
        const duplicateWithinSelection = new Set<string>();
        selectedHashEntries.forEach((entry) => {
          const existing = firstSeenByHash.get(entry.hash);
          if (existing) {
            duplicateWithinSelection.add(entry.id);
          } else {
            firstSeenByHash.set(entry.hash, entry.id);
          }
        });

        const existingTripHashes = await getTripPhotoHashes(gallery.trip_id);
        const duplicateInTrip = new Set(
          selectedHashEntries
            .filter((entry) => existingTripHashes.has(entry.hash))
            .map((entry) => entry.id)
        );

        const duplicateIds = new Set<string>([
          ...Array.from(duplicateWithinSelection),
          ...Array.from(duplicateInTrip),
        ]);

        if (duplicateIds.size > 0) {
          const choice = window.prompt(
            [
              'Duplicate check found possible duplicate images.',
              `${duplicateInTrip.size} already exist in trip galleries.`,
              `${duplicateWithinSelection.size} are duplicates within this selection.`,
              '',
              'Choose action:',
              '1 = Upload non-duplicates only (recommended)',
              '2 = Upload all files anyway',
              '3 = Cancel upload',
            ].join('\n'),
            '1'
          );

          if (choice === null || choice.trim() === '3') {
            setUploadStatusText('Upload canceled by user.');
            setUploadItems((previous) =>
              previous.map((item) => ({ ...item, status: 'skipped', error: 'Canceled by user' }))
            );
            return;
          }

          if (choice.trim() === '1') {
            filesToUpload = uploadFileItems.filter((item) => !duplicateIds.has(item.id));
            setUploadItems((previous) =>
              previous.map((item) =>
                duplicateIds.has(item.id)
                  ? { ...item, status: 'skipped', error: 'Skipped duplicate image' }
                  : item
              )
            );
            setUploadStatusText(
              `Skipping ${duplicateIds.size} duplicate image file${duplicateIds.size !== 1 ? 's' : ''}.`
            );
          } else {
            setUploadStatusText('Uploading all files including duplicate images...');
          }
        } else {
          setUploadStatusText('No duplicate images found. Starting upload...');
        }
      } else {
        setUploadStatusText('No images selected. Starting upload...');
      }

      if (filesToUpload.length === 0) {
        setSuccess('No new files to upload after duplicate filtering.');
        return;
      }

      const batches: Array<Array<{ id: string; file: File }>> = [];
      let currentBatch: Array<{ id: string; file: File }> = [];
      let currentBatchBytes = 0;

      for (const uploadFileItem of filesToUpload) {
        const { file } = uploadFileItem;
        const shouldStartNewBatch =
          currentBatch.length >= MAX_FILES_PER_BATCH ||
          currentBatchBytes + file.size > MAX_BATCH_BYTES;

        if (shouldStartNewBatch && currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchBytes = 0;
        }

        currentBatch.push(uploadFileItem);
        currentBatchBytes += file.size;
      }

      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      setUploadBatchInfo({ current: 0, total: batches.length });

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex];
        const batchIds = batch.map((item) => item.id);

        setUploadBatchInfo({ current: batchIndex + 1, total: batches.length });
        setUploadStatusText(`Uploading batch ${batchIndex + 1} of ${batches.length}...`);
        setUploadItems((previous) =>
          previous.map((item) =>
            batchIds.includes(item.id) ? { ...item, status: 'uploading', error: undefined } : item
          )
        );

        const endpoint =
          gallery.source === 'trip_all'
            ? `/api/trips/${gallery.trip_id}/photos/upload`
            : `/api/galleries/${gallery.id}`;

        const signResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'sign',
            files: batch.map((item) => ({
              name: item.file.name,
              type: resolveUploadMimeType(item.file) || item.file.type,
              size: item.file.size,
              caption: null,
            })),
          }),
        });

        const signPayload = await parseJsonSafely(signResponse);
        if (!signResponse.ok) {
          failedFiles.push(...batch.map((item) => item.file.name));
          setUploadItems((previous) =>
            previous.map((item) =>
              batchIds.includes(item.id)
                ? {
                    ...item,
                    status: 'failed',
                    error: extractErrorMessage(
                      signPayload,
                      `Upload failed (HTTP ${signResponse.status})`
                    ),
                  }
                : item
            )
          );
          continue;
        }

        const signedUploadsRaw =
          signPayload &&
          typeof signPayload === 'object' &&
          Array.isArray((signPayload as { uploads?: unknown }).uploads)
            ? ((signPayload as { uploads: unknown[] }).uploads as unknown[])
            : [];

        const signedUploadsByIndex = new Map<
          number,
          {
            token: string;
            filePath: string;
            mediaType: 'image' | 'video';
            mimeType: string | null;
          }
        >();

        for (const upload of signedUploadsRaw) {
          if (!upload || typeof upload !== 'object') {
            continue;
          }

          const inputIndex =
            'input_index' in upload && typeof upload.input_index === 'number'
              ? upload.input_index
              : -1;
          const token = 'token' in upload && typeof upload.token === 'string' ? upload.token : '';
          const filePath =
            'file_path' in upload && typeof upload.file_path === 'string' ? upload.file_path : '';
          const mediaType =
            'media_type' in upload && (upload.media_type === 'image' || upload.media_type === 'video')
              ? upload.media_type
              : null;
          const mimeType =
            'mime_type' in upload && typeof upload.mime_type === 'string' ? upload.mime_type : null;

          if (
            inputIndex < 0 ||
            inputIndex >= batch.length ||
            !token ||
            !filePath ||
            !mediaType
          ) {
            continue;
          }

          signedUploadsByIndex.set(inputIndex, {
            token,
            filePath,
            mediaType,
            mimeType,
          });
        }

        const batchFailures = new Map<string, string>();
        const uploadsToFinalize: Array<{
          itemId: string;
          fileName: string;
          filePath: string;
          mediaType: 'image' | 'video';
          mimeType: string | null;
        }> = [];

        for (let batchFileIndex = 0; batchFileIndex < batch.length; batchFileIndex += 1) {
          const signedUpload = signedUploadsByIndex.get(batchFileIndex);
          const batchItem = batch[batchFileIndex];

          if (!signedUpload) {
            batchFailures.set(batchItem.id, 'Failed to prepare upload');
            continue;
          }

          const { error: storageError } = await supabase.storage
            .from('photos')
            .uploadToSignedUrl(signedUpload.filePath, signedUpload.token, batchItem.file, {
              cacheControl: '3600',
              contentType: resolveUploadMimeType(batchItem.file, signedUpload.mimeType) || undefined,
            });

          if (storageError) {
            batchFailures.set(batchItem.id, storageError.message || 'Failed to upload to storage');
            continue;
          }

          uploadsToFinalize.push({
            itemId: batchItem.id,
            fileName: batchItem.file.name,
            filePath: signedUpload.filePath,
            mediaType: signedUpload.mediaType,
            mimeType: resolveUploadMimeType(batchItem.file, signedUpload.mimeType),
          });
        }

        if (uploadsToFinalize.length > 0) {
          const finalizeEndpoint =
            gallery.source === 'trip_all' ? `${endpoint}?detailed=1` : endpoint;

          const finalizeResponse = await fetch(finalizeEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              action: 'finalize',
              uploads: uploadsToFinalize.map((item) => ({
                file_path: item.filePath,
                caption: null,
                media_type: item.mediaType,
                mime_type: item.mimeType,
              })),
            }),
          });

          const finalizePayload = await parseJsonSafely(finalizeResponse);

          if (!finalizeResponse.ok) {
            const finalizeErrorMessage = extractErrorMessage(
              finalizePayload,
              `Failed to finalize upload (HTTP ${finalizeResponse.status})`
            );
            uploadsToFinalize.forEach((item) => {
              if (!batchFailures.has(item.itemId)) {
                batchFailures.set(item.itemId, finalizeErrorMessage);
              }
            });
          } else {
            const successPaths = new Set<string>();
            const maybePayload =
              finalizePayload && typeof finalizePayload === 'object'
                ? (finalizePayload as {
                    photos?: unknown;
                    photo?: unknown;
                    failed?: unknown;
                  })
                : null;

            const addPathFromEntry = (entry: unknown) => {
              if (
                entry &&
                typeof entry === 'object' &&
                'storage_path' in entry &&
                typeof entry.storage_path === 'string'
              ) {
                successPaths.add(entry.storage_path);
              }
            };

            if (Array.isArray(finalizePayload)) {
              finalizePayload.forEach((entry) => addPathFromEntry(entry));
            } else if (maybePayload && Array.isArray(maybePayload.photos)) {
              maybePayload.photos.forEach((entry) => addPathFromEntry(entry));
            } else if (maybePayload?.photo) {
              addPathFromEntry(maybePayload.photo);
            }

            const failedFinalizeEntries = new Set<string>(
              maybePayload && Array.isArray(maybePayload.failed)
                ? maybePayload.failed.filter(
                    (entry: unknown): entry is string => typeof entry === 'string'
                  )
                : []
            );

            uploadsToFinalize.forEach((item) => {
              if (successPaths.has(item.filePath)) {
                return;
              }

              const didFinalizeFail =
                failedFinalizeEntries.has(item.filePath) ||
                failedFinalizeEntries.has(item.fileName);

              if (didFinalizeFail || successPaths.size > 0) {
                batchFailures.set(item.itemId, 'Failed to finalize upload');
              }
            });
          }
        }

        const failedById = new Map<string, string>();
        batchFailures.forEach((reason, id) => {
          failedById.set(id, reason);
        });

        const batchSuccessItems = batch.filter((item) => !failedById.has(item.id));
        const batchFailedItems = batch.filter((item) => failedById.has(item.id));

        successCount += batchSuccessItems.length;
        failedFiles.push(...batchFailedItems.map((item) => item.file.name));

        setUploadItems((previous) =>
          previous.map((item) => {
            if (!batchIds.includes(item.id)) {
              return item;
            }

            const failureReason = failedById.get(item.id);
            if (failureReason) {
              return { ...item, status: 'failed', error: failureReason };
            }

            return { ...item, status: 'success', error: undefined };
          })
        );
      }

      if (successCount > 0) {
        setSuccess(`Uploaded ${successCount} media file${successCount !== 1 ? 's' : ''}.`);
      }

      if (failedFiles.length > 0) {
        setError(`Failed to upload: ${failedFiles.join(', ')}`);
      }

      if (failedFiles.length === 0) {
        setUploadStatusText(`Upload complete. ${successCount} file${successCount !== 1 ? 's' : ''} uploaded.`);
      } else {
        setUploadStatusText(
          `Upload finished with issues. ${successCount} uploaded, ${failedFiles.length} failed.`
        );
      }

      await loadData(gallery.id);
      if (selectedGalleryId === gallery.id) {
        await loadGalleryPhotos(gallery);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload images';
      setError(message);
      setUploadStatusText(`Upload failed: ${message}`);
      setUploadItems((previous) =>
        previous.map((item) =>
          item.status === 'success' ? item : { ...item, status: 'failed', error: message }
        )
      );
    } finally {
      setUploadingGalleryId(null);
      setUploadBatchInfo((previous) => ({ ...previous, current: previous.total }));
    }
  };

  const updateTripAlbumThumbnail = async (tripId: string, photoUrl: string | null) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('You must be signed in to update album thumbnails.');
    }

    const response = await fetch(`/api/trips/${tripId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ cover_image_url: photoUrl }),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : 'Failed to update album thumbnail';
      throw new Error(errorMessage);
    }
  };

  const handleSetAlbumThumbnail = async (photo: GalleryPhoto) => {
    if (!selectedGallery) {
      return;
    }
    if (photo.media_type === 'video') {
      setError('Album cover must be an image.');
      return;
    }

    resetMessages();
    setSettingThumbnailPhotoId(photo.id);

    try {
      await updateTripAlbumThumbnail(selectedGallery.trip_id, photo.url);
      setSuccess('Album thumbnail updated.');
      await loadData(selectedGallery.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update album thumbnail');
    } finally {
      setSettingThumbnailPhotoId(null);
    }
  };

  const handleClearAlbumThumbnail = async () => {
    if (!selectedGallery) {
      return;
    }

    resetMessages();
    setSettingThumbnailPhotoId('clearing');

    try {
      await updateTripAlbumThumbnail(selectedGallery.trip_id, null);
      setSuccess('Album thumbnail cleared.');
      await loadData(selectedGallery.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear album thumbnail');
    } finally {
      setSettingThumbnailPhotoId(null);
    }
  };

  const handleManageGallery = (galleryId: string) => {
    setSelectedGalleryId(galleryId);
    setTimeout(() => {
      managementSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

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
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Manage Galleries</h1>
        <p className="text-brand-cream/70">
          Master control for all trip galleries and named galleries.
        </p>
      </div>

      {(error || success) && (
        <div className="space-y-3">
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded text-red-200">{error}</div>
          )}
          {success && (
            <div className="p-4 bg-green-900/30 border border-green-700 rounded text-green-200">{success}</div>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create New Gallery</CardTitle>
          <CardDescription>Create a gallery for a trip and start uploading photos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateGallery} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-brand-cream mb-1">Trip</label>
              <select
                value={formData.tripId}
                onChange={(event) => setFormData({ ...formData, tripId: event.target.value })}
                className="w-full px-3 py-2 bg-brand-dark-grey border border-brand-brown/30 rounded text-brand-cream focus:outline-none focus:border-brand-brown"
              >
                <option value="">Select a trip</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name} ({trip.destination})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-brand-cream mb-1">Name</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="e.g. Day 01 Highlights"
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-brand-cream mb-1">Description</label>
              <Input
                type="text"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                placeholder="Optional description"
              />
            </div>
            <Button type="submit" disabled={submitting} className="md:col-span-1">
              {submitting ? 'Creating...' : 'Create Gallery'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gallery List</CardTitle>
          <CardDescription>
            {galleries.length} total gallery views across {trips.length} trip{trips.length !== 1 ? 's' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <label className="block text-sm font-medium text-brand-cream mb-1">Filter by Trip</label>
            <select
              value={tripFilter}
              onChange={(event) => setTripFilter(event.target.value)}
              className="w-full px-3 py-2 bg-brand-dark-grey border border-brand-brown/30 rounded text-brand-cream focus:outline-none focus:border-brand-brown"
            >
              <option value="all">All Trips</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name}
                </option>
              ))}
            </select>
          </div>

          {filteredGalleries.length === 0 ? (
            <div className="py-10 text-center border border-brand-brown/20 rounded-lg">
              <p className="text-brand-cream/70">No galleries found for the selected filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredGalleries.map((gallery) => (
                <Card
                  key={gallery.id}
                  className={
                    selectedGalleryId === gallery.id
                      ? 'border-brand-brown'
                      : 'border border-brand-brown/25'
                  }
                >
                  {gallery.albumThumbnailUrl ? (
                    <div className="h-36 w-full overflow-hidden rounded-t-lg border-b border-brand-brown/20 bg-brand-black">
                      <img
                        src={gallery.albumThumbnailUrl}
                        alt={`${gallery.trip?.name || 'Trip'} album thumbnail`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-36 w-full rounded-t-lg border-b border-brand-brown/20 bg-gradient-to-br from-brand-brown/40 to-brand-black flex items-center justify-center">
                      <p className="text-xs uppercase tracking-wide text-brand-cream/70">
                        No album thumbnail selected
                      </p>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{gallery.name}</CardTitle>
                    <CardDescription>
                      {gallery.trip?.name || 'Unknown Trip'} • {gallery.photoCount} item
                      {gallery.photoCount !== 1 ? 's' : ''}
                      {gallery.source === 'trip_all' ? ' • Trip-wide' : ' • Named gallery'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {editingGalleryId === gallery.id && gallery.source === 'gallery' ? (
                      <div className="space-y-3 border border-brand-brown/20 rounded-lg p-3 bg-brand-brown/10">
                        <div>
                          <label className="block text-xs uppercase tracking-wide text-brand-cream/60 mb-1">
                            Name
                          </label>
                          <Input
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm((previous) => ({ ...previous, name: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-wide text-brand-cream/60 mb-1">
                            Description
                          </label>
                          <Input
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((previous) => ({
                                ...previous,
                                description: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-wide text-brand-cream/60 mb-1">
                            Trip
                          </label>
                          <select
                            value={editForm.trip_id}
                            onChange={(event) =>
                              setEditForm((previous) => ({ ...previous, trip_id: event.target.value }))
                            }
                            className="w-full px-3 py-2 bg-brand-dark-grey border border-brand-brown/30 rounded text-brand-cream focus:outline-none focus:border-brand-brown"
                          >
                            {trips.map((trip) => (
                              <option key={trip.id} value={trip.id}>
                                {trip.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleUpdateGallery(gallery.id)}
                            disabled={submitting}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingGalleryId(null)}
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-brand-cream/70 line-clamp-2">
                          {gallery.description || 'No description'}
                        </p>
                        {gallery.source === 'trip_all' && (
                          <p className="text-xs text-brand-cream/60">
                            This matches the public website gallery for this trip.
                          </p>
                        )}
                        <p className="text-xs text-brand-cream/50">
                          Created {formatDate(gallery.created_at)}
                        </p>
                        <p className="text-xs text-brand-cream/50">
                          Last updated {formatDate(gallery.lastUpdatedAt)}
                        </p>
                      </>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleManageGallery(gallery.id)}
                      >
                        Manage
                      </Button>
                      {gallery.source === 'gallery' ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingGallery(gallery)}
                            disabled={editingGalleryId === gallery.id}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => void handleDeleteGallery(gallery)}
                            disabled={submitting}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <Link
                          href={`/admin/trips/${gallery.trip_id}`}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold rounded-lg border border-brand-brown text-brand-brown hover:bg-brand-brown/10 transition-colors"
                        >
                          Edit Trip
                        </Link>
                      )}
                      {gallery.trip?.slug && (
                        <Link
                          href={`/public/gallery/${gallery.trip.slug}`}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold rounded-lg text-brand-cream hover:bg-brand-dark-grey transition-colors"
                        >
                          View Trip Gallery
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedGallery && (
        <div ref={managementSectionRef}>
          <Card>
          <CardHeader>
            <CardTitle>{selectedGallery.name} - Media Management</CardTitle>
            <CardDescription>
              Upload photos to this gallery, then use bulk tagging and filters below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border border-brand-brown/25 rounded-lg p-4 space-y-2">
              <p className="text-sm text-brand-cream/80">
                Upload to: <span className="font-semibold">{selectedGallery.name}</span>
              </p>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-brand-cream/60">Album Thumbnail</p>
                {selectedGallery.albumThumbnailUrl ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <img
                      src={selectedGallery.albumThumbnailUrl}
                      alt={`${selectedGallery.trip?.name || 'Trip'} album thumbnail`}
                      className="h-20 w-32 rounded border border-brand-brown/30 object-cover"
                    />
                    <div className="space-y-2">
                      <p className="text-xs text-brand-cream/60">
                        Current thumbnail shown on the public trip gallery list.
                      </p>
                      {isAdmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleClearAlbumThumbnail()}
                          disabled={settingThumbnailPhotoId === 'clearing'}
                        >
                          {settingThumbnailPhotoId === 'clearing' ? 'Clearing...' : 'Clear Thumbnail'}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-brand-cream/60">
                    No thumbnail selected.
                    {isAdmin ? ' Use "Set As Album Cover" on an image below.' : ''}
                  </p>
                )}
              </div>
              {selectedGallery.source === 'trip_all' && (
                <p className="text-xs text-brand-cream/60">
                  Uploading here adds media directly to the public trip gallery.
                </p>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  void handleUploadToGallery(selectedGallery, files);
                  event.target.value = '';
                }}
                className="block w-full text-sm text-brand-cream/80"
                disabled={uploadingGalleryId === selectedGallery.id}
              />
              {uploadingGalleryId === selectedGallery.id && (
                <p className="text-xs text-brand-cream/60">Uploading media...</p>
              )}

              {uploadItems.length > 0 && (
                <div className="mt-3 rounded-lg border border-brand-brown/25 bg-brand-brown/10 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-brand-cream/80">
                    <span>{uploadStatusText || 'Uploading...'}</span>
                    <span>
                      {uploadSummary.completed}/{uploadSummary.total} complete
                    </span>
                  </div>

                  <div className="h-2 w-full bg-brand-black/40 rounded overflow-hidden">
                    <div
                      className="h-full bg-brand-brown transition-all duration-300"
                      style={{ width: `${uploadSummary.progressPercent}%` }}
                    />
                  </div>

                  <div className="text-xs text-brand-cream/70">
                    {uploadSummary.success} success • {uploadSummary.failed} failed • {uploadSummary.uploading}{' '}
                    uploading • {uploadSummary.queued} queued • {uploadSummary.skipped} skipped
                    {uploadBatchInfo.total > 0 &&
                      ` • batch ${uploadBatchInfo.current}/${uploadBatchInfo.total}`}
                  </div>

                  <div className="max-h-36 overflow-auto space-y-1 pr-1">
                    {uploadItems.slice(0, 200).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-brand-cream/80 truncate pr-3">{item.name}</span>
                        <span
                          className={
                            item.status === 'success'
                              ? 'text-green-400'
                              : item.status === 'failed'
                                ? 'text-red-400'
                                : item.status === 'skipped'
                                  ? 'text-amber-300'
                                : item.status === 'uploading'
                                  ? 'text-brand-tan'
                                  : 'text-brand-cream/50'
                          }
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {photosLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : galleryPhotos.length > 0 ? (
              <PhotoGrid
                photos={galleryPhotos}
                tripId={selectedGallery.trip_id}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                albumThumbnailPhotoUrl={selectedGallery.albumThumbnailUrl}
                settingAlbumThumbnailPhotoId={settingThumbnailPhotoId}
                onSetAlbumThumbnail={isAdmin ? (photo) => handleSetAlbumThumbnail(photo as GalleryPhoto) : undefined}
                onPhotoDelete={(photoId) =>
                  setGalleryPhotos((previous) =>
                    previous.filter((photo) => photo.id !== photoId)
                  )
                }
              />
            ) : (
              <div className="py-12 text-center border border-brand-brown/20 rounded-lg">
                <p className="text-brand-cream/70">No media in this gallery yet.</p>
                <p className="text-sm text-brand-cream/50 mt-1">
                  Upload media above to start tagging.
                </p>
              </div>
            )}
          </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
