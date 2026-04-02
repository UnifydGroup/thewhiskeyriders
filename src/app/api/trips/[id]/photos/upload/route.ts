import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';
type MediaType = 'image' | 'video';
const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];
const MAX_MEDIA_UPLOAD_BYTES = 500 * 1024 * 1024;
const VIDEO_EXTENSIONS = [
  'mp4',
  'mov',
  'm4v',
  'webm',
  'ogg',
  'ogv',
  'avi',
  'mkv',
  '3gp',
  '3g2',
  'mpeg',
  'mpg',
  'mts',
  'm2ts',
  'ts',
  'wmv',
  'flv',
];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'svg', 'tif', 'tiff'];

interface UploadedPhotoRow {
  id: string;
  trip_id: string;
  gallery_id: string | null;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  media_type: MediaType;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface JsonSignFile {
  name?: unknown;
  type?: unknown;
  size?: unknown;
  caption?: unknown;
}

interface JsonFinalizeUpload {
  file_path?: unknown;
  caption?: unknown;
  media_type?: unknown;
  mime_type?: unknown;
}

interface JsonUploadBody {
  action?: unknown;
  files?: unknown;
  uploads?: unknown;
}

function formatSizeMB(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

type SupabaseAdminClient = SupabaseClient;
type InsertPhotoResult = {
  data: UploadedPhotoRow | null;
  error: { code?: string | null; message?: string | null } | null;
};

async function getUserAndRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, role: null as Role | null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return {
    user,
    role: (profile?.role as Role | undefined) ?? null,
  };
}

async function isTripMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tripId: string
) {
  const { data: member, error } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return false;
  }

  return Boolean(member);
}

async function canAccessTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: Role | null,
  tripId: string
) {
  if (role && ADMIN_ROLES.includes(role)) {
    return true;
  }

  return isTripMember(supabase, userId, tripId);
}

async function getTripById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string
) {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    return null;
  }

  return trip;
}

function getFileExtensionFromParts(fileName: string, mimeType: string) {
  const fromName = fileName.split('.').pop()?.toLowerCase() || '';
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  const fromMime = mimeType.split('/').pop()?.toLowerCase() || '';
  if (fromMime === 'jpeg') {
    return 'jpg';
  }

  return fromMime && /^[a-z0-9]+$/.test(fromMime) ? fromMime : 'bin';
}

function getMediaType(mimeType: string, fileName = ''): MediaType | null {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return 'image';
  }
  if (VIDEO_EXTENSIONS.includes(ext)) {
    return 'video';
  }

  return null;
}

function inferMimeType(fileName: string, mediaType: MediaType | null): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    mts: 'video/mp2t',
    m2ts: 'video/mp2t',
    ts: 'video/mp2t',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
  };

  if (ext && byExt[ext]) {
    return byExt[ext];
  }

  if (mediaType === 'image') {
    return 'image/jpeg';
  }
  if (mediaType === 'video') {
    return 'video/mp4';
  }
  return null;
}

function normalizeUploadMimeType(
  mimeTypeInput: string,
  fileName: string,
  mediaType: MediaType | null
) {
  const input = mimeTypeInput.trim().toLowerCase();
  if (!input) {
    return inferMimeType(fileName, mediaType);
  }

  if (
    input === 'application/octet-stream' ||
    input === 'binary/octet-stream' ||
    input === 'application/x-binary'
  ) {
    return inferMimeType(fileName, mediaType) || input;
  }

  if (input === 'video/quicktime' || input === 'video/x-quicktime' || input === 'video/x-m4v') {
    return 'video/mp4';
  }

  return input;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isMissingMediaColumnsError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = (error.message || '').toLowerCase();
  return (
    error.code === '42703' ||
    message.includes('media_type') ||
    message.includes('mime_type')
  );
}

async function ensureUploaderProfile(adminSupabase: SupabaseAdminClient, user: User) {
  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Failed checking uploader profile:', profileError);
    return false;
  }

  if (profile?.id) {
    return true;
  }

  const fallbackEmail =
    typeof user.email === 'string' && user.email.trim()
      ? user.email.trim()
      : `${user.id}@users.whiskeyriders.local`;
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  const { error: createProfileError } = await adminSupabase.from('profiles').insert({
    id: user.id,
    user_id: user.id,
    email: fallbackEmail,
    role: 'member',
    status: 'active',
    full_name: fullName,
  });

  if (createProfileError && createProfileError.code !== '23505') {
    console.error('Failed creating missing uploader profile:', createProfileError);
    return false;
  }

  return true;
}

