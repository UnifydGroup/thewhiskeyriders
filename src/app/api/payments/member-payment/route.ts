'use server';

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
let _supabaseInstance: ReturnType<typeof createClient> | null = null;
function _getSupabase() {
  if (!_supabaseInstance) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    _supabaseInstance = createClient(_supabaseUrl, key);
  }
  return _supabaseInstance;
}
const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (_t, prop) => (_getSupabase() as any)[prop],
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { member_id, trip_id, payment_date, amount, payment_method, notes } = body;

    if (!member_id || !trip_id || !payment_date || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: member_id, trip_id, payment_date, amount' },
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
          amount: parseFloat(amount),
          payment_method: payment_method || null,
          notes: notes || null,
        },
      ])
      .select();

    if (error) {
      console.error('Error recording payment:', error);
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data[0],
    });
  } catch (error) {
    console.error('Member payment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('trip_id');
    const memberId = searchParams.get('member_id');

    if (!tripId) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
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
        profiles!member_id(id, full_name, email)
      `)
      .eq('trip_id', tripId);

    if (memberId) {
      query = query.eq('member_id', memberId);
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
