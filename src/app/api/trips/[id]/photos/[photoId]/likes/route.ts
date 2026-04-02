import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey);
}

async function photoExistsInTrip(
  supabase: ReturnType<typeof createSupabaseClient> | Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  photoId: string
) {
  const { data, error } = await supabase
    .from('photos')
    .select('id, trip_id')
    .eq('id', photoId)
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

async function getLikeCount(
  supabase: ReturnType<typeof createSupabaseClient> | Awaited<ReturnType<typeof createClient>>,
  photoId: string
) {
  const { count, error } = await supabase
    .from('photo_likes')
    .select('id', { count: 'exact', head: true })
    .eq('photo_id', photoId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * GET /api/trips/[id]/photos/[photoId]/likes
 * Public: returns like count and whether current user has liked.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id: tripId, photoId } = await context.params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const dbClient = adminSupabase ?? supabase;

    const exists = await photoExistsInTrip(dbClient, tripId, photoId);
    if (!exists) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const likeCount = await getLikeCount(dbClient, photoId);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userLiked = false;
    if (user?.id) {
      const { data: likeRow, error } = await supabase
        .from('photo_likes')
        .select('id')
        .eq('photo_id', photoId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && adminSupabase) {
        const adminLike = await adminSupabase
        .from('photo_likes')
        .select('id')
        .eq('photo_id', photoId)
        .eq('user_id', user.id)
        .maybeSingle();
        if (adminLike.error) {
          throw new Error(adminLike.error.message);
        }
        userLiked = Boolean(adminLike.data?.id);
      } else {
        if (error) {
          throw new Error(error.message);
        }

        userLiked = Boolean(likeRow?.id);
      }
    }

    return NextResponse.json({ count: likeCount, userLiked });
  } catch (error) {
    console.error('GET /api/trips/[id]/photos/[photoId]/likes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/trips/[id]/photos/[photoId]/likes
 * Authenticated: add a like for current user.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id: tripId, photoId } = await context.params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const dbClient = adminSupabase ?? supabase;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const exists = await photoExistsInTrip(dbClient, tripId, photoId);
    if (!exists) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const { error } = await dbClient
      .from('photo_likes')
      .insert({ photo_id: photoId, user_id: user.id });

    // If already liked, keep endpoint idempotent.
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const likeCount = await getLikeCount(dbClient, photoId);
    return NextResponse.json({ success: true, count: likeCount, userLiked: true });
  } catch (error) {
    console.error('POST /api/trips/[id]/photos/[photoId]/likes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/trips/[id]/photos/[photoId]/likes
 * Authenticated: remove current user's like.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id: tripId, photoId } = await context.params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const dbClient = adminSupabase ?? supabase;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const exists = await photoExistsInTrip(dbClient, tripId, photoId);
    if (!exists) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const { error } = await dbClient
      .from('photo_likes')
      .delete()
      .eq('photo_id', photoId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const likeCount = await getLikeCount(dbClient, photoId);
    return NextResponse.json({ success: true, count: likeCount, userLiked: false });
  } catch (error) {
    console.error('DELETE /api/trips/[id]/photos/[photoId]/likes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
