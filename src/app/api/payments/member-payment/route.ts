'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { SupabaseDatabase } from '@/lib/types/database.generated';

type DbClient = ReturnType<typeof createSupabaseClient<SupabaseDatabase>>;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
let serviceRoleSupabase: DbClient | null = null;

function getServiceRoleClient(): DbClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  if (!serviceRoleSupabase) {
    serviceRoleSupabase = createSupabaseClient<SupabaseDatabase>(supabaseUrl, key);
  }

  return serviceRoleSupabase;
}

async function getSupabaseForRequest(): Promise<{
  supabase: DbClient;
  usingServiceRole: boolean;
  currentUserId: string | null;
}> {
  const serviceRoleClient = getServiceRoleClient();
  if (serviceRoleClient) {
    return { supabase: serviceRoleClient, usingServiceRole: true, currentUserId: null };
  }

  const sessionClient = await createServerClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }

  return {
    supabase: sessionClient as unknown as DbClient,
    usingServiceRole: false,
    currentUserId: user.id,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await getSupabaseForRequest();
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
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Member payment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, usingServiceRole, currentUserId } = await getSupabaseForRequest();
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
        created_at
      `)
      .eq('trip_id', tripId);

    if (usingServiceRole) {
      if (memberId) {
        query = query.eq('member_id', memberId);
      }
    } else {
      if (!currentUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (memberId && memberId !== currentUserId) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      query = query.eq('member_id', currentUserId);
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
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get payments API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
