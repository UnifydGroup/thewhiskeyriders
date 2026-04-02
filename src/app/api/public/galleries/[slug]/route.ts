import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { SupabaseDatabase } from '@/lib/types/database.generated';

interface TripRow {
  id: string;
  slug: string;
  name: string;
  destination: string;
  country: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
}

interface ProfileLite {
  full_name: string | null;
  nickname: string | null;
}

interface PhotoRow {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  media_type: 'image' | 'video' | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploaded_by: string;
  profiles: ProfileLite | ProfileLite[] | null;
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient<SupabaseDatabase>(supabaseUrl, serviceRoleKey);
}

function getUploaderName(profile: ProfileLite | ProfileLite[] | null | undefined) {
  const value = Array.isArray(profile) ? profile[0] : profile;
  return value?.full_name || value?.nickname || 'Unknown';
}

/**
 * GET /api/public/galleries/[slug]
 * Public-facing trip gallery detail with only safe fields.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select('id, slug, name, destination, country, start_date, end_date, status')
      .eq('slug', slug)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (tripError) {
      return NextResponse.json({ error: tripError.message }, { status: 500 });
    }

    if (!tripData) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    const trip = tripData as TripRow;

    const { data: photosData, error: photosError } = await supabase
      .from('photos')
      .select(`
        id,
        trip_id,
        storage_path,
        caption,
        media_type,
        mime_type,
        width,
        height,
        created_at,
        uploaded_by,
        profiles:uploaded_by(full_name, nickname)
      `)
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: false });

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    const photos = ((photosData || []) as PhotoRow[]).map((photo) => {
      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(photo.storage_path);

      return {
        id: photo.id,
        trip_id: photo.trip_id,
        storage_path: photo.storage_path,
        caption: photo.caption,
        media_type: photo.media_type === 'video' ? 'video' : 'image',
        mime_type: photo.mime_type,
        width: photo.width,
        height: photo.height,
        created_at: photo.created_at,
        uploaded_by: photo.uploaded_by,
        uploader_name: getUploaderName(photo.profiles),
        url: publicUrl,
      };
    });

    return NextResponse.json({ trip, photos });
  } catch (error) {
    console.error('GET /api/public/galleries/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
