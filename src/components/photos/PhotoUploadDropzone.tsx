'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Upload, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UploadProgress {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'skipped';
  error?: string;
}

interface PhotoUploadDropzoneProps {
  tripId: string;
  onUploadComplete?: (count: number) => void;
  onError?: (error: string) => void;
}

export default function PhotoUploadDropzone({
  tripId,
  onUploadComplete,
  onError,
}: PhotoUploadDropzoneProps) {
  const MAX_FILES_PER_BATCH = 10;
  const MAX_BATCH_BYTES = 25 * 1024 * 1024; // Keep each multipart payload comfortably sized
  const DUPLICATE_FINGERPRINT_BYTES = 1024 * 1024; // 1MB

  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const tripHashCacheRef = useRef<Record<string, string>>({});
  const supabase = useMemo(() => createClient(), []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const parseJsonSafely = useCallback(async (response: Response): Promise<unknown> => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const extractErrorMessage = useCallback((payload: unknown, fallback: string) => {
    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
    ) {
      return payload.error;
    }
    return fallback;
  }, []);

  const hashArrayBuffer = useCallback(async (buffer: ArrayBuffer) => {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }, []);

  const fingerprintFile = useCallback(
    async (file: File) => {
      const chunk = await file.slice(0, DUPLICATE_FINGERPRINT_BYTES).arrayBuffer();
      const hash = await hashArrayBuffer(chunk);
      return `${file.size}:${hash}`;
    },
    [DUPLICATE_FINGERPRINT_BYTES, hashArrayBuffer]
  );

  const fingerprintUrl = useCallback(
    async (url: string) => {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          Range: `bytes=0-${DUPLICATE_FINGERPRINT_BYTES - 1}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch existing media (${response.status})`);
      }

      const buffer = await response.arrayBuffer();
      const chunk = buffer.slice(0, Math.min(DUPLICATE_FINGERPRINT_BYTES, buffer.byteLength));
      const hash = await hashArrayBuffer(chunk);
      const contentRange = response.headers.get('content-range');
      const totalFromRange = contentRange?.match(/\/(\d+)$/)?.[1];
      const contentLength = response.headers.get('content-length');
      const inferredSize =
        (totalFromRange ? Number.parseInt(totalFromRange, 10) : Number.NaN) ||
        (contentLength ? Number.parseInt(contentLength, 10) : Number.NaN) ||
        buffer.byteLength;

      return `${inferredSize}:${hash}`;
    },
    [DUPLICATE_FINGERPRINT_BYTES, hashArrayBuffer]
  );

  const getTripMediaFingerprints = useCallback(async () => {
    const cachedHashes = tripHashCacheRef.current;

    const response = await fetch(`/api/trips/${tripId}/photos`, {
      credentials: 'include',
    });
    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          payload,
          `Failed to fetch trip media for duplicate check (HTTP ${response.status})`
        )
      );
    }

    if (!Array.isArray(payload)) {
      throw new Error('Failed to fetch trip media for duplicate check');
    }

    for (const item of payload) {
      if (
        !item ||
        typeof item !== 'object' ||
        !('id' in item) ||
        !('url' in item) ||
        typeof item.id !== 'string' ||
        typeof item.url !== 'string' ||
        cachedHashes[item.id]
      ) {
        continue;
      }

      try {
        cachedHashes[item.id] = await fingerprintUrl(item.url);
      } catch {
        // Ignore fetch/hash failures for existing media; upload can still proceed.
      }
    }

    tripHashCacheRef.current = cachedHashes;
    return new Set(Object.values(cachedHashes));
  }, [extractErrorMessage, fingerprintUrl, parseJsonSafely, tripId]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setUploading(true);

      const mediaFiles = files.filter(
        (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
      );

      if (mediaFiles.length === 0) {
        onError?.('No supported media selected (image/video)');
        setUploading(false);
        return;
      }

      const mediaItems = mediaFiles.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}-${file.size}`,
        file,
      }));
      setUploadProgress(
        mediaItems.map((item) => ({
          id: item.id,
          file: item.file,
          progress: 0,
          status: 'pending' as const,
        }))
      );

      try {
        const failureMessages: string[] = [];
        const selectedFingerprints = await Promise.all(
          mediaItems.map(async (item) => ({
            id: item.id,
            fingerprint: await fingerprintFile(item.file),
          }))
        );

        const firstSelectedByFingerprint = new Map<string, string>();
        const duplicateWithinSelection = new Set<string>();
        selectedFingerprints.forEach((entry) => {
          const existingId = firstSelectedByFingerprint.get(entry.fingerprint);
          if (existingId) {
            duplicateWithinSelection.add(entry.id);
          } else {
            firstSelectedByFingerprint.set(entry.fingerprint, entry.id);
          }
        });

        const existingTripFingerprints = await getTripMediaFingerprints();
        const duplicateInTrip = new Set(
          selectedFingerprints
            .filter((entry) => existingTripFingerprints.has(entry.fingerprint))
            .map((entry) => entry.id)
        );

        const duplicateIds = new Set<string>([
          ...Array.from(duplicateWithinSelection),
          ...Array.from(duplicateInTrip),
        ]);

        let itemsToUpload = mediaItems;
        if (duplicateIds.size > 0) {
          itemsToUpload = mediaItems.filter((item) => !duplicateIds.has(item.id));
          setUploadProgress((previous) =>
            previous.map((item) =>
              duplicateIds.has(item.id)
                ? { ...item, status: 'skipped', error: 'Skipped duplicate media' }
                : item
            )
          );
        }

        if (itemsToUpload.length === 0) {
          onError?.('No new media to upload. Selected files are duplicates of existing trip media.');
          setTimeout(() => {
            setUploading(false);
          }, 1200);
          return;
        }

        // Upload in smaller batches so large bulk uploads do not create oversized multipart payloads.
        const batches: Array<Array<{ id: string; file: File }>> = [];
        let currentBatch: Array<{ id: string; file: File }> = [];
        let currentBatchBytes = 0;

        for (const item of itemsToUpload) {
          const file = item.file;
          const shouldStartNewBatch =
            currentBatch.length >= MAX_FILES_PER_BATCH ||
            currentBatchBytes + file.size > MAX_BATCH_BYTES;

          if (shouldStartNewBatch && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentBatchBytes = 0;
          }

          currentBatch.push(item);
          currentBatchBytes += file.size;
        }

        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }

        let totalUploaded = 0;
        let totalFailed = 0;

        for (const batch of batches) {
          const batchIds = batch.map((item) => item.id);
          setUploadProgress((previous) =>
            previous.map((item) =>
              batchIds.includes(item.id) ? { ...item, status: 'uploading', error: undefined } : item
            )
          );

          const signResponse = await fetch(`/api/trips/${tripId}/photos/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              action: 'sign',
              files: batch.map((item) => ({
                name: item.file.name,
                type: item.file.type,
                size: item.file.size,
              })),
            }),
          });

          const signPayload = await parseJsonSafely(signResponse);
          if (!signResponse.ok) {
            const message = extractErrorMessage(
              signPayload,
              `Upload failed while preparing media (HTTP ${signResponse.status})`
            );
            failureMessages.push(message);
            totalFailed += batch.length;
            setUploadProgress((previous) =>
              previous.map((item) =>
                batchIds.includes(item.id) ? { ...item, status: 'error', error: message } : item
              )
            );
            continue;
          }

          const signedUploads =
            signPayload &&
            typeof signPayload === 'object' &&
            'uploads' in signPayload &&
            Array.isArray(signPayload.uploads)
              ? signPayload.uploads
              : [];
          const signFailedNames =
            signPayload &&
            typeof signPayload === 'object' &&
            'failed' in signPayload &&
            Array.isArray(signPayload.failed)
              ? signPayload.failed
              : [];
          const signFailedDetails =
            signPayload &&
            typeof signPayload === 'object' &&
            'failed_details' in signPayload &&
            Array.isArray(signPayload.failed_details)
              ? signPayload.failed_details
              : [];

          const uploadsToFinalize: Array<{
            itemId: string;
            payload: {
              file_path: string;
              caption: null;
              media_type: 'image' | 'video';
              mime_type: string | null;
            };
          }> = [];
          const localFailedIds = new Set<string>();
          const localFailureMessageById = new Map<string, string>();

          signFailedNames.forEach((failedName) => {
            if (typeof failedName !== 'string') {
              return;
            }
            const matching = batch.find((item) => item.file.name === failedName);
            if (matching) {
              localFailedIds.add(matching.id);
              localFailureMessageById.set(matching.id, 'Failed to prepare upload');
            }
          });
          signFailedDetails.forEach((detail) => {
            if (!detail || typeof detail !== 'object') {
              return;
            }

            const inputIndex =
              'input_index' in detail && typeof detail.input_index === 'number'
                ? detail.input_index
                : -1;
            const reason =
              'reason' in detail && typeof detail.reason === 'string'
                ? detail.reason
                : 'Failed to prepare upload';
            const originalName =
              'original_name' in detail && typeof detail.original_name === 'string'
                ? detail.original_name
                : '';

            if (inputIndex >= 0 && inputIndex < batch.length) {
              const itemId = batch[inputIndex].id;
              localFailedIds.add(itemId);
              localFailureMessageById.set(itemId, reason);
              return;
            }

            if (originalName) {
              const matching = batch.find((item) => item.file.name === originalName);
              if (matching) {
                localFailedIds.add(matching.id);
                localFailureMessageById.set(matching.id, reason);
              }
            }
          });

          for (const signedUpload of signedUploads) {
            if (!signedUpload || typeof signedUpload !== 'object') {
              continue;
            }
            const inputIndex =
              typeof signedUpload.input_index === 'number' ? signedUpload.input_index : -1;
            const filePath =
              typeof signedUpload.file_path === 'string' ? signedUpload.file_path : '';
            const token = typeof signedUpload.token === 'string' ? signedUpload.token : '';
            const mediaType =
              signedUpload.media_type === 'video' || signedUpload.media_type === 'image'
                ? signedUpload.media_type
                : null;
            const mimeType =
              typeof signedUpload.mime_type === 'string' ? signedUpload.mime_type : null;

            if (inputIndex < 0 || inputIndex >= batch.length || !filePath || !token || !mediaType) {
              if (inputIndex >= 0 && inputIndex < batch.length) {
                const invalidId = batch[inputIndex].id;
                localFailedIds.add(invalidId);
                localFailureMessageById.set(invalidId, 'Invalid signed upload payload');
              }
              continue;
            }

            const batchItem = batch[inputIndex];
            const file = batchItem.file;
            const { error: signedUploadError } = await supabase.storage
              .from('photos')
              .uploadToSignedUrl(filePath, token, file, {
                cacheControl: '3600',
                contentType: file.type || mimeType || undefined,
              });

            if (signedUploadError) {
              localFailedIds.add(batchItem.id);
              localFailureMessageById.set(
                batchItem.id,
                signedUploadError.message || 'Failed to upload to storage'
              );
              continue;
            }

            uploadsToFinalize.push({
              itemId: batchItem.id,
              payload: {
                file_path: filePath,
                caption: null,
                media_type: mediaType,
                mime_type: mimeType || file.type || null,
              },
            });
          }

          if (uploadsToFinalize.length === 0) {
            if (localFailedIds.size > 0) {
              totalFailed += localFailedIds.size;
              localFailedIds.forEach((id) => {
                const reason = localFailureMessageById.get(id);
                if (reason) {
                  failureMessages.push(reason);
                }
              });
              setUploadProgress((previous) =>
                previous.map((item) =>
                  localFailedIds.has(item.id)
                    ? {
                        ...item,
                        status: 'error',
                        error: localFailureMessageById.get(item.id) || 'Failed to upload to storage',
                      }
                    : item
                )
              );
            }
            continue;
          }

          const finalizeResponse = await fetch(`/api/trips/${tripId}/photos/upload?detailed=1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              action: 'finalize',
              uploads: uploadsToFinalize.map((entry) => entry.payload),
            }),
          });
          const finalizePayload = await parseJsonSafely(finalizeResponse);

          if (!finalizeResponse.ok) {
            const message = extractErrorMessage(
              finalizePayload,
              `Failed to finalize upload (HTTP ${finalizeResponse.status})`
            );
            failureMessages.push(message);
            const failedIds = new Set<string>([
              ...Array.from(localFailedIds),
              ...uploadsToFinalize.map((entry) => entry.itemId),
            ]);
            const failedDetailByPath = new Map<string, string>();
            if (
              finalizePayload &&
              typeof finalizePayload === 'object' &&
              'failed_details' in finalizePayload &&
              Array.isArray(finalizePayload.failed_details)
            ) {
              finalizePayload.failed_details.forEach((detail) => {
                if (!detail || typeof detail !== 'object') {
                  return;
                }
                const path =
                  'file_path' in detail && typeof detail.file_path === 'string'
                    ? detail.file_path
                    : '';
                const reason =
                  'reason' in detail && typeof detail.reason === 'string' ? detail.reason : message;
                if (path) {
                  failedDetailByPath.set(path, reason);
                }
              });
            }
            totalFailed += failedIds.size;
            setUploadProgress((previous) =>
              previous.map((item) =>
                failedIds.has(item.id)
                  ? {
                      ...item,
                      status: 'error',
                      error: (() => {
                        const uploadEntry = uploadsToFinalize.find((entry) => entry.itemId === item.id);
                        if (!uploadEntry) {
                          return message;
                        }
                        return failedDetailByPath.get(uploadEntry.payload.file_path) || message;
                      })(),
                    }
                  : item
              )
            );
            continue;
          }

          const successfulPaths = new Set<string>();
          const failedPaths = new Set<string>();
          const failedDetailByPath = new Map<string, string>();

          if (Array.isArray(finalizePayload)) {
            finalizePayload.forEach((entry) => {
              if (
                entry &&
                typeof entry === 'object' &&
                'storage_path' in entry &&
                typeof entry.storage_path === 'string'
              ) {
                successfulPaths.add(entry.storage_path);
              }
            });
          } else if (finalizePayload && typeof finalizePayload === 'object') {
            if ('photos' in finalizePayload && Array.isArray(finalizePayload.photos)) {
              finalizePayload.photos.forEach((entry) => {
                if (
                  entry &&
                  typeof entry === 'object' &&
                  'storage_path' in entry &&
                  typeof entry.storage_path === 'string'
                ) {
                  successfulPaths.add(entry.storage_path);
                }
              });
            } else if (
              'photo' in finalizePayload &&
              finalizePayload.photo &&
              typeof finalizePayload.photo === 'object' &&
              'storage_path' in finalizePayload.photo &&
              typeof finalizePayload.photo.storage_path === 'string'
            ) {
              successfulPaths.add(finalizePayload.photo.storage_path);
            }

            if ('failed' in finalizePayload && Array.isArray(finalizePayload.failed)) {
              finalizePayload.failed.forEach((entry) => {
                if (typeof entry === 'string') {
                  failedPaths.add(entry);
                }
              });
            }
            if ('failed_details' in finalizePayload && Array.isArray(finalizePayload.failed_details)) {
              finalizePayload.failed_details.forEach((entry) => {
                if (!entry || typeof entry !== 'object') {
                  return;
                }
                const path =
                  'file_path' in entry && typeof entry.file_path === 'string' ? entry.file_path : '';
                const reason = 'reason' in entry && typeof entry.reason === 'string' ? entry.reason : '';
                if (path && reason) {
                  failedDetailByPath.set(path, reason);
                }
              });
            }
          }

          const successIds = new Set<string>();
          const failedIds = new Set<string>(localFailedIds);

          uploadsToFinalize.forEach((entry) => {
            if (successfulPaths.has(entry.payload.file_path)) {
              successIds.add(entry.itemId);
              return;
            }
            if (failedPaths.has(entry.payload.file_path)) {
              failedIds.add(entry.itemId);
              const reason = failedDetailByPath.get(entry.payload.file_path);
              if (reason) {
                localFailureMessageById.set(entry.itemId, reason);
                failureMessages.push(reason);
              }
              return;
            }
            successIds.add(entry.itemId);
          });

          totalUploaded += successIds.size;
          totalFailed += failedIds.size;

          setUploadProgress((previous) =>
            previous.map((item) => {
              if (successIds.has(item.id)) {
                return { ...item, progress: 100, status: 'success', error: undefined };
              }
              if (failedIds.has(item.id)) {
                return {
                  ...item,
                  status: 'error',
                  error: localFailureMessageById.get(item.id) || item.error || 'Upload failed',
                };
              }
              return item;
            })
          );
        }

        setUploadProgress((previous) =>
          previous.map((item) =>
            item.status === 'uploading' ? { ...item, progress: 100, status: 'success' } : item
          )
        );

        if (totalUploaded === 0) {
          if (totalFailed > 0) {
            throw new Error(failureMessages[0] || 'Failed to upload selected media');
          }
          throw new Error('No new media was uploaded');
        }

        onUploadComplete?.(totalUploaded);

        setTimeout(() => {
          setUploadProgress([]);
          setUploading(false);
        }, 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        setUploadProgress((previous) =>
          previous.map((item) =>
            item.status === 'success' || item.status === 'skipped'
              ? item
              : { ...item, progress: 0, status: 'error', error: item.error || errorMessage }
          )
        );

        onError?.(errorMessage);

        setTimeout(() => {
          setUploadProgress([]);
          setUploading(false);
        }, 2000);
      }
    },
    [
      MAX_BATCH_BYTES,
      MAX_FILES_PER_BATCH,
      extractErrorMessage,
      fingerprintFile,
      getTripMediaFingerprints,
      onError,
      onUploadComplete,
      parseJsonSafely,
      supabase,
      tripId,
    ]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      uploadFiles(Array.from(e.dataTransfer.files));
    },
    [uploadFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      uploadFiles(Array.from(e.target.files || []));
    },
    [uploadFiles]
  );

  return (
    <div className="w-full">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      {/* Camera-capture input (separate so `capture` doesn't block gallery on iOS) */}
      <input
        ref={cameraInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isMobile ? (
        /* ── Mobile: two prominent tap buttons ── */
        <div className={`flex gap-2 ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-brand-brown/50 bg-brand-brown/10 active:bg-brand-brown/20 transition-colors min-h-[52px]"
          >
            <Upload className="h-5 w-5 text-brand-tan flex-shrink-0" />
            <span className="text-sm text-brand-cream/70 font-medium">
              {uploading ? `Uploading ${uploadProgress.length}…` : 'Choose Media'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => !uploading && cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-brand-brown/50 bg-brand-brown/10 active:bg-brand-brown/20 transition-colors min-h-[52px]"
          >
            <Camera className="h-5 w-5 text-brand-tan flex-shrink-0" />
            <span className="text-sm text-brand-cream/70 font-medium">Camera</span>
          </button>
        </div>
      ) : (
        /* ── Desktop: drag-and-drop bar ── */
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors ${
            isDragActive
              ? 'border-brand-tan bg-brand-tan/10'
              : 'border-brand-brown/50 hover:border-brand-tan/70 hover:bg-brand-brown/10'
          } ${uploading ? 'cursor-default pointer-events-none opacity-70' : ''}`}
        >
          <Upload className="h-4 w-4 text-brand-tan flex-shrink-0" />
            <span className="text-sm text-brand-cream/60">
              {uploading
                ? `Uploading ${uploadProgress.length} file${uploadProgress.length !== 1 ? 's' : ''}…`
                : isDragActive
                ? 'Drop to upload'
                : 'Drop photos/videos here or click to upload'}
            </span>
          </div>
      )}

      {/* Inline progress — only shown while uploading */}
      {uploadProgress.length > 0 && (
        <div className="mt-2 space-y-1">
          {uploadProgress.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-brand-brown/20 text-xs"
            >
              {item.status === 'success' && (
                <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
              )}
              {item.status === 'skipped' && (
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              )}
              {item.status === 'error' && (
                <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              )}
              {item.status === 'uploading' && (
                <div className="h-1 w-12 bg-brand-brown/40 rounded overflow-hidden flex-shrink-0">
                  <div className="h-full bg-brand-tan animate-pulse w-full" />
                </div>
              )}
              <span className="text-brand-cream/70 truncate">{item.file.name}</span>
              {item.error && <span className="text-red-400 ml-auto flex-shrink-0">{item.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
