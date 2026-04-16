import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

// POST /api/trips/[id]/budget/reconcile
// Body: { type: 'expense' | 'income', id: string, reconciled: boolean, notes?: string }
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const { type, id, reconciled, notes } = body;

    if (!type || !id) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'type and id are required', status: 400 });
    }

    const table = type === 'income' ? 'trip_income_entries' : 'trip_expenses';

    const { data, error } = await supabase
      .from(table)
      .update({
        reconciled: !!reconciled,
        reconciled_at: reconciled ? new Date().toISOString() : null,
        reconcile_notes: notes ?? null,
      })
      .eq('id', id)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(data);
  } catch (err) {
    console.error('POST budget/reconcile error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
