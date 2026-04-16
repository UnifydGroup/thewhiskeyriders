import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/budget/expenses
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data, error } = await supabase
      .from('trip_expenses')
      .select(`
        *,
        category:trip_budget_categories(id, name, color),
        payer:profiles!trip_expenses_paid_by_fkey(id, full_name, nickname)
      `)
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return successResponse(data ?? []);
  } catch (err) {
    console.error('GET budget/expenses error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// POST /api/trips/[id]/budget/expenses
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized, profile } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const {
      category_id,
      description,
      amount,
      currency = 'AUD',
      exchange_rate = 1.0,
      expense_date,
      paid_by,
      receipt_url,
      notes,
    } = body;

    if (!description || amount === undefined || !expense_date) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'description, amount, and expense_date are required', status: 400 });
    }

    // Calculate AUD amount
    const amount_aud = currency === 'AUD' ? Number(amount) : Number(amount) * Number(exchange_rate);

    const { data, error } = await supabase
      .from('trip_expenses')
      .insert({
        trip_id: tripId,
        category_id: category_id ?? null,
        description,
        amount: Number(amount),
        currency,
        amount_aud,
        exchange_rate: Number(exchange_rate),
        expense_date,
        paid_by: paid_by ?? null,
        receipt_url: receipt_url ?? null,
        notes: notes ?? null,
        created_by: profile?.id ?? null,
      })
      .select(`
        *,
        category:trip_budget_categories(id, name, color),
        payer:profiles!trip_expenses_paid_by_fkey(id, full_name, nickname)
      `)
      .single();

    if (error) throw error;

    return successResponse(data, 201);
  } catch (err) {
    console.error('POST budget/expenses error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
