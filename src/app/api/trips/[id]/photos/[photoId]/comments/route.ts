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

// GET - List all comments for a photo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = makeSupabase(cookieStore);
    const { photoId } = await params;

    const { data: comments, error } = await supabase
      .from('photo_comments')
      .select(`*, profiles!user_id(full_name, nickname)`)
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const commentsWithNames = (comments || []).map((comment: any) => ({
      ...comment,
      author_name:
        comment.profiles?.full_name || comment.profiles?.nickname || 'Anonymous',
    }));

    return NextResponse.json(commentsWithNames);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Comments fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch comments', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Add a comment
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

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    if (content.length > 500) {
      return NextResponse.json(
        { error: 'Comment must be 500 characters or less' },
        { status: 400 }
      );
    }

    const { data: comment, error } = await supabase
      .from('photo_comments')
      .insert({ photo_id: photoId, user_id: user.id, content: content.trim() })
      .select(`*, profiles!user_id(full_name, nickname)`)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        ...comment,
        author_name:
          comment.profiles?.full_name || comment.profiles?.nickname || 'Anonymous',
      },
      { status: 201 }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Comment creation error:', err);
    return NextResponse.json(
      { error: 'Failed to create comment', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Remove a comment
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

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'commentId is required' }, { status: 400 });
    }

    const { data: comment, error: fetchError } = await supabase
      .from('photo_comments')
      .select('*')
      .eq('id', commentId)
      .eq('photo_id', photoId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.user_id !== user.id) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userProfile || !['admin', 'super_admin'].includes(userProfile.role)) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const { error: deleteError } = await supabase
      .from('photo_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Comment deletion error:', err);
    return NextResponse.json(
      { error: 'Failed to delete comment', details: errorMessage },
      { status: 500 }
    );
  }
}
