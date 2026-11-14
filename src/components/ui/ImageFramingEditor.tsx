'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FRAMING,
  MAX_ZOOM,
  MIN_ZOOM,
  framingStyle,
  parseFraming,
  type ImageFraming,
} from '@/lib/images/framing';

export interface FramingPreview {
  label: string;
  /** width / height */
  aspect: number;
  round?: boolean;
  /** Preview height in rem (default 5, or 4 when round). */
  height?: number;
}

interface ImageFramingEditorProps {
  isOpen: boolean;
  imageSrc: string | null;
  initialFraming?: unknown;
  /** Aspect of the main editing frame (width / height). */
  aspect: number;
  round?: boolean;
  title?: string;
  description?: string;
  /** Other places this image appears, shown as live previews. */
  previews?: FramingPreview[];
  onClose: () => void;
  onSave: (framing: ImageFraming) => Promise<void> | void;
}

const ZOOM_STEP = 0.1;
const NUDGE = 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function ImageFramingEditor(props: ImageFramingEditorProps) {
  if (!props.isOpen || !props.imageSrc) return null;
  // Remount per image so the editor always starts from that image's saved framing.
  return <FramingEditorDialog key={props.imageSrc} {...props} imageSrc={props.imageSrc} />;
}

function FramingEditorDialog({
  imageSrc,
  initialFraming,
  aspect,
  round: roundFrame = false,
  title = 'Adjust image',
  description = 'Drag to reposition. Use the slider or scroll to zoom.',
  previews = [],
  onClose,
  onSave,
}: ImageFramingEditorProps & { imageSrc: string }) {
  const [framing, setFraming] = useState<ImageFraming>(() => parseFraming(initialFraming));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: ImageFraming } | null>(null);

  const update = useCallback((next: Partial<ImageFraming>) => {
    setFraming((previous) => ({
      x: round(clamp(next.x ?? previous.x, 0, 100), 1),
      y: round(clamp(next.y ?? previous.y, 0, 100), 1),
      zoom: round(clamp(next.zoom ?? previous.zoom, MIN_ZOOM, MAX_ZOOM), 2),
    }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  // Scroll-to-zoom needs a non-passive listener so the page doesn't scroll as well.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setFraming((previous) => ({
        ...previous,
        zoom: round(clamp(previous.zoom - Math.sign(event.deltaY) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM), 2),
      }));
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: framing };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !frame) return;

    const rect = frame.getBoundingClientRect();
    // Dragging the image right reveals more of its left side, so the focal point moves left.
    const dx = ((event.clientX - drag.startX) / rect.width) * 100 / drag.origin.zoom;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100 / drag.origin.zoom;
    update({ x: drag.origin.x - dx, y: drag.origin.y - dy });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const handleFrameKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? NUDGE * 5 : NUDGE;
    const moves: Record<string, Partial<ImageFraming>> = {
      ArrowLeft: { x: framing.x - step },
      ArrowRight: { x: framing.x + step },
      ArrowUp: { y: framing.y - step },
      ArrowDown: { y: framing.y + step },
      '+': { zoom: framing.zoom + ZOOM_STEP },
      '=': { zoom: framing.zoom + ZOOM_STEP },
      '-': { zoom: framing.zoom - ZOOM_STEP },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      update(move);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(framing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these adjustments.');
      setSaving(false);
    }
  };

  const imageStyle = framingStyle(framing);

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onClose();
        }}
      />

      <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-framing-title"
          className="my-auto w-full max-w-2xl rounded-xl border border-brand-brown/30 bg-brand-dark-grey shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-brand-brown/20 px-5 py-4">
            <div>
              <h2 id="image-framing-title" className="text-lg font-semibold text-brand-cream">{title}</h2>
              <p className="mt-0.5 text-sm text-brand-cream/65">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
              className="rounded-md p-2 text-brand-cream/70 hover:bg-brand-black/50 hover:text-brand-cream disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            <div className={cn('mx-auto', roundFrame ? 'max-w-[18rem]' : 'w-full')}>
              <div
                ref={frameRef}
                role="application"
                tabIndex={0}
                aria-label="Image frame. Drag or use arrow keys to reposition, plus and minus to zoom."
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={handleFrameKeyDown}
                className={cn(
                  'relative w-full cursor-grab touch-none select-none overflow-hidden border-2 border-brand-tan/70 bg-brand-black active:cursor-grabbing',
                  roundFrame ? 'rounded-full' : 'rounded-lg'
                )}
                style={{ aspectRatio: aspect }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover"
                  style={imageStyle}
                />
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <span key={index} className="border border-brand-cream/20" />
                  ))}
                </div>
                <span className="pointer-events-none absolute bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-black/70 px-2.5 py-1 text-[11px] text-brand-cream/80">
                  <Move className="h-3 w-3" /> Drag to move
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => update({ zoom: framing.zoom - ZOOM_STEP })}
                aria-label="Zoom out"
                className="rounded-md p-2 text-brand-cream/80 hover:bg-brand-black/50"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <label htmlFor="image-framing-zoom" className="sr-only">Zoom</label>
              <input
                id="image-framing-zoom"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={framing.zoom}
                onChange={(event) => update({ zoom: Number(event.target.value) })}
                className="flex-1 accent-[var(--brand-brown)]"
              />
              <button
                type="button"
                onClick={() => update({ zoom: framing.zoom + ZOOM_STEP })}
                aria-label="Zoom in"
                className="rounded-md p-2 text-brand-cream/80 hover:bg-brand-black/50"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <span className="w-12 text-right text-sm tabular-nums text-brand-cream/70">{framing.zoom.toFixed(1)}×</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => update({ x: 50, y: 50 })}>
                <Crosshair className="mr-1.5 h-4 w-4" /> Centre
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setFraming(DEFAULT_FRAMING)}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
            </div>

            {previews.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-cream/60">How it will look</p>
                <div className="flex flex-wrap items-end gap-4">
                  {previews.map((preview) => (
                    <div key={preview.label} className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          'relative overflow-hidden border border-brand-brown/40 bg-brand-black',
                          preview.round ? 'rounded-full' : 'rounded-md'
                        )}
                        style={{ aspectRatio: preview.aspect, height: `${preview.height ?? (preview.round ? 4 : 5)}rem` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageSrc} alt="" className="h-full w-full object-cover" style={imageStyle} />
                      </div>
                      <span className="text-xs text-brand-cream/60">{preview.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-md bg-red-950/80 px-3 py-2 text-sm text-red-100">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-brand-brown/20 px-5 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
