import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  getPagination,
  logActivity,
  getIpAddress,
  supabase,
} from '@/lib/api/helpers';

// GET /api/trips/[id]/payments - List all payments for a trip
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated, authorized, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { limit, offset } = getPagination(request);
    const status = request.nextUrl.searchParams.get('status');
    const userId = request.nextUrl.searchParams.get('user_id');

    let query = supabase
      .from('payments')
      .select(
        `
        *,
        users:user_id (id, email, nickname, full_name, avatar_url)
      `,
        { count: 'exact' }
      )
      .eq('trip_id', tripId);

    if (status) {
      query = query.eq('status', status);
    }

    if (userId) {
      if (profile?.id !== userId && profile?.role === 'member') {
        // Members can only see their own payments
        if (profile.id !== userId) {
          return errorResponse(ApiErrors.FORBIDDEN);
        }
      }
      query = query.eq('user_id', userId);
    }

    const { data: payments, count, error } = await query
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Calculate totals
    const totalAmount = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const paidAmount = (payments || [])
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingAmount = (payments || [])
      .filter((p) => ['pending', 'overdue'].includes(p.status))
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return successResponse({
      payments,
      totals: {
        total: totalAmount,
        paid: paidAmount,
        pending: pendingAmount,
        count: count || 0,
      },
      pagination: { limit, offset },
    });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// POST /api/trips/[id]/payments - Create payment record (admin only)
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tripId = params.id;

    const { authenticated, authorized, user } = await verifyRole(request, [
      'admin',
      'super_admin',
    ]);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await getJsonBody(request);

    if (!body.user_id || body.amount === undefined || !body.description) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'Missing required fields');
    }

    const paymentData = {
      trip_id: tripId,
      user_id: body.user_id,
      description: body.description,
      amount: body.amount,
      due_date: body.due_date || null,
      paid_date: body.paid_date || null,
      status: body.status || 'pending',
      notes: body.notes || null,
    };

    const { data: payment, error } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user!.id,
      'create',
      'payment',
      payment.id,
      body.description,
      { amount: body.amount, user_id: body.user_id },
      getIpAddress(request)
    );

    return successResponse(payment, 201);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
