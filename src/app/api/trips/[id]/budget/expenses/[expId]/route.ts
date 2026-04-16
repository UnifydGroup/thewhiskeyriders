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
    const {
      category_id,
      description,
      amount,
      currency,
      exchange_rate,
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

    const { data: current, error: currentError } = await supabase
      .from('trip_expenses')
      .select(`
        amount,
        currency,
        exchange_rate,
        amount_aud_overridden,
        paid_by,
        paid_by_type,
        paid_by_label,
        source,
        reconciled
      `)
      .eq('id', expId)
      .eq('trip_id', tripId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) return errorResponse(ApiErrors.NOT_FOUND, 'Expense not found');

    const updateData: Record<string, unknown> = {};

    if (category_id !== undefined) updateData.category_id = category_id;
    if (description !== undefined) updateData.description = description;
    if (expense_date !== undefined) updateData.expense_date = expense_date;
    if (receipt_url !== undefined) updateData.receipt_url = receipt_url;
    if (notes !== undefined) updateData.notes = notes;

    const amountChanged = amount !== undefined;
    const currencyChanged = currency !== undefined;
    const exchangeRateChanged = exchange_rate !== undefined;
    const amountAudProvided = amount_aud !== undefined && amount_aud !== null && String(amount_aud).trim() !== '';
    const shouldRecomputeAud = amountAudProvided || amountChanged || currencyChanged || exchangeRateChanged;

    if (amountChanged) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return errorResponse({ code: 'VALIDATION_ERROR', message: 'amount must be a positive number', status: 400 });
      }
      updateData.amount = parsedAmount;
    }

    const resolvedAmount = amountChanged ? Number(amount) : Number(current.amount ?? 0);
    const resolvedCurrency = String(currencyChanged ? currency : current.currency ?? 'AUD').toUpperCase();
    const resolvedRate = resolvedCurrency === 'AUD'
      ? 1
      : Number(exchangeRateChanged ? exchange_rate : current.exchange_rate ?? 1);

    if (currencyChanged) {
      updateData.currency = resolvedCurrency;
    }

    if (exchangeRateChanged || currencyChanged) {
      if (!Number.isFinite(resolvedRate) || resolvedRate <= 0) {
        return errorResponse({ code: 'VALIDATION_ERROR', message: 'exchange_rate must be a positive number', status: 400 });
      }
      updateData.exchange_rate = resolvedRate;
    }

    if (shouldRecomputeAud) {
      const computedAud = resolvedCurrency === 'AUD' ? resolvedAmount : resolvedAmount * resolvedRate;
      const parsedAmountAud = amountAudProvided ? Number(amount_aud) : computedAud;
      if (!Number.isFinite(parsedAmountAud) || parsedAmountAud <= 0) {
        return errorResponse({ code: 'VALIDATION_ERROR', message: 'amount_aud must be a positive number', status: 400 });
      }
      updateData.amount_aud = parsedAmountAud;
      if (amount_aud_overridden !== undefined) {
        updateData.amount_aud_overridden = amount_aud_overridden === true;
      } else if (amountAudProvided) {
        updateData.amount_aud_overridden = true;
      } else {
        updateData.amount_aud_overridden = false;
      }
    } else if (amount_aud_overridden !== undefined) {
      updateData.amount_aud_overridden = amount_aud_overridden === true;
    }

    const normalizedPaidByType = paid_by_type !== undefined
      ? (paid_by_type === 'member' || paid_by_type === 'external' ? paid_by_type : 'group_kitty')
      : current.paid_by_type;

    if (paid_by_type !== undefined) {
      updateData.paid_by_type = normalizedPaidByType;
    }

    const resolvedPaidBy = normalizedPaidByType === 'member'
      ? (paid_by !== undefined ? paid_by : current.paid_by)
      : null;
    const resolvedPaidByLabel = normalizedPaidByType === 'external'
      ? (paid_by_label !== undefined ? paid_by_label : current.paid_by_label)
      : null;

    if (normalizedPaidByType === 'member' && !resolvedPaidBy) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'paid_by member is required when paid_by_type is member', status: 400 });
    }

    if (paid_by !== undefined || paid_by_type !== undefined) {
      updateData.paid_by = resolvedPaidBy;
    }
    if (paid_by_label !== undefined || paid_by_type !== undefined) {
      updateData.paid_by_label = resolvedPaidByLabel;
    }

    const normalizedSource = source !== undefined ? (source === 'import' ? 'import' : 'manual') : current.source;
    if (source !== undefined) {
      updateData.source = normalizedSource;
    }

    const normalizedReconciled = normalizedSource === 'import'
      ? true
      : (reconciled !== undefined ? reconciled === true : current.reconciled === true);

    if (source !== undefined || reconciled !== undefined) {
      updateData.reconciled = normalizedReconciled;
      updateData.reconciled_at = normalizedReconciled ? new Date().toISOString() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'No update fields provided', status: 400 });
    }

    const { data, error } = await supabase
      .from('trip_expenses')
      .update(updateData)
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
