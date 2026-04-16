import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string; catId: string }> };

// PUT /api/trips/[id]/budget/categories/[catId]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, catId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const { name, planned_aud, color, sort_order, notes } = body;

    const { data, error } = await supabase
      .from('trip_budget_categories')
      .update({
        ...(name !== undefined && { name }),
        ...(planned_aud !== undefined && { planned_aud: Number(planned_aud) }),
        ...(color !== undefined && { color }),
        ...(sort_order !== undefined && { sort_order }),
        ...(notes !== undefined && { notes }),
      })
      .eq('id', catId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(data);
  } catch (err) {
    console.error('PUT budget/categories/[catId] error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// DELETE /api/trips/[id]/budget/categories/[catId]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, catId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { error } = await supabase
      .from('trip_budget_categories')
      .delete()
      .eq('id', catId)
      .eq('trip_id', tripId);

    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('DELETE budget/categories/[catId] error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
