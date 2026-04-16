import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string; expId: string }> };

// PUT /api/trips/[id]/budget/expenses/[expId]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, expId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const { category_id, description, amount, currency, exchange_rate, expense_date, paid_by, receipt_url, notes } = body;

    // Recalculate amount_aud if relevant fields changed
    let amount_aud: number | undefined;
    if (amount !== undefined || currency !== undefined || exchange_rate !== undefined) {
      // Fetch current row to fill in any missing fields
      const { data: current } = await supabase
        .from('trip_expenses')
        .select('amount, currency, exchange_rate')
        .eq('id', expId)
        .single();

      const resolvedAmount = amount !== undefined ? Number(amount) : (current?.amount ?? 0);
      const resolvedCurrency = currency ?? current?.currency ?? 'AUD';
      const resolvedRate = exchange_rate !== undefined ? Number(exchange_rate) : (current?.exchange_rate ?? 1);

      amount_aud = resolvedCurrency === 'AUD' ? resolvedAmount : resolvedAmount * resolvedRate;
    }

    const { data, error } = await supabase
      .from('trip_expenses')
      .update({
        ...(category_id !== undefined && { category_id }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(currency !== undefined && { currency }),
        ...(exchange_rate !== undefined && { exchange_rate: Number(exchange_rate) }),
        ...(amount_aud !== undefined && { amount_aud }),
        ...(expense_date !== undefined && { expense_date }),
        ...(paid_by !== undefined && { paid_by }),
        ...(receipt_url !== undefined && { receipt_url }),
        ...(notes !== undefined && { notes }),
      })
      .eq('id', expId)
      .eq('trip_id', tripId)
      .select(`
        *,
        category:trip_budget_categories(id, name, color),
        payer:profiles!trip_expenses_paid_by_fkey(id, full_name, nickname)
      `)
      .single();

    if (error) throw error;

    return successResponse(data);
  } catch (err) {
    console.error('PUT budget/expenses/[expId] error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// DELETE /api/trips/[id]/budget/expenses/[expId]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, expId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { error } = await supabase
      .from('trip_expenses')
      .delete()
      .eq('id', expId)
      .eq('trip_id', tripId);

    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('DELETE budget/expenses/[expId] error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