async function insertTripPhotoRecord(
  adminSupabase: SupabaseAdminClient,
  params: {
    tripId: string;
    userId: string;
    filePath: string;
    caption: string | null;
    mediaType: MediaType;
    mimeType: string | null;
  }
) : Promise<InsertPhotoResult> {
  const insertPayload = {
    trip_id: params.tripId,
    gallery_id: null,
    uploaded_by: params.userId,
    storage_path: params.filePath,
    caption: params.caption,
    media_type: params.mediaType,
    mime_type: params.mimeType,
    width: null,
    height: null,
  };

  const firstAttempt = await adminSupabase
    .from('photos')
    .insert(insertPayload)
    .select()
    .single();

  if (!firstAttempt.error || !isMissingMediaColumnsError(firstAttempt.error)) {
    if (firstAttempt.error) {
      return {
        data: null,
        error: {
          code: firstAttempt.error.code,
          message: firstAttempt.error.message,
        },
      };
    }

    return {
      data: (firstAttempt.data as UploadedPhotoRow | null) ?? null,
      error: null,
    };
  }

  const legacyAttempt = await adminSupabase
    .from('photos')
    .insert({
      trip_id: params.tripId,
      gallery_id: null,
      uploaded_by: params.userId,
      storage_path: params.filePath,
      caption: params.caption,
      width: null,
      height: null,
    })
    .select()
    .single();

  if (legacyAttempt.error) {
    return {
      data: null,
      error: {
        code: legacyAttempt.error.code,
        message: legacyAttempt.error.message,
      },
    };
  }

  const legacyPhoto =
    legacyAttempt.data && typeof legacyAttempt.data === 'object'
      ? {
          ...legacyAttempt.data,
          media_type: params.mediaType,
          mime_type: params.mimeType,
        }
      : legacyAttempt.data;

  return { data: (legacyPhoto as UploadedPhotoRow | null) ?? null, error: null };
}

