import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  getPagination,
  logActivity,
  successResponse,
  supabase,
  verifyRole,
} from '@/lib/api/helpers';
import type { SupabaseDatabase } from '@/lib/types/database.generated';

const NEWS_ASSETS_BUCKET = 'news-assets';
const MAX_ASSET_UPLOAD_BYTES = 25 * 1024 * 1024;

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return false;
  if (ALLOWED_MIME_EXACT.has(normalized)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'asset';
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

  const exists = (buckets || []).some((bucket) => bucket.name === NEWS_ASSETS_BUCKET);
  if (exists) {
    return;
  }

  const { error: createBucketError } = await serviceClient.storage.createBucket(NEWS_ASSETS_BUCKET, {
    public: true,
    fileSizeLimit: MAX_ASSET_UPLOAD_BYTES,
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

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'file is required');
    }

    if (file.size <= 0) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'file cannot be empty');
    }

    if (file.size > MAX_ASSET_UPLOAD_BYTES) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'file is too large (max 25MB)');
    }

    const fileType = (file.type || '').trim().toLowerCase();
    if (!isAllowedMimeType(fileType)) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'unsupported file type');
    }

    const serviceClient = getServiceClient();
    await ensureAssetsBucket(serviceClient);

    const safeName = sanitizeFileName(file.name || 'asset');
    const path = `news/${new Date().getUTCFullYear()}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}-${safeName}`;

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

    const { data: asset, error: insertError } = await supabase
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

    if (insertError || !asset) {
      await serviceClient.storage.from(NEWS_ASSETS_BUCKET).remove([path]);
      return errorResponse(ApiErrors.INTERNAL_ERROR, insertError?.message || 'Failed to create asset record');
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
