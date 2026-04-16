import { NextRequest, NextResponse } from 'next/server';
import { verifyRole, errorResponse, ApiErrors, supabase } from '@/lib/api/helpers';

type Params = Promise<{ paymentId: string }>;

async function getPayment(paymentId: string) {
  const { data, error } = await supabase
    .from('member_payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function PUT(request: NextRequest, props: { params: Params }) {
  try {
    const { authenticated, authorized } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const params = await props.params;
    const paymentId = params.paymentId;

    const existing = await getPayment(paymentId);
    if (!existing) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Payment not found');
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.member_id !== undefined) {
      const { data: membership } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', existing.trip_id)
        .eq('user_id', body.member_id)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: 'Selected member is not on this trip' },
          { status: 400 }
        );
      }

      updateData.member_id = body.member_id;
    }

    if (body.payment_date !== undefined) {
      updateData.payment_date = body.payment_date;
    }

    if (body.amount !== undefined) {
      const parsedAmount = Number(body.amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: 'amount must be a positive number' },
          { status: 400 }
        );
      }
      updateData.amount = parsedAmount;
    }

    if (body.payment_method !== undefined) {
      updateData.payment_method = body.payment_method || null;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No update fields provided' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('member_payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating member payment:', error);
      return NextResponse.json(
        { error: 'Failed to update payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update member payment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Params }) {
  try {
    const { authenticated, authorized } = await verifyRole(request, [
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const params = await props.params;
    const paymentId = params.paymentId;
    const tripId = request.nextUrl.searchParams.get('trip_id');

    const existing = await getPayment(paymentId);
    if (!existing) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Payment not found');
    }

    if (tripId && existing.trip_id !== tripId) {
      return NextResponse.json(
        { error: 'payment does not belong to the provided trip_id' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('member_payments')
      .delete()
      .eq('id', paymentId);

    if (error) {
      console.error('Error deleting member payment:', error);
      return NextResponse.json(
        { error: 'Failed to delete payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete member payment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
