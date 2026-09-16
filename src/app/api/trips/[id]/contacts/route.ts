import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
  isUserTripMember,
} from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/contacts
// Admins see all contacts; members see member_visible only.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, user, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

    const isAdmin = ['admin', 'super_admin', 'trip_admin'].includes(profile?.role ?? '');

    if (!isAdmin) {
      const isMember = await isUserTripMember(user!.id, tripId);
      if (!isMember) return errorResponse(ApiErrors.FORBIDDEN);
    }

    let query = supabase
      .from('trip_contacts')
      .select('*')
      .eq('trip_id', tripId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });

    if (!isAdmin) {
      query = query.eq('member_visible', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return successResponse({ contacts: data ?? [] });
  } catch (err) {
    console.error('GET trip contacts error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// POST /api/trips/[id]/contacts
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized, profile } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const {
      category = 'general',
      name,
      role,
      phone,
      email,
      notes,
      sort_order = 0,
      member_visible = true,
    } = body;

    if (!name || !String(name).trim()) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'name is required');
    }

    const { data, error } = await supabase
      .from('trip_contacts')
      .insert({
        trip_id: tripId,
        category: category || 'general',
        name: String(name).trim(),
        role: role || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        sort_order,
        member_visible: member_visible !== false,
        created_by: profile?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return successResponse({ contact: data }, 201);
  } catch (err) {
    console.error('POST trip contacts error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
