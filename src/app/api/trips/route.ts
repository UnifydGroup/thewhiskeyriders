import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  getPagination,
  logActivity,
  getIpAddress,
  supabase,
  generateSlug,
} from '@/lib/api/helpers';

// GET /api/trips - List all trips with filters
export async function GET(request: NextRequest) {
  try {
    const { authenticated, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { limit, offset } = getPagination(request);
    const status = request.nextUrl.searchParams.get('status');
    const country = request.nextUrl.searchParams.get('country');

    let query = supabase.from('trips').select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status as 'upcoming' | 'active' | 'completed' | 'cancelled');
    }

    if (country) {
      query = query.eq('country', country);
    }

    // Non-admins don't see cancelled trips
    if (profile?.role === 'member') {
      query = query.neq('status', 'cancelled');
    }

    const { data: trips, count, error } = await query
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    return successResponse({
      trips,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// POST /api/trips - Create new trip (admin only)
export async function POST(request: NextRequest) {
  try {
    const { authenticated, authorized, profile, user } = await verifyRole(request, [
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await getJsonBody(request);

    // Validation
    if (!body.name || !body.destination || !body.country || !body.start_date || !body.end_date) {
      return errorResponse(
        ApiErrors.BAD_REQUEST,
        'Missing required fields: name, destination, country, start_date, end_date'
      );
    }

    const slug = generateSlug(body.name);

    // Check if slug already exists
    const { data: existingTrip } = await supabase
      .from('trips')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTrip) {
      return errorResponse(ApiErrors.CONFLICT, 'A trip with this name already exists');
    }

    const tripData = {
      slug,
      name: body.name,
      destination: body.destination,
      country: body.country,
      start_date: body.start_date,
      end_date: body.end_date,
      description: body.description || null,
      itinerary: body.itinerary || null,
      cover_image_url: body.cover_image_url || null,
      status: body.status || 'upcoming',
      max_members: body.max_members || null,
      created_by: user!.id,
    };

    const { data: trip, error } = await supabase.from('trips').insert(tripData).select().single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(user!.id, 'create', 'trip', trip.id, trip.name, null, getIpAddress(request));

    return successResponse(trip, 201);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
