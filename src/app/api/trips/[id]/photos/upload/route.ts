import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';
type MediaType = 'image' | 'video';
const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];
const MAX_MEDIA_UPLOAD_BYTES = 100 * 1024 * 1024;

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

function getFileExtension(file: File) {
  return getFileExtensionFromParts(file.name, file.type);
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

function getMediaType(mimeType: string): MediaType | null {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  return null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

        for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
          const rawFile = files[fileIndex];
          const name = asString(rawFile.name) || 'unknown-file';
          const mimeType = asString(rawFile.type);
          const size = asNumber(rawFile.size) ?? 0;
          const mediaType = getMediaType(mimeType);

          if (!mediaType || size <= 0 || size > MAX_MEDIA_UPLOAD_BYTES) {
            failed.push(name);
            continue;
          }

          const timestamp = Date.now();
          const ext = getFileExtensionFromParts(name, mimeType);
          const fileName = `${timestamp}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
          const filePath = `trips/${tripId}/${mediaType}s/${fileName}`;

          const { data: signedData, error: signedError } = await adminSupabase.storage
            .from('photos')
            .createSignedUploadUrl(filePath, {
              upsert: false,
            });

          if (signedError || !signedData?.token) {
            failed.push(name);
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

        return NextResponse.json({ uploads, failed }, { status: 200 });
      }

      if (action === 'finalize') {
        const uploads = Array.isArray(body.uploads) ? (body.uploads as JsonFinalizeUpload[]) : [];
        if (uploads.length === 0) {
          return NextResponse.json({ error: 'No uploads provided' }, { status: 400 });
        }

        const uploadedPhotos: Array<Record<string, unknown>> = [];
        const failed: string[] = [];

        for (const rawUpload of uploads) {
          const filePath = asString(rawUpload.file_path);
          const mimeType = asString(rawUpload.mime_type);
          const mediaTypeRaw = asString(rawUpload.media_type);
          const mediaType: MediaType =
            mediaTypeRaw === 'video' || mediaTypeRaw === 'image'
              ? mediaTypeRaw
              : getMediaType(mimeType || '') || 'image';

          if (!filePath.startsWith(`trips/${tripId}/`)) {
            failed.push(filePath || 'unknown-file');
            continue;
          }

          const caption = asString(rawUpload.caption) || null;

          const { data: photo, error: photoError } = await adminSupabase
            .from('photos')
            .insert({
              trip_id: tripId,
              gallery_id: null,
              uploaded_by: user.id,
              storage_path: filePath,
              caption,
              media_type: mediaType,
              mime_type: mimeType || null,
              width: null,
              height: null,
            })
            .select()
            .single();

          if (photoError || !photo) {
            failed.push(filePath);
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
            { error: 'Failed to finalize any uploads', failed },
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
      const mediaType = getMediaType(file.type || '');
      if (!mediaType) {
        failed.push(file.name || 'unknown-file');
        continue;
      }
      if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
        failed.push(file.name || 'unknown-file');
        continue;
      }

      const timestamp = Date.now();
      const ext = getFileExtension(file);
      const fileName = `${timestamp}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const filePath = `trips/${tripId}/${mediaType}s/${fileName}`;

      const buffer = await file.arrayBuffer();
      const { error: uploadError } = await adminSupabase.storage
        .from('photos')
        .upload(filePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Trip photo upload error:', uploadError);
        failed.push(file.name || 'unknown-file');
        continue;
      }

      const { data: photo, error: photoError } = await adminSupabase
        .from('photos')
        .insert({
          trip_id: tripId,
          gallery_id: null,
          uploaded_by: user.id,
          storage_path: filePath,
          caption,
          media_type: mediaType,
          mime_type: file.type || null,
          width: null,
          height: null,
        })
        .select()
        .single();

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
