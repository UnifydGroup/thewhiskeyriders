import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  getJsonBody,
  getPagination,
  logActivity,
  successResponse,
  supabase,
  verifyRole,
} from '@/lib/api/helpers';
import type { SupabaseDatabase } from '@/lib/types/database.generated';

const NEWS_ASSETS_BUCKET = 'news-assets';
const MAX_ASSET_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_ASSET_UPLOAD_LIMIT = '250MB';

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function parseBucketSizeLimitToBytes(limit: unknown): number {
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    return Math.max(0, Math.floor(limit));
  }

  if (typeof limit === 'string') {
    const normalized = limit.trim().toLowerCase();
    const numberPart = Number.parseFloat(normalized);
    if (!Number.isFinite(numberPart) || numberPart <= 0) {
      return 0;
    }

    if (normalized.endsWith('gb')) {
      return Math.floor(numberPart * 1024 * 1024 * 1024);
    }
    if (normalized.endsWith('mb')) {
      return Math.floor(numberPart * 1024 * 1024);
    }
    if (normalized.endsWith('kb')) {
      return Math.floor(numberPart * 1024);
    }
    if (normalized.endsWith('b')) {
      return Math.floor(numberPart);
    }

    return Math.floor(numberPart);
  }

  return 0;
}

function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return false;
  if (ALLOWED_MIME_EXACT.has(normalized)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function getExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const index = trimmed.lastIndexOf('.');
  if (index < 0 || index === trimmed.length - 1) return '';
  return trimmed.slice(index + 1);
}

function resolveMimeType(fileName: string, providedMimeType: string): string | null {
  const normalized = providedMimeType.trim().toLowerCase();
  if (isAllowedMimeType(normalized)) {
    return normalized;
  }

  const extension = getExtension(fileName);
  const extensionMimeType = extension ? EXTENSION_MIME_MAP[extension] : undefined;
  if (extensionMimeType && isAllowedMimeType(extensionMimeType)) {
    return extensionMimeType;
  }

  return null;
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'asset';
}

function createAssetStoragePath(fileName: string): string {
  const safeName = sanitizeFileName(fileName || 'asset');
  return `news/${new Date().getUTCFullYear()}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}-${safeName}`;
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient<SupabaseDatabase>(supabaseUrl, serviceRoleKey);
}

async function ensureAssetsBucket(
  serviceClient: ReturnType<typeof createSupabaseClient<SupabaseDatabase>>
) {
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets();
  if (bucketsError) {
    throw new Error(bucketsError.message);
  }

  const existingBucket = (buckets || []).find((bucket) => bucket.name === NEWS_ASSETS_BUCKET);
  if (existingBucket) {
    const rawLimit =
      ((existingBucket as unknown as { file_size_limit?: number }).file_size_limit) ??
      ((existingBucket as unknown as { fileSizeLimit?: number }).fileSizeLimit) ??
      0;
    const currentLimit = parseBucketSizeLimitToBytes(rawLimit);
    if (currentLimit < MAX_ASSET_UPLOAD_BYTES) {
      const { error: updateBucketError } = await serviceClient.storage.updateBucket(NEWS_ASSETS_BUCKET, {
        public: true,
        fileSizeLimit: MAX_ASSET_UPLOAD_LIMIT,
      });
      if (updateBucketError) {
        throw new Error(updateBucketError.message);
      }
    }
    return;
  }

  const { error: createBucketError } = await serviceClient.storage.createBucket(NEWS_ASSETS_BUCKET, {
    public: true,
    fileSizeLimit: MAX_ASSET_UPLOAD_LIMIT,
  });

  if (createBucketError) {
    throw new Error(createBucketError.message);
  }
}

