'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, RotateCcw } from 'lucide-react';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const MAX_WIDTH = 2400;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface HeroBackgroundPickerProps {
  profileId: string;
  hasCustomBackground: boolean;
  onChange: (url: string | null) => void;
}

/** Scale a cropped image down so uploads stay a sensible size. */
async function downscale(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  if (bitmap.width <= MAX_WIDTH) {
    bitmap.close();
    return blob;
  }

  const scale = MAX_WIDTH / bitmap.width;
  const canvas = document.createElement('canvas');
  canvas.width = MAX_WIDTH;
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return blob;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result ?? blob), 'image/jpeg', 0.88);
  });
}

export default function HeroBackgroundPicker({ profileId, hasCustomBackground, onChange }: HeroBackgroundPickerProps) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageToCrop) URL.revokeObjectURL(imageToCrop);
    };
  }, [imageToCrop]);

  const saveBackground = async (url: string | null) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(`/api/members/${profileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ dashboard_background_url: url }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || payload?.message || 'Could not save your background.');
    }

    onChange(url);
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (JPG, PNG or WebP).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That image is over 20 MB. Choose a smaller one.');
      return;
    }

    setError(null);
    setImageToCrop(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (croppedBlob: Blob) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Your session has expired. Log in again to change your background.');
    }

    const upload = await downscale(croppedBlob);
    const path = `backgrounds/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(path, upload, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(path);

    await saveBackground(publicUrl);
    setImageToCrop(null);
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveBackground(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your background.');
    } finally {
      setSaving(false);
    }
  };

  const buttonClass =
    'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-cream/25 bg-brand-black/60 px-3 py-1.5 text-xs font-semibold text-brand-cream backdrop-blur-sm transition-colors hover:border-brand-tan hover:text-brand-tan disabled:opacity-60';

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap justify-end gap-2">
          {hasCustomBackground && (
            <button type="button" onClick={handleReset} disabled={saving} className={buttonClass}>
              <RotateCcw className="h-3.5 w-3.5" />
              Use trip photo
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className={buttonClass}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {hasCustomBackground ? 'Change background' : 'Add background'}
          </button>
        </div>
        {error && (
          <p role="alert" className={cn('max-w-xs rounded-md bg-red-950/90 px-3 py-1.5 text-xs text-red-100')}>
            {error}
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        id="dashboard-background-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelected}
      />

      <ImageCropModal
        isOpen={Boolean(imageToCrop)}
        imageSrc={imageToCrop}
        onClose={() => setImageToCrop(null)}
        onConfirm={handleCropConfirm}
        title="Position your background"
        aspect={16 / 7}
        cropShape="rect"
        confirmLabel="Save background"
        processingLabel="Saving..."
      />
    </>
  );
}
