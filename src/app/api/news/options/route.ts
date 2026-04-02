import { NextRequest } from 'next/server';
import { ApiErrors, errorResponse, successResponse, supabase, verifyRole } from '@/lib/api/helpers';

// GET /api/news/options - Fetch trip/member options for news tagging
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const [tripsResult, membersResult] = await Promise.all([
      supabase
        .from('trips')
        .select('id, name, slug, start_date, status')
        .order('start_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, nickname, avatar_url, status')
        .eq('status', 'active')
        .order('full_name', { ascending: true }),
    ]);

    if (tripsResult.error || membersResult.error) {
      return errorResponse(
        ApiErrors.INTERNAL_ERROR,
        tripsResult.error?.message || membersResult.error?.message || 'Failed to load news options'
      );
    }

    return successResponse({
      trips: tripsResult.data || [],
      members: membersResult.data || [],
    });
  } catch (error: unknown) {
    return errorResponse(
      ApiErrors.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
}
