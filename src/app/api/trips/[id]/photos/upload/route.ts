import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';
const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];

interface UploadedPhotoRow {
  id: string;
  trip_id: string;
  gallery_id: string | null;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
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
  const fromName = file.name.split('.').pop()?.toLowerCase() || '';
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  const fromMime = file.type.split('/').pop()?.toLowerCase() || '';
  if (fromMime === 'jpeg') {
    return 'jpg';
  }

  return fromMime && /^[a-z0-9]+$/.test(fromMime) ? fromMime : 'bin';
}

/**
 * POST /api/trips/[id]/photos/upload - Upload photo(s) directly to a trip
 *
 * Expected FormData:
 * - files: File[] OR file: File
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
      if (!file.type.startsWith('image/')) {
        failed.push(file.name || 'unknown-file');
        continue;
      }

      const timestamp = Date.now();
      const ext = getFileExtension(file);
      const fileName = `${timestamp}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const filePath = `trips/${tripId}/${fileName}`;

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
