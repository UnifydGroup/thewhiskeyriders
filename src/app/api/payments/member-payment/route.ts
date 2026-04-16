import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  ApiErrors,
  isUserTripMember,
  supabase,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { member_id, trip_id, payment_date, amount, payment_method, notes } = body;

    if (!member_id || !trip_id || !payment_date || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Missing required fields: member_id, trip_id, payment_date, amount' },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', trip_id)
      .eq('user_id', member_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: 'Selected member is not on this trip' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('member_payments')
      .insert([
        {
          member_id,
          trip_id,
          payment_date,
          amount: parsedAmount,
          payment_method: payment_method || null,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error recording payment:', error);
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Member payment POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { authenticated, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);

    if (!authenticated || !profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('trip_id');
    const memberId = searchParams.get('member_id');

    if (!tripId) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    const isAdmin = ['trip_admin', 'admin', 'super_admin'].includes(profile.role);

    if (!isAdmin) {
      const isMember = await isUserTripMember(profile.id, tripId);
      if (!isMember) {
        return errorResponse(ApiErrors.FORBIDDEN);
      }
    }

    let query = supabase
      .from('member_payments')
      .select(`
        id,
        member_id,
        trip_id,
        payment_date,
        amount,
        payment_method,
        notes,
        created_at,
        updated_at
      `)
      .eq('trip_id', tripId);

    if (isAdmin) {
      if (memberId) {
        query = query.eq('member_id', memberId);
      }
    } else {
      if (memberId && memberId !== profile.id) {
        return errorResponse(ApiErrors.FORBIDDEN);
      }

      query = query.eq('member_id', profile.id);
    }

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payments: data || [],
    });
  } catch (error) {
    console.error('Get payments API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
