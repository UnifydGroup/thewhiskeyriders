import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  logActivity,
  getIpAddress,
  supabase,
  getCurrentUser,
  getUserProfile,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string; paymentId: string }>;

// PUT /api/trips/[id]/payments/[paymentId] - Update payment
export async function PUT(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const { id: tripId, paymentId } = params;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile || profile.role === 'member') {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('trip_id', tripId)
      .single();

    if (!payment) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Payment not found');
    }

    const body = await getJsonBody(request);

    const updateData: Record<string, any> = {};

    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.paid_date !== undefined) updateData.paid_date = body.paid_date;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data: updated, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'update',
      'payment',
      paymentId,
      payment.description,
      updateData,
      getIpAddress(request)
    );

    return successResponse(updated);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// DELETE /api/trips/[id]/payments/[paymentId] - Delete payment
export async function DELETE(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const { id: tripId, paymentId } = params;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile || profile.role === 'member') {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('trip_id', tripId)
      .single();

    if (!payment) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Payment not found');
    }

    const { error } = await supabase.from('payments').delete().eq('id', paymentId);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'delete',
      'payment',
      paymentId,
      payment.description,
      null,
      getIpAddress(request)
    );

    return successResponse({ message: 'Payment deleted successfully' });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
