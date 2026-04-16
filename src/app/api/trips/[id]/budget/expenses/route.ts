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
      amount_aud,
      amount_aud_overridden,
      expense_date,
      paid_by,
      paid_by_type,
      paid_by_label,
      source,
      reconciled,
      receipt_url,
      notes,
    } = body;

    if (!description || amount === undefined || !expense_date) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'description, amount, and expense_date are required', status: 400 });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'amount must be a positive number', status: 400 });
    }

    const normalizedCurrency = String(currency || 'AUD').toUpperCase();
    const parsedRate = normalizedCurrency === 'AUD' ? 1 : Number(exchange_rate);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'exchange_rate must be a positive number', status: 400 });
    }

    const hasAudOverride = amount_aud !== undefined && amount_aud !== null && String(amount_aud).trim() !== '';
    const computedAud = normalizedCurrency === 'AUD' ? parsedAmount : parsedAmount * parsedRate;
    const parsedAmountAud = hasAudOverride ? Number(amount_aud) : computedAud;
    if (!Number.isFinite(parsedAmountAud) || parsedAmountAud <= 0) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'amount_aud must be a positive number', status: 400 });
    }

    const normalizedPaidByType = paid_by_type === 'member' || paid_by_type === 'external'
      ? paid_by_type
      : 'group_kitty';

    if (normalizedPaidByType === 'member' && !paid_by) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'paid_by member is required when paid_by_type is member', status: 400 });
    }

    const normalizedPaidBy = normalizedPaidByType === 'member' ? (paid_by ?? null) : null;
    const normalizedPaidByLabel = normalizedPaidByType === 'external' ? (paid_by_label ?? null) : null;

    const normalizedSource = source === 'import' ? 'import' : 'manual';
    const normalizedReconciled = normalizedSource === 'import' ? true : reconciled === true;

    const { data, error } = await supabase
      .from('trip_expenses')
      .insert({
        trip_id: tripId,
        category_id: category_id ?? null,
        description,
        amount: parsedAmount,
        currency: normalizedCurrency,
        amount_aud: parsedAmountAud,
        amount_aud_overridden: hasAudOverride ? amount_aud_overridden === true : false,
        exchange_rate: parsedRate,
        expense_date,
        paid_by: normalizedPaidBy,
        paid_by_type: normalizedPaidByType,
        paid_by_label: normalizedPaidByLabel,
        source: normalizedSource,
        reconciled: normalizedReconciled,
        reconciled_at: normalizedReconciled ? new Date().toISOString() : null,
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
