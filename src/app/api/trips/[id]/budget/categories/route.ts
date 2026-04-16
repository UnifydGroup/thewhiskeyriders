import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/budget/categories
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated } = await verifyRole(request, ['member', 'trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

    const { data, error } = await supabase
      .from('trip_budget_categories')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return successResponse(data ?? []);
  } catch (err) {
    console.error('GET budget/categories error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// POST /api/trips/[id]/budget/categories
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const { name, planned_aud, color, sort_order, notes } = body;

    if (!name || planned_aud === undefined) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'name and planned_aud are required', status: 400 });
    }

    const { data, error } = await supabase
      .from('trip_budget_categories')
      .insert({
        trip_id: tripId,
        name,
        planned_aud: Number(planned_aud),
        color: color ?? '#B5621E',
        sort_order: sort_order ?? 0,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return successResponse(data, 201);
  } catch (err) {
    console.error('POST budget/categories error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
