import type { CSSProperties } from 'react';

/**
 * How an image sits inside a fixed frame (avatar circle, cover banner, square thumbnail).
 * Non-destructive: the original file is untouched; this only changes what part shows.
 *
 * - `x`, `y`: focal point as a percentage of the image (0 = left/top, 100 = right/bottom)
 * - `zoom`: 1 = fill the frame, up to MAX_ZOOM to scale in on the focal point
 */
export interface ImageFraming {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export const DEFAULT_FRAMING: ImageFraming = { x: 50, y: 50, zoom: 1 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

/** Read framing from a DB/JSON value, falling back to centred and unzoomed. */
export function parseFraming(value: unknown): ImageFraming {
  if (!value || typeof value !== 'object') {
    return DEFAULT_FRAMING;
  }

  const raw = value as Record<string, unknown>;
  return {
    x: Math.round(clamp(toNumber(raw.x, DEFAULT_FRAMING.x), 0, 100) * 10) / 10,
    y: Math.round(clamp(toNumber(raw.y, DEFAULT_FRAMING.y), 0, 100) * 10) / 10,
    zoom: Math.round(clamp(toNumber(raw.zoom, DEFAULT_FRAMING.zoom), MIN_ZOOM, MAX_ZOOM) * 100) / 100,
  };
}

/** Validate framing sent to an API. Returns null for "reset", undefined if invalid. */
export function framingFromRequest(value: unknown): ImageFraming | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== 'object') return undefined;
  const framing = parseFraming(value);
  return isDefaultFraming(framing) ? null : framing;
}

export function isDefaultFraming(framing: ImageFraming | null | undefined): boolean {
  if (!framing) return true;
  return framing.x === DEFAULT_FRAMING.x && framing.y === DEFAULT_FRAMING.y && framing.zoom === DEFAULT_FRAMING.zoom;
}

/**
 * Style for an `object-fit: cover` image so the focal point stays in view and
 * zoom scales around it. Apply to the <img> itself; its container must clip overflow.
 */
export function framingStyle(value: unknown): CSSProperties {
  const framing = parseFraming(value);
  const position = `${framing.x}% ${framing.y}%`;

  if (framing.zoom === 1) {
    return { objectPosition: position };
  }

  return {
    objectPosition: position,
    transform: `scale(${framing.zoom})`,
    transformOrigin: position,
  };
}
