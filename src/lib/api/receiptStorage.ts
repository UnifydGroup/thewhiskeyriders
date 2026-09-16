import { supabase } from '@/lib/api/helpers';

// Same storage bucket fallback chain used by the trip documents API — some
// environments only have one of these buckets provisioned.
export const RECEIPT_STORAGE_BUCKETS = ['photos', 'whiskey-riders', 'documents'];
export const MAX_RECEIPT_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_RECEIPT_UPLOAD_LIMIT = '25MB';

const ALLOWED_MIME_EXACT = new Set(['application/pdf']);
const ALLOWED_MIME_PREFIXES = ['image/'];

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export type StorageReference = { bucket: string; path: string };

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function extractStorageReference(fileUrl: string): StorageReference | null {
  try {
    const parsed = new URL(fileUrl);
    const markers = [
      '/storage/v1/object/public/',
      '/storage/v1/object/sign/',
      '/storage/v1/object/authenticated/',
    ];

    for (const marker of markers) {
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex === -1) continue;

      const suffix = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
      const slashIndex = suffix.indexOf('/');
      if (slashIndex <= 0) continue;

      const bucket = suffix.slice(0, slashIndex).trim();
      const path = suffix.slice(slashIndex + 1).trim().replace(/^\/+/, '');

      if (bucket && path) return { bucket, path };
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'receipt';
}

export function createReceiptStoragePath(tripId: string, expenseId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName || 'receipt');
  return `${tripId}/expenses/${expenseId}/receipts/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
}

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const index = trimmed.lastIndexOf('.');
  if (index < 0 || index === trimmed.length - 1) return '';
  return trimmed.slice(index + 1);
}

function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return false;
  if (ALLOWED_MIME_EXACT.has(normalized)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function resolveReceiptMimeType(fileName: string, providedMimeType: string): string | null {
  const normalized = providedMimeType.trim().toLowerCase();
  if (isAllowedMimeType(normalized)) return normalized;

  const extension = getFileExtension(fileName);
  if (!extension) return null;

  const mappedMimeType = EXTENSION_MIME_MAP[extension];
  if (!mappedMimeType || !isAllowedMimeType(mappedMimeType)) return null;

  return mappedMimeType;
}

export function isValidReceiptStoragePath(storagePath: string, tripId: string, expenseId: string): boolean {
  if (!storagePath || storagePath.includes('..')) return false;
  return storagePath.startsWith(`${tripId}/expenses/${expenseId}/receipts/`);
}

export async function createSignedReceiptUpload(tripId: string, expenseId: string, fileName: string) {
  const storagePath = createReceiptStoragePath(tripId, expenseId, fileName);
  let lastError = 'Failed to create signed upload URL';

  for (const bucket of RECEIPT_STORAGE_BUCKETS) {
    const { data: signedUpload, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !signedUpload?.token) {
      if (error?.message) lastError = error.message;
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    return {
      bucket,
      storagePath,
      token: signedUpload.token,
      signedUrl: signedUpload.signedUrl || null,
      publicUrl,
    };
  }

  throw new Error(lastError);
}

export async function resolveReceiptAccessUrl(fileUrl: string): Promise<string> {
  const reference = extractStorageReference(fileUrl);
  if (!reference) return fileUrl;

  const bucketCandidates = uniqueValues([reference.bucket, ...RECEIPT_STORAGE_BUCKETS]);

  for (const bucket of bucketCandidates) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(reference.path, 60 * 60);

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return fileUrl;
}

export async function deleteReceiptStorageObject(fileUrl: string): Promise<void> {
  const reference = extractStorageReference(fileUrl);
  if (!reference) return;

  await supabase.storage.from(reference.bucket).remove([reference.path]);
}
