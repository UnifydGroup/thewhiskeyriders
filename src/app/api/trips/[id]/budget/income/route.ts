import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/budget/income — all income entries + member payments
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    // Manual income entries
    const { data: entries, error: entriesErr } = await supabase
      .from('trip_income_entries')
      .select('*, member:profiles!trip_income_entries_member_id_fkey(id, full_name, nickname)')
      .eq('trip_id', tripId)
      .order('income_date', { ascending: false });

    if (entriesErr) throw entriesErr;

    // Member payments from the payment tracker (the existing member_payments table)
    const { data: payments, error: paymentsErr } = await supabase
      .from('member_payments')
      .select('id, member_id, trip_id, payment_date, amount, payment_method, notes, profiles:member_id(full_name, nickname)')
      .eq('trip_id', tripId)
      .order('payment_date', { ascending: false });

    if (paymentsErr) throw paymentsErr;

    return successResponse({
      income_entries: entries ?? [],
      member_payments: payments ?? [],
    });
  } catch (err) {
    console.error('GET budget/income error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// POST /api/trips/[id]/budget/income — create a manual income entry
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized, profile } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const { description, amount_aud, income_date, category, member_id, notes } = body;

    if (!description || amount_aud === undefined || !income_date) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'description, amount_aud and income_date are required', status: 400 });
    }

    const { data, error } = await supabase
      .from('trip_income_entries')
      .insert({
        trip_id: tripId,
        description,
        amount_aud: Number(amount_aud),
        income_date,
        category: category ?? 'other',
        member_id: member_id ?? null,
        notes: notes ?? null,
        source: 'manual',
        reconciled: false,
        created_by: profile?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return successResponse(data, 201);
  } catch (err) {
    console.error('POST budget/income error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// DELETE /api/trips/[id]/budget/income?entryId=xxx — delete a manual income entry
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const entryId = new URL(request.url).searchParams.get('entryId');
    if (!entryId) return errorResponse({ code: 'VALIDATION_ERROR', message: 'entryId required', status: 400 });

    const { error } = await supabase
      .from('trip_income_entries')
      .delete()
      .eq('id', entryId)
      .eq('trip_id', tripId);

    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('DELETE budget/income error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// PUT /api/trips/[id]/budget/income?entryId=xxx — update a manual income entry
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const entryId = new URL(request.url).searchParams.get('entryId');
    if (!entryId) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'entryId required', status: 400 });
    }

    const body = await getJsonBody(request);
    const updateData: Record<string, unknown> = {};

    if (body.description !== undefined) updateData.description = body.description;
    if (body.amount_aud !== undefined) updateData.amount_aud = Number(body.amount_aud);
    if (body.income_date !== undefined) updateData.income_date = body.income_date;
    if (body.category !== undefined) updateData.category = body.category ?? 'other';
    if (body.member_id !== undefined) updateData.member_id = body.member_id || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.reconciled !== undefined) {
      const reconciled = body.reconciled === true;
      updateData.reconciled = reconciled;
      updateData.reconciled_at = reconciled ? new Date().toISOString() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'No update fields provided', status: 400 });
    }

    const { data, error } = await supabase
      .from('trip_income_entries')
      .update(updateData)
      .eq('id', entryId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(data);
  } catch (err) {
    console.error('PUT budget/income error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