// GET /api/news/assets - List uploaded news assets
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { limit, offset } = getPagination(request);

    const { data, error, count } = await supabase
      .from('news_assets')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    return successResponse({
      assets: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// POST /api/news/assets - Upload a new asset for news content
export async function POST(request: NextRequest) {
  try {
    const { authenticated, authorized, user } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated || !user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const contentTypeHeader = request.headers.get('content-type') || '';
    const isJsonRequest = contentTypeHeader.toLowerCase().includes('application/json');

    const serviceClient = getServiceClient();
    await ensureAssetsBucket(serviceClient);

    let asset: {
      id: string;
      name: string;
      file_url: string;
      storage_path: string;
      file_type: string;
      file_size: number;
      uploaded_by: string | null;
    } | null = null;

    if (isJsonRequest) {
      const body = await getJsonBody(request);
      const action = typeof body.action === 'string' ? body.action.trim() : '';

      if (action === 'create_signed_upload') {
        const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
        const providedType = typeof body.file_type === 'string' ? body.file_type : '';
        const fileSize = typeof body.file_size === 'number' ? body.file_size : Number(body.file_size);

        if (!fileName) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'file_name is required');
        }

        if (!Number.isFinite(fileSize) || fileSize <= 0) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'file_size must be a positive number');
        }

        if (fileSize > MAX_ASSET_UPLOAD_BYTES) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'file is too large (max 250MB)');
        }

        const fileType = resolveMimeType(fileName, providedType);
        if (!fileType) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'unsupported file type. Use images, videos, PDFs, audio, text, or common office files');
        }

        const path = createAssetStoragePath(fileName);
        const { data: signedUpload, error: signedUploadError } = await serviceClient.storage
          .from(NEWS_ASSETS_BUCKET)
          .createSignedUploadUrl(path);

        if (signedUploadError || !signedUpload?.token) {
          return errorResponse(ApiErrors.INTERNAL_ERROR, signedUploadError?.message || 'Failed to create signed upload');
        }

        return successResponse({
          file_path: path,
          token: signedUpload.token,
          signed_url: signedUpload.signedUrl || null,
          file_type: fileType,
          file_size: fileSize,
          bucket: NEWS_ASSETS_BUCKET,
        });
      }

      if (action === 'register_upload') {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const storagePath = typeof body.storage_path === 'string' ? body.storage_path.trim() : '';
        const providedType = typeof body.file_type === 'string' ? body.file_type : '';
        const fileSize = typeof body.file_size === 'number' ? body.file_size : Number(body.file_size);

        if (!name || !storagePath) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'name and storage_path are required');
        }

        if (!storagePath.startsWith('news/')) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'invalid storage_path');
        }

        if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_ASSET_UPLOAD_BYTES) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'invalid file_size');
        }

        const fileType = resolveMimeType(name, providedType);
        if (!fileType) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'unsupported file type. Use images, videos, PDFs, audio, text, or common office files');
        }

        const {
          data: { publicUrl },
        } = serviceClient.storage.from(NEWS_ASSETS_BUCKET).getPublicUrl(storagePath);

        const { data: inserted, error: insertError } = await supabase
          .from('news_assets')
          .insert({
            name,
            file_url: publicUrl,
            storage_path: storagePath,
            file_type: fileType,
            file_size: fileSize,
            uploaded_by: user.id,
          })
          .select('*')
          .single();

        if (insertError || !inserted) {
          return errorResponse(ApiErrors.INTERNAL_ERROR, insertError?.message || 'Failed to create asset record');
        }

        asset = inserted;
      } else {
        return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported action');
      }
    } else {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'file is required');
      }

      if (file.size <= 0) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'file cannot be empty');
      }

      if (file.size > MAX_ASSET_UPLOAD_BYTES) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'file is too large (max 250MB)');
      }

      const fileType = resolveMimeType(file.name || 'asset', file.type || '');
      if (!fileType) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'unsupported file type. Use images, videos, PDFs, audio, text, or common office files');
      }

      const path = createAssetStoragePath(file.name || 'asset');

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await serviceClient.storage
        .from(NEWS_ASSETS_BUCKET)
        .upload(path, arrayBuffer, {
          contentType: fileType,
          cacheControl: '3600',
        });

      if (uploadError) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, uploadError.message);
      }

      const {
        data: { publicUrl },
      } = serviceClient.storage.from(NEWS_ASSETS_BUCKET).getPublicUrl(path);

      const { data: inserted, error: insertError } = await supabase
        .from('news_assets')
        .insert({
          name: file.name,
          file_url: publicUrl,
          storage_path: path,
          file_type: fileType,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select('*')
        .single();

      if (insertError || !inserted) {
        await serviceClient.storage.from(NEWS_ASSETS_BUCKET).remove([path]);
        return errorResponse(ApiErrors.INTERNAL_ERROR, insertError?.message || 'Failed to create asset record');
      }

      asset = inserted;
    }

    if (!asset) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, 'Failed to upload asset');
    }

    await logActivity(
      user.id,
      'upload',
      'news_asset',
      asset.id,
      asset.name,
      {
        file_type: asset.file_type,
        file_size: asset.file_size,
      },
      getIpAddress(request)
    );

    return successResponse(asset, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
