import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  getPagination,
  logActivity,
  getIpAddress,
  supabase,
  isUserTripMember,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string }>;

const DOCUMENT_STORAGE_BUCKETS = ['photos', 'whiskey-riders', 'documents'];
const MISSING_BUCKET_SEGMENT = '/storage/v1/object/public/documents/';
const WORKING_BUCKET_SEGMENT = '/storage/v1/object/public/photos/';
const MAX_DOCUMENT_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_DOCUMENT_UPLOAD_LIMIT = '250MB';

const ALLOWED_MIME_PREFIXES = ['image/', 'text/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

function normalizeDocumentUrl(fileUrl: string): string {
  if (fileUrl.includes(MISSING_BUCKET_SEGMENT)) {
    return fileUrl.replace(MISSING_BUCKET_SEGMENT, WORKING_BUCKET_SEGMENT);
  }

  return fileUrl;
}

type StorageReference = {
  bucket: string;
  path: string;
};

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function extractStorageReference(fileUrl: string): StorageReference | null {
  try {
    const parsed = new URL(fileUrl);
    const markers = [
      '/storage/v1/object/public/',
      '/storage/v1/object/sign/',
      '/storage/v1/object/authenticated/',
    ];

    for (const marker of markers) {
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex === -1) {
        continue;
      }

      const suffix = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
      const slashIndex = suffix.indexOf('/');
      if (slashIndex <= 0) {
        continue;
      }

      const bucket = suffix.slice(0, slashIndex).trim();
      const path = suffix.slice(slashIndex + 1).trim().replace(/^\/+/, '');

      if (bucket && path) {
        return { bucket, path };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function buildStorageCandidates(fileUrl: string, tripId: string): StorageReference[] {
  const reference = extractStorageReference(fileUrl);
  if (!reference) {
    return [];
  }

  const bucketCandidates = uniqueValues([reference.bucket, ...DOCUMENT_STORAGE_BUCKETS]);
  const pathCandidates = uniqueValues([
    reference.path,
    reference.path.replace(/^\/+/, ''),
    reference.path.replace(`${tripId}/documents/`, `${tripId}/`),
  ]);

  return bucketCandidates.flatMap((bucket) =>
    pathCandidates.map((path) => ({ bucket, path }))
  );
}

async function resolveDocumentAccessUrl(fileUrl: string, tripId: string): Promise<string> {
  const normalizedFileUrl = normalizeDocumentUrl(fileUrl);
  const candidates = buildStorageCandidates(normalizedFileUrl, tripId);

  for (const candidate of candidates) {
    const { data, error } = await supabase.storage
      .from(candidate.bucket)
      .createSignedUrl(candidate.path, 60 * 60);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  return normalizedFileUrl;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function parseUserIds(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry).trim())
          .filter(Boolean);
      }
    } catch {
      // Fall back to comma-separated values.
    }

    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function parseFileSize(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }

  return 0;
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'document';
}

function createDocumentStoragePath(tripId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName || 'document');
  return `${tripId}/documents/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
}

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const index = trimmed.lastIndexOf('.');
  if (index < 0 || index === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(index + 1);
}

function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (ALLOWED_MIME_EXACT.has(normalized)) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function resolveDocumentMimeType(fileName: string, providedMimeType: string): string | null {
  const normalized = providedMimeType.trim().toLowerCase();
  if (isAllowedMimeType(normalized)) {
    return normalized;
  }

  const extension = getFileExtension(fileName);
  if (!extension) {
    return null;
  }

  const mappedMimeType = EXTENSION_MIME_MAP[extension];
  if (!mappedMimeType || !isAllowedMimeType(mappedMimeType)) {
    return null;
  }

  return mappedMimeType;
}

function isValidDocumentStoragePath(storagePath: string, tripId: string): boolean {
  if (!storagePath) {
    return false;
  }
  if (storagePath.includes('..')) {
    return false;
  }
  return storagePath.startsWith(`${tripId}/documents/`);
}

async function createSignedDocumentUpload(tripId: string, fileName: string) {
  const storagePath = createDocumentStoragePath(tripId, fileName);
  let lastError = 'Failed to create signed upload URL';

  for (const bucket of DOCUMENT_STORAGE_BUCKETS) {
    const { data: signedUpload, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !signedUpload?.token) {
      if (error?.message) {
        lastError = error.message;
      }
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

async function uploadDocumentFile(file: File, tripId: string, mimeType: string) {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const storagePath = createDocumentStoragePath(tripId, file.name);

  let uploadErrorMessage = 'Failed to upload document';

  for (const bucket of DOCUMENT_STORAGE_BUCKETS) {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (uploadError) {
      uploadErrorMessage = uploadError.message;
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    if (publicUrl) {
      return { fileUrl: publicUrl, fileType: mimeType };
    }
  }

  throw new Error(uploadErrorMessage);
}

// GET /api/trips/[id]/documents - List trip documents
export async function GET(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated, user, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const isGlobalAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
    const isTripMember = await isUserTripMember(user!.id, tripId);

    if (!isGlobalAdmin && !isTripMember) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const canViewAllTripDocuments = isGlobalAdmin || profile?.role === 'trip_admin';
    const requestedScope = request.nextUrl.searchParams.get('scope');
    const useAdminScope = requestedScope === 'admin' && canViewAllTripDocuments;

    const { limit, offset } = getPagination(request);

    let query = supabase
      .from('trip_documents')
      .select(
        `
        *,
        uploaded_by_user:uploaded_by (id, full_name, avatar_url),
        assigned_user:user_id (id, email, full_name, avatar_url)
      `,
        { count: 'exact' }
      )
      .eq('trip_id', tripId);

    // Default behavior is member-scoped documents. Full trip document view is
    // only enabled when explicitly requested by admin UI.
    if (!useAdminScope) {
      query = query.or(`user_id.is.null,user_id.eq.${user!.id}`);
    }

    const { data: documents, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    const normalizedDocuments = (documents || []).map((document) => {
      const normalizedFileUrl = normalizeDocumentUrl(document.file_url);
      return {
        ...document,
        file_url: normalizedFileUrl,
      };
    });

    const documentsWithAccessUrls = await Promise.all(
      normalizedDocuments.map(async (document) => ({
        ...document,
        access_url: await resolveDocumentAccessUrl(document.file_url, tripId),
      }))
    );

    return successResponse({
      documents: documentsWithAccessUrls,
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// POST /api/trips/[id]/documents - Upload document
export async function POST(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated, authorized, user, profile } = await verifyRole(request, [
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

    const isGlobalAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
    const isMember = await isUserTripMember(user!.id, tripId);

    if (!isGlobalAdmin && !isMember) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const contentType = request.headers.get('content-type') || '';
    let name = '';
    let fileUrl = '';
    let fileType = 'application/octet-stream';
    let fileSize = 0;
    let uploadBucket = '';
    let uploadPath = '';
    let shareWithAll = true;
    let selectedUserIds: string[] = [];

    if (contentType.includes('application/json')) {
      const body = await getJsonBody(request);
      const action = typeof body.action === 'string' ? body.action.trim() : '';

      if (action === 'create_signed_upload') {
        const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
        const requestedFileType = typeof body.file_type === 'string' ? body.file_type : '';
        const requestedFileSize = parseFileSize(body.file_size);

        if (!fileName) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'file_name is required');
        }

        if (!Number.isFinite(requestedFileSize) || requestedFileSize <= 0) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'file_size must be a positive number');
        }

        if (requestedFileSize > MAX_DOCUMENT_UPLOAD_BYTES) {
          return errorResponse(
            ApiErrors.BAD_REQUEST,
            `file is too large (max ${MAX_DOCUMENT_UPLOAD_LIMIT})`
          );
        }

        const resolvedFileType = resolveDocumentMimeType(fileName, requestedFileType);
        if (!resolvedFileType) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported file type');
        }

        const signedUpload = await createSignedDocumentUpload(tripId, fileName);
        return successResponse({
          bucket: signedUpload.bucket,
          storage_path: signedUpload.storagePath,
          token: signedUpload.token,
          signed_url: signedUpload.signedUrl,
          file_url: signedUpload.publicUrl,
          file_type: resolvedFileType,
          file_size: requestedFileSize,
          max_file_size: MAX_DOCUMENT_UPLOAD_LIMIT,
        });
      }

      if (action === 'register_upload') {
        const providedName =
          typeof body.name === 'string'
            ? body.name.trim()
            : typeof body.file_name === 'string'
              ? body.file_name.trim()
              : '';
        const requestedFileType = typeof body.file_type === 'string' ? body.file_type : '';
        const requestedFileSize = parseFileSize(body.file_size);

        let storageBucket = typeof body.bucket === 'string' ? body.bucket.trim() : '';
        let storagePath = typeof body.storage_path === 'string' ? body.storage_path.trim() : '';
        const providedFileUrl = normalizeDocumentUrl(String(body.file_url || '').trim());

        if ((!storageBucket || !storagePath) && providedFileUrl) {
          const reference = extractStorageReference(providedFileUrl);
          if (reference) {
            storageBucket = storageBucket || reference.bucket;
            storagePath = storagePath || reference.path;
          }
        }

        storagePath = storagePath.replace(/^\/+/, '');

        name = providedName;
        fileType = resolveDocumentMimeType(providedName, requestedFileType) || fileType;
        fileSize = requestedFileSize;
        uploadBucket = storageBucket;
        uploadPath = storagePath;

        if (!name) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'name is required');
        }

        if (!uploadBucket || !uploadPath) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'bucket and storage_path are required');
        }

        if (!DOCUMENT_STORAGE_BUCKETS.includes(uploadBucket)) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'invalid bucket');
        }

        if (!isValidDocumentStoragePath(uploadPath, tripId)) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'invalid storage_path');
        }

        if (!Number.isFinite(fileSize) || fileSize <= 0) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'file_size must be a positive number');
        }

        if (fileSize > MAX_DOCUMENT_UPLOAD_BYTES) {
          return errorResponse(
            ApiErrors.BAD_REQUEST,
            `file is too large (max ${MAX_DOCUMENT_UPLOAD_LIMIT})`
          );
        }

        if (!resolveDocumentMimeType(name, requestedFileType)) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported file type');
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(uploadBucket).getPublicUrl(uploadPath);
        fileUrl = providedFileUrl || publicUrl;

        if (!fileUrl) {
          return errorResponse(ApiErrors.INTERNAL_ERROR, 'Failed to resolve file URL');
        }

        if (body.share_with_all !== undefined) {
          shareWithAll = parseBoolean(body.share_with_all, true);
        } else if (body.user_ids || body.user_id) {
          shareWithAll = false;
        }

        selectedUserIds = parseUserIds(body.user_ids);
        if (!selectedUserIds.length && body.user_id) {
          selectedUserIds = [String(body.user_id)];
        }
      } else {
        name = String(body.name || '').trim();
        fileUrl = normalizeDocumentUrl(String(body.file_url || '').trim());
        fileType = String(body.file_type || fileType);

        if (body.share_with_all !== undefined) {
          shareWithAll = parseBoolean(body.share_with_all, true);
        } else if (body.user_ids || body.user_id) {
          shareWithAll = false;
        }

        selectedUserIds = parseUserIds(body.user_ids);
        if (!selectedUserIds.length && body.user_id) {
          selectedUserIds = [String(body.user_id)];
        }
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      name = String(formData.get('name') || '').trim();
      shareWithAll = parseBoolean(formData.get('share_with_all'), true);
      selectedUserIds = parseUserIds(formData.get('user_ids'));

      if (file instanceof File && file.size > 0) {
        const resolvedFileType = resolveDocumentMimeType(file.name, file.type || '');
        if (!resolvedFileType) {
          return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported file type');
        }

        if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
          return errorResponse(
            ApiErrors.BAD_REQUEST,
            `file is too large (max ${MAX_DOCUMENT_UPLOAD_LIMIT})`
          );
        }

        const uploaded = await uploadDocumentFile(file, tripId, resolvedFileType);
        fileUrl = uploaded.fileUrl;
        fileType = uploaded.fileType;
        fileSize = file.size;
        if (!name) {
          name = file.name;
        }
      }
    } else {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Unsupported content type');
    }

    if (!name || !fileUrl) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'name and file are required');
    }

    if (!shareWithAll && selectedUserIds.length === 0) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Select at least one member or share with all');
    }

    const uniqueUserIds = [...new Set(selectedUserIds)];

    if (!shareWithAll) {
      const { data: matchingMembers, error: membersError } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', tripId)
        .in('user_id', uniqueUserIds);

      if (membersError) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, membersError.message);
      }

      const validUserIds = new Set((matchingMembers || []).map((member) => member.user_id));
      const invalidUserIds = uniqueUserIds.filter((userId) => !validUserIds.has(userId));

      if (invalidUserIds.length > 0) {
        return errorResponse(ApiErrors.BAD_REQUEST, 'One or more selected users are not trip members');
      }
    }

    const targetUserIds = shareWithAll ? [null] : uniqueUserIds;

    const documentRows = targetUserIds.map((targetUserId) => ({
      trip_id: tripId,
      user_id: targetUserId,
      name,
      file_url: fileUrl,
      file_type: fileType,
      is_admin_upload: true,
      uploaded_by: user!.id,
    }));

    const { data: docs, error } = await supabase
      .from('trip_documents')
      .insert(documentRows)
      .select()
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user!.id,
      'upload',
      'document',
      docs?.[0]?.id || 'bulk',
      name,
      {
        file_type: fileType,
        file_size: fileSize || null,
        bucket: uploadBucket || null,
        storage_path: uploadPath || null,
        share_with_all: shareWithAll,
        recipient_count: targetUserIds.length,
      },
      getIpAddress(request)
    );

    return successResponse({ documents: docs || [], count: docs?.length || 0 }, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
