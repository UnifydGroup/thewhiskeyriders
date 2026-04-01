'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
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

  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const imageFiles = files.filter((file) => file.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        onError?.('No image files selected');
        setUploading(false);
        return;
      }

      setUploadProgress(
        imageFiles.map((file) => ({
          file,
          progress: 0,
          status: 'uploading' as const,
        }))
      );

      try {
        // Upload in smaller batches so large bulk uploads do not create oversized multipart payloads.
        const batches: File[][] = [];
        let currentBatch: File[] = [];
        let currentBatchBytes = 0;

        for (const file of imageFiles) {
          const shouldStartNewBatch =
            currentBatch.length >= MAX_FILES_PER_BATCH ||
            currentBatchBytes + file.size > MAX_BATCH_BYTES;

          if (shouldStartNewBatch && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentBatchBytes = 0;
          }

          currentBatch.push(file);
          currentBatchBytes += file.size;
        }

        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }

        let totalUploaded = 0;

        for (const batch of batches) {
          const batchFormData = new FormData();
          batch.forEach((file) => batchFormData.append('files', file));
          batchFormData.append('uploadDate', new Date().toISOString().split('T')[0]);

          const response = await fetch(`/api/trips/${tripId}/photos/upload`, {
            method: 'POST',
            body: batchFormData,
            credentials: 'include',
          });

          const uploadedPhotos = await response.json();

          if (!response.ok) {
            throw new Error(
              typeof uploadedPhotos === 'object' && uploadedPhotos.error
                ? uploadedPhotos.error
                : 'Upload failed'
            );
          }

          if (Array.isArray(uploadedPhotos)) {
            totalUploaded += uploadedPhotos.length;
          }
        }

        setUploadProgress(
          imageFiles.map((file) => ({
            file,
            progress: 100,
            status: 'success' as const,
          }))
        );

        onUploadComplete?.(totalUploaded);

        setTimeout(() => {
          setUploadProgress([]);
          setUploading(false);
        }, 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        setUploadProgress(
          imageFiles.map((file) => ({
            file,
            progress: 0,
            status: 'error' as const,
            error: errorMessage,
          }))
        );

        onError?.(errorMessage);

        setTimeout(() => {
          setUploadProgress([]);
          setUploading(false);
        }, 2000);
      }
    },
    [MAX_BATCH_BYTES, MAX_FILES_PER_BATCH, tripId, onUploadComplete, onError]
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
      {/* Compact drop zone bar */}
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
            ? `Uploading ${uploadProgress.length} photo${uploadProgress.length !== 1 ? 's' : ''}…`
            : isDragActive
            ? 'Drop to upload'
            : 'Drop photos here or click to upload'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Inline progress — only shown while uploading */}
      {uploadProgress.length > 0 && (
        <div className="mt-2 space-y-1">
          {uploadProgress.map((item) => (
            <div
              key={item.file.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-brand-brown/20 text-xs"
            >
              {item.status === 'success' && (
                <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
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
