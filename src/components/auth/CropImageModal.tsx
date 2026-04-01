'use client';

import { useState, useCallback } from 'react';
import ReactEasyCrop, { Point, Area } from 'react-easy-crop';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface CropImageModalProps {
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

export default function CropImageModal({
  imageSrc,
  onCropComplete,
  onCancel,
  aspectRatio = 1,
}: CropImageModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropAreaChange = useCallback((_crop: Point, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (err) => reject(err));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (): Promise<Blob> => {
    if (!croppedAreaPixels) {
      throw new Error('No crop area defined');
    }

    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size to the crop area
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        }
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg();
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-brand-dark border-brand-gold/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-2xl">Crop Profile Photo</CardTitle>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="p-1 hover:bg-brand-gold/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-brand-cream" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Crop Preview */}
          <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '100%' }}>
            <div className="absolute inset-0">
              <ReactEasyCrop
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                cropShape="round"
                showGrid={true}
                onCropChange={setCrop}
                onCropAreaChange={handleCropAreaChange}
                onZoomChange={setZoom}
                objectFit={"cover" as "cover"}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-brand-cream/80">Zoom</label>
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-brand-gold" />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-brand-dark border border-brand-gold/30 rounded-lg appearance-none cursor-pointer accent-brand-gold"
                  disabled={isProcessing}
                />
                <ZoomIn className="w-4 h-4 text-brand-gold" />
              </div>
              <p className="text-xs text-brand-cream/60 text-right">{zoom.toFixed(1)}x</p>
            </div>

            {/* Position Hint */}
            <p className="text-xs text-brand-cream/60 text-center">
              Drag to adjust position • Use zoom to resize
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={isProcessing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? 'Processing...' : 'Use This Photo'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
