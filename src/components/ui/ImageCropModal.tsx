'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onConfirm: (croppedBlob: Blob) => Promise<void> | void;
  title?: string;
  aspect?: number;
  cropShape?: 'rect' | 'round';
  confirmLabel?: string;
  processingLabel?: string;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Failed to load selected image.')));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedBlob = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Your browser does not support image cropping.');
  }

  canvas.width = Math.max(1, Math.floor(pixelCrop.width));
  canvas.height = Math.max(1, Math.floor(pixelCrop.height));

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('Failed to crop image.');
  }

  return blob;
};

export function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onConfirm,
  title = 'Adjust Photo',
  aspect = 1,
  cropShape = 'round',
  confirmLabel = 'Apply Photo',
  processingLabel = 'Applying...',
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    setIsApplying(false);
  }, [isOpen, imageSrc]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels || isApplying) return;
    setError(null);
    setIsApplying(true);

    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      await onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image.');
    } finally {
      setIsApplying(false);
    }
  }, [croppedAreaPixels, imageSrc, isApplying, onConfirm]);

  if (!isOpen || !imageSrc) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
        onClick={() => {
          if (!isApplying) onClose();
        }}
      />

      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-brand-brown/30 bg-brand-dark-grey shadow-2xl">
          <div className="flex items-center justify-between border-b border-brand-brown/20 px-4 py-3">
            <h2 className="text-base font-semibold text-brand-cream">{title}</h2>
            <button
              type="button"
              onClick={() => {
                if (!isApplying) onClose();
              }}
              disabled={isApplying}
              className="text-brand-cream/60 transition-colors hover:text-brand-cream disabled:opacity-50"
              aria-label="Close crop modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative h-[320px] bg-black sm:h-[420px]">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              minZoom={1}
              maxZoom={4}
            />
          </div>

          <div className="space-y-4 p-4">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-cream/70">Zoom</div>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                disabled={isApplying}
                className="w-full accent-brand-brown"
                aria-label="Zoom selected image"
              />
            </div>

            {error && (
              <p className="rounded border border-red-500/60 bg-red-900/20 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isApplying}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleApply()} disabled={!croppedAreaPixels || isApplying}>
                {isApplying ? processingLabel : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
