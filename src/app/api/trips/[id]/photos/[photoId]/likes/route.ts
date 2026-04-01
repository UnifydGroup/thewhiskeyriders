import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function makeSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );
}

// GET - Get like count and whether current user liked
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = makeSupabase(cookieStore);
    const { photoId } = await params;

    const { data: { user } } = await supabase.auth.getUser();

    const { count, error: countError } = await supabase
      .from('photo_likes')
      .select('*', { count: 'exact', head: true })
      .eq('photo_id', photoId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    let userLiked = false;
    if (user) {
      const { data: userLike } = await supabase
        .from('photo_likes')
        .select('id')
        .eq('photo_id', photoId)
        .eq('user_id', user.id)
        .single();

      userLiked = !!userLike;
    }

    return NextResponse.json({ count: count || 0, userLiked });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Like fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch likes', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Add a like
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = makeSupabase(cookieStore);
    const { photoId } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existingLike } = await supabase
      .from('photo_likes')
      .select('id')
      .eq('photo_id', photoId)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      return NextResponse.json(
        { error: 'You already liked this photo' },
        { status: 409 }
      );
    }

    const { data: like, error } = await supabase
      .from('photo_likes')
      .insert({ photo_id: photoId, user_id: user.id })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(like, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Like creation error:', err);
    return NextResponse.json(
      { error: 'Failed to like photo', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Remove a like
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = makeSupabase(cookieStore);
    const { photoId } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('photo_likes')
      .delete()
      .eq('photo_id', photoId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to remove like' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Like deletion error:', err);
    return NextResponse.json(
      { error: 'Failed to remove like', details: errorMessage },
      { status: 500 }
    );
  }
}
