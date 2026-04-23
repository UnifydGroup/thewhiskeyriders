import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  getPagination,
  logActivity,
  successResponse,
  verifyRole,
} from '@/lib/api/helpers';
import type { SupabaseDatabase } from '@/lib/types/database.generated';
import type { UserRole } from '@/lib/types/database';

const EMAIL_ASSET_BUCKET = 'photos';
const DEFAULT_EMAIL_ASSET_PREFIX = 'site/email-assets';
const MAX_ASSET_UPLOAD_BYTES = 10 * 1024 * 1024;
const EMAIL_ASSET_ROLES: UserRole[] = ['trip_admin', 'admin', 'super_admin'];

type EmailAssetItem = {
  path: string;
  name: string;
  file_url: string;
  file_size: number | null;
  updated_at: string | null;
  content_type: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient<SupabaseDatabase>(supabaseUrl, serviceRoleKey);
}

function normalizePrefix(input: string): string {
  const cleaned = (input || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '');
  return cleaned || DEFAULT_EMAIL_ASSET_PREFIX;
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'asset';
}

function mapStorageItemToAsset(
  serviceClient: ReturnType<typeof createSupabaseClient<SupabaseDatabase>>,
  prefix: string,
  item: Record<string, unknown>
): EmailAssetItem {
  const name = String(item.name || '').trim();
  const path = `${prefix}/${name}`.replace(/\/+/g, '/');
  const metadata =
    typeof item.metadata === 'object' && item.metadata !== null
      ? (item.metadata as Record<string, unknown>)
      : null;
  const fileSize =
    metadata && typeof metadata.size === 'number' && Number.isFinite(metadata.size)
      ? metadata.size
      : null;
  const contentType =
    metadata && typeof metadata.mimetype === 'string' ? metadata.mimetype : null;

  const {
    data: { publicUrl },
  } = serviceClient.storage.from(EMAIL_ASSET_BUCKET).getPublicUrl(path);

  return {
    path,
    name,
    file_url: publicUrl,
    file_size: fileSize,
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : null,
    content_type: contentType,
  };
}

// GET /api/email-assets - list assets in email asset folder
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, EMAIL_ASSET_ROLES);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { limit, offset } = getPagination(request, 200, 1000);
    const prefix = normalizePrefix(
      request.nextUrl.searchParams.get('prefix') || DEFAULT_EMAIL_ASSET_PREFIX
    );

    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient.storage.from(EMAIL_ASSET_BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'updated_at', order: 'desc' },
    });

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    const assets = (data || [])
      .filter((item) => typeof item.name === 'string' && item.name.trim().length > 0)
      .map((item) =>
        mapStorageItemToAsset(
          serviceClient,
          prefix,
          item as unknown as Record<string, unknown>
        )
      );

    return successResponse({ assets });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// POST /api/email-assets - upload image asset into email asset folder
export async function POST(request: NextRequest) {
  try {
    const { authenticated, authorized, user } = await verifyRole(request, EMAIL_ASSET_ROLES);
    if (!authenticated || !user) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const formData = await request.formData();
    const file = formData.get('file');
    const prefixInput = formData.get('prefix');
    const prefix = normalizePrefix(
      typeof prefixInput === 'string' ? prefixInput : DEFAULT_EMAIL_ASSET_PREFIX
    );

    if (!(file instanceof File)) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'file is required');
    }

    if (!file.type.startsWith('image/')) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Only image uploads are supported');
    }

    if (file.size > MAX_ASSET_UPLOAD_BYTES) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Image must be 10 MB or smaller');
    }

    const safeName = sanitizeFileName(file.name || 'asset');
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`;

    const serviceClient = getServiceClient();
    const { error: uploadError } = await serviceClient.storage.from(EMAIL_ASSET_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, uploadError.message);
    }

    const {
      data: { publicUrl },
    } = serviceClient.storage.from(EMAIL_ASSET_BUCKET).getPublicUrl(path);

    const asset: EmailAssetItem = {
      path,
      name: safeName,
      file_url: publicUrl,
      file_size: file.size,
      updated_at: new Date().toISOString(),
      content_type: file.type,
    };

    await logActivity(
      user.id,
      'upload',
      'email_asset',
      path,
      safeName,
      { bucket: EMAIL_ASSET_BUCKET, path, file_size: file.size, content_type: file.type },
      getIpAddress(request)
    );

    return successResponse({ asset }, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
