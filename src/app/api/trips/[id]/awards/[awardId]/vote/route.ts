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
  getCurrentUser,
  getUserProfile,
} from '@/lib/api/helpers';

// GET /api/trips/[id]/awards/[awardId]/votes - Get vote results
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; awardId: string }> }
) {
  try {
    const params = await props.params;
    const { id, awardId } = params;

    const { authenticated } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { data: votes, error } = await supabase
      .from('votes')
      .select(
        `
        *,
        voters:voter_id (id, full_name, avatar_url),
        nominees:nominee_id (id, full_name, avatar_url)
      `
      )
      .eq('award_id', awardId);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Calculate vote counts by nominee
    const votesByNominee = (votes || []).reduce(
      (acc, vote) => {
        acc[vote.nominee_id] = (acc[vote.nominee_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return successResponse({
      votes: votes || [],
      votes_by_nominee: votesByNominee,
      total_votes: votes?.length || 0,
    });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// POST /api/trips/[id]/awards/[awardId]/vote - Cast a vote
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; awardId: string }> }
) {
  try {
    const params = await props.params;
    const { id, awardId } = params;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    // Check if user is a trip member
    const isMember = await isUserTripMember(user.id, id);
    if (!isMember) {
      return errorResponse(ApiErrors.FORBIDDEN, 'You must be a trip member to vote');
    }

    const body = await getJsonBody(request);

    if (!body.nominee_id) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'nominee_id is required');
    }

    // Check if already voted for this award
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('award_id', awardId)
      .eq('voter_id', user.id)
      .single();

    if (existingVote) {
      // Update vote instead
      const { data: vote, error } = await supabase
        .from('votes')
        .update({ nominee_id: body.nominee_id })
        .eq('id', existingVote.id)
        .select()
        .single();

      if (error) {
        return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
      }

      // Log activity
      await logActivity(
        user.id,
        'update',
        'vote',
        vote.id,
        `Updated vote for award ${awardId}`,
        { nominee_id: body.nominee_id },
        getIpAddress(request)
      );

      return successResponse(vote);
    }

    const voteData = {
      award_id: awardId,
      voter_id: user.id,
      nominee_id: body.nominee_id,
    };

    const { data: vote, error } = await supabase
      .from('votes')
      .insert(voteData)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'vote',
      'award',
      awardId,
      `Voted for ${body.nominee_id}`,
      { nominee_id: body.nominee_id },
      getIpAddress(request)
    );

    return successResponse(vote, 201);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
