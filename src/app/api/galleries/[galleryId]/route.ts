import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';
type MediaType = 'image' | 'video';
const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];
const MAX_MEDIA_UPLOAD_BYTES = 500 * 1024 * 1024;
const VIDEO_UPLOADS_ENABLED = false;
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

async function canManageTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: Role | null,
  tripId: string
) {
  if (role && (ADMIN_ROLES.includes(role) || role === 'trip_admin')) {
    if (role === 'trip_admin') {
      return isTripMember(supabase, userId, tripId);
    }
    return true;
  }

  return false;
}

/**
 * POST /api/galleries/[galleryId] - Upload media file(s) to a gallery
 * All authenticated users can upload images to galleries of trips they're members of
 * 
 * Expected FormData:
 * - files: File[] (image(s) to upload) OR file: File
 * - caption: string (optional)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ galleryId: string }> }
) {
  try {
    const { galleryId } = await context.params;
    const supabase = await createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey);

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get gallery and its trip
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .select('id, trip_id, name')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    const hasAccess = await canAccessTrip(supabase, user.id, role, gallery.trip_id);
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
          const mimeTypeInput = asString(rawFile.type);
          const size = asNumber(rawFile.size) ?? 0;
          const mediaType = getMediaType(mimeTypeInput, name);
          const mimeType = normalizeUploadMimeType(mimeTypeInput, name, mediaType) || '';

          if (
            !mediaType ||
            (mediaType === 'video' && !VIDEO_UPLOADS_ENABLED) ||
            size <= 0 ||
            size > MAX_MEDIA_UPLOAD_BYTES
          ) {
            failed.push(name);
            continue;
          }

          const timestamp = Date.now();
          const fileExt = getFileExtensionFromParts(name, mimeType || mimeTypeInput);
          const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `galleries/${galleryId}/${mediaType}s/${fileName}`;

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
          const mimeTypeInput = asString(rawUpload.mime_type);
          const mediaTypeRaw = asString(rawUpload.media_type);
          const mediaType: MediaType =
            mediaTypeRaw === 'video' || mediaTypeRaw === 'image'
              ? mediaTypeRaw
              : getMediaType(mimeTypeInput || '', filePath) || 'image';
          const mimeType = normalizeUploadMimeType(mimeTypeInput, filePath, mediaType) || null;

          if (!filePath.startsWith(`galleries/${galleryId}/`)) {
            failed.push(filePath || 'unknown-file');
            continue;
          }

          if (mediaType === 'video' && !VIDEO_UPLOADS_ENABLED) {
            failed.push(filePath || 'unknown-file');
            await adminSupabase.storage.from('photos').remove([filePath]);
            continue;
          }

          const caption = asString(rawUpload.caption) || null;

          const { data: photo, error: photoError } = await adminSupabase
            .from('photos')
            .insert({
              trip_id: gallery.trip_id,
              gallery_id: galleryId,
              uploaded_by: user.id,
              storage_path: filePath,
              caption: caption,
              media_type: mediaType,
              mime_type: mimeType || null,
              width: null,
              height: null,
            })
            .select()
            .single();

          if (photoError || !photo) {
            failed.push(filePath || 'unknown-file');
            continue;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from('photos').getPublicUrl(filePath);

          uploadedPhotos.push({
            ...photo,
            url: publicUrl,
          });
        }

        if (uploadedPhotos.length === 0) {
          return NextResponse.json(
            { error: 'Failed to finalize any uploads', failed },
            { status: 400 }
          );
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

    // Parse form data
    const formData = await request.formData();
    const filesFromMulti = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
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
      if (mediaType === 'video' && !VIDEO_UPLOADS_ENABLED) {
        failed.push(file.name || 'unknown-file');
        continue;
      }
      if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
        failed.push(file.name || 'unknown-file');
        continue;
      }

      // Create a unique file path
      const timestamp = Date.now();
      const mimeType = normalizeUploadMimeType(file.type || '', file.name, mediaType) || '';
      const fileExt = getFileExtensionFromParts(file.name, mimeType || file.type);
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `galleries/${galleryId}/${mediaType}s/${fileName}`;

      // Upload file to storage
      const buffer = await file.arrayBuffer();
      const { error: uploadError } = await adminSupabase.storage
        .from('photos')
        .upload(filePath, buffer, {
          contentType: mimeType || undefined,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        failed.push(file.name || 'unknown-file');
        continue;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(filePath);

      // Create photo record in database
      const { data: photo, error: photoError } = await adminSupabase
        .from('photos')
        .insert({
          trip_id: gallery.trip_id,
          gallery_id: galleryId,
          uploaded_by: user.id,
          storage_path: filePath,
          caption: caption,
          media_type: mediaType,
          mime_type: mimeType || null,
          width: null, // Could be extracted from file, but keeping simple for now
          height: null,
        })
        .select()
        .single();

      if (photoError || !photo) {
        console.error('Photo record error:', photoError);
        await adminSupabase.storage.from('photos').remove([filePath]);
        failed.push(file.name || 'unknown-file');
        continue;
      }

      uploadedPhotos.push({
        ...photo,
        url: publicUrl,
      });
    }

    if (uploadedPhotos.length === 0) {
      return NextResponse.json(
        { error: 'Failed to upload any files', failed },
        { status: 400 }
      );
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
    console.error('POST /api/galleries/[galleryId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/galleries/[galleryId] - Get all photos in a gallery
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ galleryId: string }> }
) {
  try {
    const { galleryId } = await context.params;
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify gallery exists and user can access it
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .select('id, trip_id, name')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    const hasAccess = await canAccessTrip(supabase, user.id, role, gallery.trip_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all photos in this gallery
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select(
        `
        id,
        gallery_id,
        trip_id,
        uploaded_by,
        storage_path,
        caption,
        media_type,
        mime_type,
        width,
        height,
        created_at,
        profiles:uploaded_by(full_name, nickname, avatar_url)
        `
      )
      .eq('gallery_id', galleryId)
      .order('created_at', { ascending: false });

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    // Add public URLs to photos
    const photosWithUrls = (photos || []).map((photo: { storage_path: string } & Record<string, unknown>) => {
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(photo.storage_path);

      return {
        ...photo,
        url: publicUrl,
      };
    });

    return NextResponse.json({
      gallery,
      photos: photosWithUrls,
    });
  } catch (error) {
    console.error('GET /api/galleries/[galleryId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/galleries/[galleryId] - Update gallery metadata
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ galleryId: string }> }
) {
  try {
    const { galleryId } = await context.params;
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existingGallery, error: galleryError } = await supabase
      .from('galleries')
      .select('id, trip_id')
      .eq('id', galleryId)
      .single();

    if (galleryError || !existingGallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    const canManageCurrentTrip = await canManageTrip(supabase, user.id, role, existingGallery.trip_id);
    if (!canManageCurrentTrip) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const description =
      typeof body.description === 'string' ? body.description.trim() : body.description;
    const tripId = typeof body.trip_id === 'string' ? body.trip_id : undefined;

    if (name === '') {
      return NextResponse.json({ error: 'Gallery name cannot be empty' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      updates.name = name;
    }

    if (description !== undefined) {
      updates.description = description === '' ? null : description;
    }

    if (tripId !== undefined && tripId !== existingGallery.trip_id) {
      const { data: nextTrip } = await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .single();

      if (!nextTrip) {
        return NextResponse.json({ error: 'Target trip not found' }, { status: 404 });
      }

      const canManageTargetTrip = await canManageTrip(supabase, user.id, role, tripId);
      if (!canManageTargetTrip) {
        return NextResponse.json({ error: 'Forbidden for target trip' }, { status: 403 });
      }

      updates.trip_id = tripId;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: updatedGallery, error: updateError } = await supabase
      .from('galleries')
      .update(updates)
      .eq('id', galleryId)
      .select('*')
      .single();

    if (updateError || !updatedGallery) {
      return NextResponse.json({ error: updateError?.message || 'Failed to update gallery' }, { status: 500 });
    }

    return NextResponse.json({ gallery: updatedGallery });
  } catch (error) {
    console.error('PUT /api/galleries/[galleryId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/galleries/[galleryId] - Delete gallery and remove linked photos
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ galleryId: string }> }
) {
  try {
    const { galleryId } = await context.params;
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .select('id, trip_id, name')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    const canManage = await canManageTrip(supabase, user.id, role, gallery.trip_id);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: galleryPhotos, error: photosError } = await supabase
      .from('photos')
      .select('id, storage_path')
      .eq('gallery_id', galleryId);

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    const storagePaths = (galleryPhotos || [])
      .map((photo) => photo.storage_path)
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('photos').remove(storagePaths);
      if (storageError) {
        console.error('Gallery storage cleanup error:', storageError);
      }
    }

    const { error: deletePhotosError } = await supabase
      .from('photos')
      .delete()
      .eq('gallery_id', galleryId);

    if (deletePhotosError) {
      return NextResponse.json({ error: deletePhotosError.message }, { status: 500 });
    }

    const { error: deleteGalleryError } = await supabase
      .from('galleries')
      .delete()
      .eq('id', galleryId);

    if (deleteGalleryError) {
      return NextResponse.json({ error: deleteGalleryError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_photos: galleryPhotos?.length || 0,
    });
  } catch (error) {
    console.error('DELETE /api/galleries/[galleryId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
