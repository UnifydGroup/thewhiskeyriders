import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, supabase } from '@/lib/api/helpers';
import { deleteReceiptStorageObject } from '@/lib/api/receiptStorage';

type Params = { params: Promise<{ id: string; expId: string; receiptId: string }> };

// DELETE /api/trips/[id]/budget/expenses/[expId]/receipts/[receiptId]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, expId, receiptId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data: receipt, error: fetchError } = await supabase
      .from('trip_expense_receipts')
      .select('id, file_url')
      .eq('id', receiptId)
      .eq('expense_id', expId)
      .eq('trip_id', tripId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!receipt) return errorResponse(ApiErrors.NOT_FOUND, 'Receipt not found');

    const { error } = await supabase
      .from('trip_expense_receipts')
      .delete()
      .eq('id', receiptId)
      .eq('expense_id', expId)
      .eq('trip_id', tripId);

    if (error) throw error;

    await deleteReceiptStorageObject(receipt.file_url).catch(() => {});

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('DELETE expense receipt error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
