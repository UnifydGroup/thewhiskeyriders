import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  logActivity,
  getIpAddress,
  supabase,
  isUserTripMember,
} from '@/lib/api/helpers';

// GET /api/trips/[id]/awards - List awards for a trip
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { data: awards, error } = await supabase
      .from('awards')
      .select('*')
      .eq('trip_id', tripId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Get vote counts for each award
    const awardsWithVotes = await Promise.all(
      (awards || []).map(async (award) => {
        const { data: votes, count } = await supabase
          .from('votes')
          .select('*', { count: 'exact' })
          .eq('award_id', award.id);

        // Get winner (most voted nominee)
        const votesByNominee = (votes || []).reduce(
          (acc, vote) => {
            acc[vote.nominee_id] = (acc[vote.nominee_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const winner = Object.entries(votesByNominee).sort(([, a], [, b]) => b - a)[0];

        return {
          ...award,
          vote_count: count || 0,
          winner_id: winner ? winner[0] : null,
          winner_votes: winner ? winner[1] : 0,
        };
      })
    );

    return successResponse({ awards: awardsWithVotes });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// POST /api/trips/[id]/awards - Create award (admin or trip admin)
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated, authorized, user, profile } = await verifyRole(request, [
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      // Check if user is trip admin for this trip
      const isTripMember = await isUserTripMember(user!.id, tripId);
      if (!isTripMember) {
        return errorResponse(ApiErrors.FORBIDDEN);
      }
    }

    const body = await getJsonBody(request);

    if (!body.name) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Award name is required');
    }

    const awardData = {
      trip_id: tripId,
      name: body.name,
      description: body.description || null,
      emoji: body.emoji || '🏆',
      is_active: true,
    };

    const { data: award, error } = await supabase
      .from('awards')
      .insert(awardData)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user!.id,
      'create',
      'award',
      award.id,
      award.name,
      { emoji: body.emoji },
      getIpAddress(request)
    );

    return successResponse(award, 201);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