/**
 * POST /api/trips/[id]/photos/upload - Upload media file(s) directly to a trip
 *
 * Expected FormData:
 * - files: File[] (image/video) OR file: File
 * - caption: string (optional)
 * - detailed query param (optional): when true/1, response includes {photos, failed}
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey);
    const detailedParam = request.nextUrl.searchParams.get('detailed');
    const returnDetailed = detailedParam === '1' || detailedParam === 'true';

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trip = await getTripById(supabase, tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const hasAccess = await canAccessTrip(supabase, user.id, role, tripId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const readyForUpload = await ensureUploaderProfile(adminSupabase, user);
    if (!readyForUpload) {
      return NextResponse.json(
        { error: 'Unable to prepare your account for uploads. Please contact support.' },
        { status: 500 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as JsonUploadBody | null;
      if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }

      const action = asString(body.action).toLowerCase();

      if (action === 'sign') {
        const files = Array.isArray(body.files) ? (body.files as JsonSignFile[]) : [];
        if (files.length === 0) {
          return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }

        const uploads: Array<Record<string, unknown>> = [];
        const failed: string[] = [];
        const failedDetails: Array<Record<string, unknown>> = [];

        for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
          const rawFile = files[fileIndex];
          const name = asString(rawFile.name) || 'unknown-file';
          const mimeTypeInput = asString(rawFile.type);
          const size = asNumber(rawFile.size) ?? 0;
          const mediaType = getMediaType(mimeTypeInput, name);
          const mimeType = normalizeUploadMimeType(mimeTypeInput, name, mediaType) || '';

          if (!mediaType || size <= 0 || size > MAX_MEDIA_UPLOAD_BYTES) {
            failed.push(name);
            let reason = 'Unsupported file type';
            if (size <= 0) {
              reason = 'Empty file';
            } else if (size > MAX_MEDIA_UPLOAD_BYTES) {
              reason = `File too large. Max ${formatSizeMB(MAX_MEDIA_UPLOAD_BYTES)}MB`;
            }
            failedDetails.push({
              input_index: fileIndex,
              original_name: name,
              reason,
            });
            continue;
          }

          const timestamp = Date.now();
          const ext = getFileExtensionFromParts(name, mimeType || mimeTypeInput);
          const fileName = `${timestamp}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
          const filePath = `trips/${tripId}/${mediaType}s/${fileName}`;

          const { data: signedData, error: signedError } = await adminSupabase.storage
            .from('photos')
            .createSignedUploadUrl(filePath, {
              upsert: false,
            });

          if (signedError || !signedData?.token) {
            failed.push(name);
            failedDetails.push({
              input_index: fileIndex,
              original_name: name,
              reason: signedError?.message || 'Failed to prepare upload',
            });
            continue;
          }

          uploads.push({
            input_index: fileIndex,
            original_name: name,
            file_path: filePath,
            token: signedData.token,
            media_type: mediaType,
            mime_type: mimeType || null,
            caption: asString(rawFile.caption) || null,
          });
        }

        return NextResponse.json({ uploads, failed, failed_details: failedDetails }, { status: 200 });
      }

      if (action === 'finalize') {
        const uploads = Array.isArray(body.uploads) ? (body.uploads as JsonFinalizeUpload[]) : [];
        if (uploads.length === 0) {
          return NextResponse.json({ error: 'No uploads provided' }, { status: 400 });
        }

        const uploadedPhotos: Array<Record<string, unknown>> = [];
        const failed: string[] = [];
        const failedDetails: Array<Record<string, unknown>> = [];

        for (const rawUpload of uploads) {
          const filePath = asString(rawUpload.file_path);
          const mimeTypeInput = asString(rawUpload.mime_type);
          const mediaTypeRaw = asString(rawUpload.media_type);
          const mediaType: MediaType =
            mediaTypeRaw === 'video' || mediaTypeRaw === 'image'
              ? mediaTypeRaw
              : getMediaType(mimeTypeInput || '', filePath) || 'image';
          const mimeType = normalizeUploadMimeType(mimeTypeInput, filePath, mediaType) || null;

          if (!filePath.startsWith(`trips/${tripId}/`)) {
            failed.push(filePath || 'unknown-file');
            failedDetails.push({
              file_path: filePath || null,
              reason: 'Invalid upload path',
            });
            continue;
          }

          const caption = asString(rawUpload.caption) || null;

          const { data: photo, error: photoError } = await insertTripPhotoRecord(adminSupabase, {
            tripId,
            userId: user.id,
            filePath,
            caption,
            mediaType,
            mimeType,
          });

          if (photoError || !photo) {
            console.error('Trip upload finalize insert error:', photoError);
            failed.push(filePath);
            failedDetails.push({
              file_path: filePath,
              reason: photoError?.message || 'Failed to finalize media record',
            });
            continue;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from('photos').getPublicUrl(filePath);

          uploadedPhotos.push({
            ...(photo as UploadedPhotoRow),
            uploader_name: 'You',
            url: publicUrl,
          });
        }

        if (uploadedPhotos.length === 0) {
          return NextResponse.json(
            { error: 'Failed to finalize any uploads', failed, failed_details: failedDetails },
            { status: 400 }
          );
        }

        if (!returnDetailed) {
          return NextResponse.json(uploadedPhotos, { status: 201 });
        }

        if (uploadedPhotos.length === 1 && uploads.length === 1 && failed.length === 0) {
          return NextResponse.json({ photo: uploadedPhotos[0] }, { status: 201 });
        }

        return NextResponse.json(
          {
            photos: uploadedPhotos,
            failed,
            failed_details: failedDetails,
          },
          { status: 201 }
        );
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const formData = await request.formData();
    const filesFromMulti = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File);
    const singleFile = formData.get('file');
    const files =
      filesFromMulti.length > 0
        ? filesFromMulti
        : singleFile instanceof File
          ? [singleFile]
          : [];
    const caption = (formData.get('caption') as string) || null;

    if (files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const uploadedPhotos: Array<Record<string, unknown>> = [];
    const failed: string[] = [];

    for (const file of files) {
      const mediaType = getMediaType(file.type || '', file.name);
      if (!mediaType) {
        failed.push(file.name || 'unknown-file');
        continue;
      }
      if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
        failed.push(file.name || 'unknown-file');
        continue;
      }

      const timestamp = Date.now();
      const mimeType = normalizeUploadMimeType(file.type || '', file.name, mediaType) || '';
      const ext = getFileExtensionFromParts(file.name, mimeType || file.type);
      const fileName = `${timestamp}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const filePath = `trips/${tripId}/${mediaType}s/${fileName}`;

      const buffer = await file.arrayBuffer();
      const { error: uploadError } = await adminSupabase.storage
        .from('photos')
        .upload(filePath, buffer, {
          contentType: mimeType || undefined,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Trip photo upload error:', uploadError);
        failed.push(file.name || 'unknown-file');
        continue;
      }

      const { data: photo, error: photoError } = await insertTripPhotoRecord(adminSupabase, {
        tripId,
        userId: user.id,
        filePath,
        caption,
        mediaType,
        mimeType: mimeType || null,
      });

      if (photoError || !photo) {
        console.error('Trip photo insert error:', photoError);
        await adminSupabase.storage.from('photos').remove([filePath]);
        failed.push(file.name || 'unknown-file');
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(filePath);

      uploadedPhotos.push({
        ...(photo as UploadedPhotoRow),
        uploader_name: 'You',
        url: publicUrl,
      });
    }

    if (uploadedPhotos.length === 0) {
      return NextResponse.json(
        { error: 'Failed to upload any files', failed },
        { status: 400 }
      );
    }

    if (!returnDetailed) {
      return NextResponse.json(uploadedPhotos, { status: 201 });
    }

    if (uploadedPhotos.length === 1 && files.length === 1 && failed.length === 0) {
      return NextResponse.json({ photo: uploadedPhotos[0] }, { status: 201 });
    }

    return NextResponse.json(
      {
        photos: uploadedPhotos,
        failed,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/trips/[id]/photos/upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
