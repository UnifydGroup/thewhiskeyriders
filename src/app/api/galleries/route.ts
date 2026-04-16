import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';
const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];

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

/**
 * GET /api/galleries - List all galleries or filter by trip_id
 * Query params: trip_id (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tripId = searchParams.get('trip_id');

    let query = supabase.from('galleries').select('*');

    if (tripId) {
      if (!role || !ADMIN_ROLES.includes(role)) {
        const hasMembership = await isTripMember(supabase, user.id, tripId);
        if (!hasMembership) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      query = query.eq('trip_id', tripId);
    } else if (!role || !ADMIN_ROLES.includes(role)) {
      const { data: memberships, error: membershipError } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', user.id);

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 });
      }

      const tripIds = (memberships || []).map((membership) => membership.trip_id);

      if (tripIds.length === 0) {
        return NextResponse.json({ galleries: [] });
      }

      query = query.in('trip_id', tripIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ galleries: data });
  } catch (error) {
    console.error('GET /api/galleries error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/galleries - Create a new gallery (trip admins and above)
 * Required fields: trip_id, name
 * Optional fields: description
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const trip_id = typeof body.trip_id === 'string' ? body.trip_id : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : null;

    // Validate required fields
    if (!trip_id || !name) {
      return NextResponse.json({ error: 'Missing required fields: trip_id, name' }, { status: 400 });
    }

    // Verify trip exists
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const isAdmin = role && ADMIN_ROLES.includes(role);
    const isTripAdmin = role === 'trip_admin';

    if (!isAdmin) {
      if (!isTripAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const hasMembership = await isTripMember(supabase, user.id, trip_id);
      if (!hasMembership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Create gallery
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .insert({
        trip_id,
        name,
        description: description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (galleryError) {
      return NextResponse.json({ error: galleryError.message }, { status: 500 });
    }

    return NextResponse.json({ gallery }, { status: 201 });
  } catch (error) {
    console.error('POST /api/galleries error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
