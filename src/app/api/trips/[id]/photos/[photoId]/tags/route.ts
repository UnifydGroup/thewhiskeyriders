import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

type TagType = 'trip' | 'year' | 'location' | 'person';

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

// GET all tags for a photo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = makeSupabase(cookieStore);
    const { photoId } = await params;

    const { data: tags, error } = await supabase
      .from('photo_tags')
      .select('*')
      .eq('photo_id', photoId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(tags || []);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Tag fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch tags', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Add a new tag
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
    const { tag_type, tag_value } = body;

    if (!tag_type || !tag_value) {
      return NextResponse.json(
        { error: 'tag_type and tag_value are required' },
        { status: 400 }
      );
    }

    const validTypes: TagType[] = ['trip', 'year', 'location', 'person'];
    if (!validTypes.includes(tag_type)) {
      return NextResponse.json(
        { error: 'Invalid tag_type. Must be one of: trip, year, location, person' },
        { status: 400 }
      );
    }

    const { data: existingTag } = await supabase
      .from('photo_tags')
      .select('id')
      .eq('photo_id', photoId)
      .eq('tag_type', tag_type)
      .eq('tag_value', tag_value)
      .single();

    if (existingTag) {
      return NextResponse.json(
        { error: 'This tag already exists on this photo' },
        { status: 409 }
      );
    }

    const { data: tag, error } = await supabase
      .from('photo_tags')
      .insert({ photo_id: photoId, tag_type, tag_value })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Tag creation error:', err);
    return NextResponse.json(
      { error: 'Failed to create tag', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Remove a tag
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
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 });
    }

    const { data: tag, error: tagError } = await supabase
      .from('photo_tags')
      .select('*')
      .eq('id', tagId)
      .eq('photo_id', photoId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Only admins can delete tags (no created_by column on photo_tags)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !['admin', 'super_admin'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('photo_tags')
      .delete()
      .eq('id', tagId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Tag deletion error:', err);
    return NextResponse.json(
      { error: 'Failed to delete tag', details: errorMessage },
      { status: 500 }
    );
  }
}
