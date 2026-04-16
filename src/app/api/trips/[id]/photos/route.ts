import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';
const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];

interface ProfileDisplay {
  full_name?: string | null;
  nickname?: string | null;
}

interface PhotoRow {
  id: string;
  trip_id: string;
  gallery_id: string | null;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  media_type: 'image' | 'video';
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  profiles?: ProfileDisplay | ProfileDisplay[] | null;
}

interface PhotoDeleteRow {
  id: string;
  trip_id: string;
  uploaded_by: string;
  storage_path: string;
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

function getUploaderName(
  profileValue: ProfileDisplay | ProfileDisplay[] | null | undefined
) {
  const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;
  return profile?.nickname || profile?.full_name || 'Unknown';
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

/**
 * GET /api/trips/[id]/photos - List photos for a trip
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();

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

    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select(
        `
        id,
        trip_id,
        gallery_id,
        uploaded_by,
        storage_path,
        caption,
        media_type,
        mime_type,
        width,
        height,
        created_at,
        profiles:uploaded_by(full_name, nickname)
        `
      )
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    const photosWithUrls = ((photos ?? []) as PhotoRow[]).map((photo) => {
      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(photo.storage_path);

      return {
        ...photo,
        uploader_name: getUploaderName(photo.profiles),
        url: publicUrl,
      };
    });

    return NextResponse.json(photosWithUrls);
  } catch (error) {
    console.error('GET /api/trips/[id]/photos error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/trips/[id]/photos?photoId=...
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await context.params;
    const photoId = request.nextUrl.searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, trip_id, uploaded_by, storage_path')
      .eq('id', photoId)
      .single();

    if (photoError || !photo || photo.trip_id !== tripId) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const hasAccess = await canAccessTrip(supabase, user.id, role, tripId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canDelete = (role && ADMIN_ROLES.includes(role)) || photo.uploaded_by === user.id;
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const photoRow = photo as PhotoDeleteRow;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminSupabase =
      supabaseUrl && serviceRoleKey ? createSupabaseClient(supabaseUrl, serviceRoleKey) : null;

    const deleteClient = adminSupabase ?? supabase;
    const { error: deleteError } = await deleteClient
      .from('photos')
      .delete()
      .eq('id', photoId)
      .eq('trip_id', tripId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const storageClient = adminSupabase ?? supabase;
    const { error: storageError } = await storageClient.storage
      .from('photos')
      .remove([photoRow.storage_path]);

    if (storageError) {
      console.warn(
        'DELETE /api/trips/[id]/photos storage cleanup warning:',
        storageError.message
      );
    }

    return NextResponse.json({ success: true, deleted_photo_id: photoId });
  } catch (error) {
    console.error('DELETE /api/trips/[id]/photos error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
