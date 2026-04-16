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
  isValidEmail,
} from '@/lib/api/helpers';

// GET /api/members - List all members (admin only)
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, ['admin', 'super_admin']);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { limit, offset } = getPagination(request);
    const search = request.nextUrl.searchParams.get('search');

    let query = supabase.from('profiles').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`nickname.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: members, count, error } = await query
      .order('nickname', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Get trip counts for each member
    const membersWithStats = await Promise.all(
      (members || []).map(async (member) => {
        const { count: tripCount } = await supabase
          .from('trip_members')
          .select('*', { count: 'exact' })
          .eq('user_id', member.id);

        return {
          ...member,
          trip_count: tripCount || 0,
        };
      })
    );

    return successResponse({
      members: membersWithStats,
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// GET /api/members/[id] - Get member profile
export async function GET_PROFILE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const memberId = params.id;

    const { authenticated, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { data: member, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single();

    if (error || !member) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Member not found');
    }

    // Members can only see their own full profile
    if (profile?.id !== memberId && profile?.role === 'member') {
      // Return limited public info
      return successResponse({
        id: member.id,
        email: member.email,
        nickname: member.nickname,
        full_name: member.full_name,
        avatar_url: member.avatar_url,
        bio: member.bio,
      });
    }

    // Get member's trips
    const { data: trips } = await supabase
      .from('trip_members')
      .select(
        `
        trip_id,
        trip_role,
        trips:trip_id (id, name, slug, start_date, end_date)
      `
      )
      .eq('user_id', memberId);

    return successResponse({
      ...member,
      trips: trips || [],
    });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
