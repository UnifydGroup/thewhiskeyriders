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

async function uploadDocumentFile(file: File, tripId: string) {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${tripId}/documents/${uniquePrefix}-${safeFileName}`;
  const contentType = file.type || 'application/octet-stream';

  let uploadErrorMessage = 'Failed to upload document';

  for (const bucket of DOCUMENT_STORAGE_BUCKETS) {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
      contentType,
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
      return { fileUrl: publicUrl, fileType: contentType };
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
    let shareWithAll = true;
    let selectedUserIds: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      name = String(formData.get('name') || '').trim();
      shareWithAll = parseBoolean(formData.get('share_with_all'), true);
      selectedUserIds = parseUserIds(formData.get('user_ids'));

      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadDocumentFile(file, tripId);
        fileUrl = uploaded.fileUrl;
        fileType = uploaded.fileType;
        if (!name) {
          name = file.name;
        }
      }
    } else {
      const body = await getJsonBody(request);

      name = String(body.name || '').trim();
      fileUrl = normalizeDocumentUrl(String(body.file_url || '').trim());
      fileType = body.file_type || fileType;

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
