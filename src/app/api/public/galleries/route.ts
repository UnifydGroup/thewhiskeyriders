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
  cover_image_url: string | null;
}

interface PhotoCoverRow {
  storage_path: string;
  media_type: 'image' | 'video' | null;
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient<SupabaseDatabase>(supabaseUrl, serviceRoleKey);
}

/**
 * GET /api/public/galleries
 * Public-facing trip gallery list with only safe fields.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select('id, slug, name, destination, country, start_date, end_date, status, cover_image_url')
      .neq('status', 'cancelled')
      .order('start_date', { ascending: false });

    if (tripsError) {
      return NextResponse.json({ error: tripsError.message }, { status: 500 });
    }

    const trips = (tripsData || []) as TripRow[];

    const tripsWithCovers = await Promise.all(
      trips.map(async (trip) => {
        if (trip.cover_image_url) {
          return {
            ...trip,
            coverPhotoUrl: trip.cover_image_url,
            coverMediaType: 'image' as const,
          };
        }

        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('storage_path, media_type')
          .eq('trip_id', trip.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (photosError || !photosData || photosData.length === 0) {
          return {
            ...trip,
            coverPhotoUrl: null,
            coverMediaType: null,
          };
        }

        const latest = photosData[0] as PhotoCoverRow;
        const {
          data: { publicUrl },
        } = supabase.storage.from('photos').getPublicUrl(latest.storage_path);

        return {
          ...trip,
          coverPhotoUrl: publicUrl,
          coverMediaType: latest.media_type === 'video' ? 'video' : 'image',
        };
      })
    );

    return NextResponse.json({ trips: tripsWithCovers });
  } catch (error) {
    console.error('GET /api/public/galleries error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
