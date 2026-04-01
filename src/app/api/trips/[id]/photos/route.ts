import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { SupabaseDatabase as Database } from '@/lib/types/database.generated';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';

interface PhotoResponse {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string | null;
  uploaded_by: string;
  uploader_name?: string;
  url: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Handle both Promise and direct params (Next.js version compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const tripId = resolvedParams.id;

    console.log(`Fetching photos for trip: ${tripId}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Missing Supabase service credentials' },
        { status: 500 }
      );
    }

    const adminSupabase = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Unable to verify access', details: profileError.message },
        { status: 403 }
      );
    }

    const role = (profile?.role as Role | undefined) ?? null;
    const isAdmin = role === 'admin' || role === 'super_admin';

    if (!isAdmin) {
      const { data: membership, error: membershipError } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        return NextResponse.json(
          { error: 'Unable to verify trip membership', details: membershipError.message },
          { status: 403 }
        );
      }

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Query with service role to avoid RLS/policy type-mismatch issues for this endpoint.
    const { data: photos, error } = await adminSupabase
      .from('photos')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    console.log(`Photos query result:`, { photoCount: photos?.length, error });

    if (error) {
      console.error(`Database error for trip ${tripId}:`, error);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    // Get uploader names separately if photos exist
    const uploaderNames: Record<string, string> = {};
    if (photos && photos.length > 0) {
      const uploaderIds = [...new Set(photos.map((p) => p.uploaded_by))];

      if (uploaderIds.length > 0) {
        const { data: uploaders } = await adminSupabase
          .from('profiles')
          .select('id, full_name, nickname')
          .in('id', uploaderIds);

        if (uploaders) {
          uploaders.forEach((u) => {
            uploaderNames[u.id] = u.full_name || u.nickname || 'Unknown';
          });
        }
      }
    }

    // Get public URLs for each photo
    const photosWithUrls: PhotoResponse[] = (photos || []).map((photo) => {
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(photo.storage_path);

      return {
        id: photo.id,
        trip_id: photo.trip_id,
        storage_path: photo.storage_path,
        caption: photo.caption,
        width: photo.width,
        height: photo.height,
        created_at: photo.created_at,
        uploaded_by: photo.uploaded_by,
        uploader_name: uploaderNames[photo.uploaded_by] || 'Unknown',
        url: publicUrl,
      };
    });

    return NextResponse.json(photosWithUrls);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Photo list error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch photos', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Resolve async params
    const resolvedParams = await params;
    const tripId = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Missing Supabase service credentials' },
        { status: 500 }
      );
    }

    const adminSupabase = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey);

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Unable to verify access', details: profileError.message },
        { status: 403 }
      );
    }

    const role = (userProfile?.role as Role | undefined) ?? null;
    const isAdmin = role === 'admin' || role === 'super_admin';

    // Get photo ID from query params
    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json(
        { error: 'photoId is required' },
        { status: 400 }
      );
    }

    // Get the photo
    const { data: photo, error: photoError } = await adminSupabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .eq('trip_id', tripId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Check if user is the uploader or a trip admin
    if (photo.uploaded_by !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Delete from storage
    const { error: storageError } = await adminSupabase.storage
      .from('photos')
      .remove([photo.storage_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue anyway - delete the DB record
    }

    // Delete photo and related records
    const { error: deleteError } = await adminSupabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete photo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Photo deletion error:', err);
    return NextResponse.json(
      { error: 'Failed to delete photo', details: errorMessage },
      { status: 500 }
    );
  }
}
