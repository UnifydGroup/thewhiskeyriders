import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseDatabase as Database } from '@/lib/types/database.generated';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';

interface MetricEntry {
  count: number;
  lastPhotoAt: string | null;
}

function upsertMetric(target: Record<string, MetricEntry>, key: string, createdAt: string) {
  const existing = target[key];
  if (!existing) {
    target[key] = { count: 1, lastPhotoAt: createdAt };
    return;
  }

  const nextLastPhotoAt =
    !existing.lastPhotoAt || new Date(createdAt).getTime() > new Date(existing.lastPhotoAt).getTime()
      ? createdAt
      : existing.lastPhotoAt;

  target[key] = {
    count: existing.count + 1,
    lastPhotoAt: nextLastPhotoAt,
  };
}

/**
 * GET /api/galleries/metrics
 * Returns photo counts and latest photo timestamps grouped by trip and gallery.
 */
export async function GET() {
  try {
    const supabase = await createClient();

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
      return NextResponse.json({ error: 'Unable to verify access' }, { status: 403 });
    }

    const role = (profile?.role as Role | undefined) ?? null;
    const isAdmin = role === 'admin' || role === 'super_admin';
    const isTripAdmin = role === 'trip_admin';

    if (!isAdmin && !isTripAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminSupabase = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey);

    let allowedTripIds: string[] | null = null;
    if (!isAdmin) {
      const { data: memberships, error: membershipError } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', user.id);

      if (membershipError) {
        return NextResponse.json({ error: 'Unable to verify trip access' }, { status: 500 });
      }

      allowedTripIds = [...new Set((memberships || []).map((membership) => membership.trip_id))];
      if (allowedTripIds.length === 0) {
        return NextResponse.json({ byTrip: {}, byGallery: {} });
      }
    }

    let photosQuery = adminSupabase.from('photos').select('trip_id, gallery_id, created_at');
    if (allowedTripIds) {
      photosQuery = photosQuery.in('trip_id', allowedTripIds);
    }

    const { data: photos, error: photosError } = await photosQuery;
    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    const byTrip: Record<string, MetricEntry> = {};
    const byGallery: Record<string, MetricEntry> = {};

    for (const photo of photos || []) {
      if (photo.created_at) {
        upsertMetric(byTrip, photo.trip_id, photo.created_at);
        if (photo.gallery_id) {
          upsertMetric(byGallery, photo.gallery_id, photo.created_at);
        }
      }
    }

    return NextResponse.json({ byTrip, byGallery });
  } catch (error) {
    console.error('GET /api/galleries/metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
