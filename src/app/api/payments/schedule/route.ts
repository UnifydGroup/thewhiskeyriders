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

interface PaymentMilestone {
  id: string;
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
  description: string;
}

interface MemberPaymentSummary {
  member_id: string;
  full_name: string;
  nickname?: string | null;
  total_paid: number;
  payment_count: number;
  last_payment_date: string | null;
}

export async function GET(request: NextRequest) {
  try {
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

    // Fetch member payment summary
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

    // Aggregate member payment data
    const paymentSummaryMap = new Map<string, MemberPaymentSummary>();

    if (memberPayments) {
      for (const payment of memberPayments) {
        const memberId = payment.member_id;
        const fullName = (payment.profiles as any)?.full_name || 'Unknown';
        const nickname = (payment.profiles as any)?.nickname;

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

    // Add members with no payments
    const allMemberSummaries = Array.from(paymentSummaryMap.values());
    if (tripMembers) {
      for (const tripMember of tripMembers) {
        const userId = tripMember.user_id;
        if (!paymentSummaryMap.has(userId)) {
          allMemberSummaries.push({
            member_id: userId,
            full_name: (tripMember.profiles as any)?.full_name || 'Unknown',
            nickname: (tripMember.profiles as any)?.nickname,
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
  } catch (error) {
    console.error('Payment schedule API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
