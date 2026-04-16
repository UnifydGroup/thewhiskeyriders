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
}> {
  const serviceRoleClient = getServiceRoleClient();
  if (serviceRoleClient) {
    return { supabase: serviceRoleClient, usingServiceRole: true };
  }

  const sessionClient = await createServerClient();
  const {
    data: { user },
    error,
  } = await sessionClient.auth.getUser();

  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }

  return { supabase: sessionClient as unknown as DbClient, usingServiceRole: false };
}

interface PaymentMilestone {
  id: string;
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
  description: string | null;
}

interface MemberPaymentSummary {
  member_id: string;
  full_name: string;
  nickname?: string | null;
  total_paid: number;
  payment_count: number;
  last_payment_date: string | null;
}

interface PaymentSummaryRow {
  member_id: string;
  amount: number;
  payment_date: string;
  profiles: {
    full_name: string | null;
    nickname: string | null;
  } | null;
}

interface TripMemberRow {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    nickname: string | null;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, usingServiceRole } = await getSupabaseForRequest();
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('trip_id');

    if (!tripId) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    // Fetch payment schedule milestones
    const { data: milestones, error: milestonesError } = await supabase
      .from('payment_schedule_milestones')
      .select('*')
      .eq('trip_id', tripId)
      .order('milestone_date', { ascending: true });

    if (milestonesError) {
      console.error('Error fetching milestones:', milestonesError);
      return NextResponse.json(
        { error: 'Failed to fetch payment schedule' },
        { status: 500 }
      );
    }

    const paymentSummaryMap = new Map<string, MemberPaymentSummary>();

    // Member portal only needs schedule; payment summaries are for admin management.
    // Skip this extra aggregation when no service role key is configured.
    if (usingServiceRole) {
      const { data: memberPayments, error: paymentsError } = await supabase
        .from('member_payments')
        .select(`
          member_id,
          profiles!member_id(full_name, nickname),
          amount,
          payment_date
        `)
        .eq('trip_id', tripId)
        .order('payment_date', { ascending: false });

      if (paymentsError) {
        console.error('Error fetching member payments:', paymentsError);
        return NextResponse.json(
          { error: 'Failed to fetch member payments' },
          { status: 500 }
        );
      }

      if (memberPayments) {
        for (const payment of memberPayments as PaymentSummaryRow[]) {
          const memberId = payment.member_id;
          const fullName = payment.profiles?.full_name || 'Unknown';
          const nickname = payment.profiles?.nickname;

          if (!paymentSummaryMap.has(memberId)) {
            paymentSummaryMap.set(memberId, {
              member_id: memberId,
              full_name: fullName,
              nickname: nickname,
              total_paid: 0,
              payment_count: 0,
              last_payment_date: null,
            });
          }

          const summary = paymentSummaryMap.get(memberId)!;
          summary.total_paid += Number(payment.amount);
          summary.payment_count += 1;
          if (!summary.last_payment_date) {
            summary.last_payment_date = payment.payment_date;
          }
        }
      }

      // Fetch all trip members to show who hasn't paid
      const { data: tripMembers, error: membersError } = await supabase
        .from('trip_members')
        .select('user_id, profiles!user_id(id, full_name, nickname)')
        .eq('trip_id', tripId);

      if (membersError) {
        console.error('Error fetching trip members:', membersError);
      }

      const allMemberSummaries = Array.from(paymentSummaryMap.values());

      // Add members with no payments
      if (tripMembers) {
        for (const tripMember of tripMembers as TripMemberRow[]) {
          const userId = tripMember.user_id;
          if (!paymentSummaryMap.has(userId)) {
            allMemberSummaries.push({
              member_id: userId,
              full_name: tripMember.profiles?.full_name || 'Unknown',
              nickname: tripMember.profiles?.nickname,
              total_paid: 0,
              payment_count: 0,
              last_payment_date: null,
            });
          }
        }
      }

      return NextResponse.json({
        schedule: milestones as PaymentMilestone[],
        memberPaymentSummary: allMemberSummaries,
        totalTarget: milestones && milestones.length > 0
          ? milestones[milestones.length - 1].accumulated_amount
          : 5000,
      });
    }

    return NextResponse.json({
      schedule: milestones as PaymentMilestone[],
      memberPaymentSummary: [],
      totalTarget: milestones && milestones.length > 0
        ? milestones[milestones.length - 1].accumulated_amount
        : 5000,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Payment schedule API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
