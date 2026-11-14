'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crop, ImagePlus, RotateCcw } from 'lucide-react';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import { ImageFramingEditor } from '@/components/ui/ImageFramingEditor';
import { isDefaultFraming, type ImageFraming } from '@/lib/images/framing';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { downscaleImage, IMAGE_MAX_DIMENSIONS } from '@/lib/images/resize';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface HeroBackgroundUpdate {
  dashboard_background_url?: string | null;
  dashboard_background_framing?: ImageFraming | null;
}

interface HeroBackgroundPickerProps {
  profileId: string;
  /** The member's own background, or null when the trip photo is showing. */
  backgroundUrl: string | null;
  framing: unknown;
  onChange: (update: HeroBackgroundUpdate) => void;
}

export default function HeroBackgroundPicker({ profileId, backgroundUrl, framing, onChange }: HeroBackgroundPickerProps) {
  const hasCustomBackground = Boolean(backgroundUrl);
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [framingOpen, setFramingOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (imageToCrop) URL.revokeObjectURL(imageToCrop);
    };
  }, [imageToCrop]);

  const saveBackground = async (update: HeroBackgroundUpdate) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(`/api/members/${profileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || payload?.message || 'Could not save your background.');
    }

    onChange(update);
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

    const upload = await downscaleImage(croppedBlob, IMAGE_MAX_DIMENSIONS.background);
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

    // A new image starts centred; it can be fine-tuned with Adjust.
    await saveBackground({ dashboard_background_url: publicUrl, dashboard_background_framing: null });
    setImageToCrop(null);
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveBackground({ dashboard_background_url: null, dashboard_background_framing: null });
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
            <button type="button" onClick={() => setFramingOpen(true)} disabled={saving} className={buttonClass}>
              <Crop className="h-3.5 w-3.5" />
              Adjust
            </button>
          )}
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

      <ImageFramingEditor
        isOpen={framingOpen}
        imageSrc={backgroundUrl}
        initialFraming={framing}
        aspect={16 / 7}
        title="Adjust your background"
        description="Drag to choose what stays in view, and zoom to fill the banner."
        previews={[
          { label: 'Desktop', aspect: 16 / 7 },
          { label: 'Tablet', aspect: 4 / 3 },
          { label: 'Phone', aspect: 3 / 4 },
        ]}
        onClose={() => setFramingOpen(false)}
        onSave={async (next) => {
          await saveBackground({ dashboard_background_framing: isDefaultFraming(next) ? null : next });
          setFramingOpen(false);
        }}
      />
    </>
  );
}
