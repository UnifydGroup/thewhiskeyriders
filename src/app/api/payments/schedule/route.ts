import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRole,
  errorResponse,
  ApiErrors,
  isUserTripMember,
  supabase,
} from '@/lib/api/helpers';

type PaymentMilestone = {
  id: string;
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
  description: string | null;
};

type MemberPaymentSummary = {
  member_id: string;
  full_name: string;
  nickname?: string | null;
  total_paid: number;
  payment_count: number;
  last_payment_date: string | null;
};

type PaymentSummaryRow = {
  member_id: string;
  amount: number;
  payment_date: string;
  profiles: {
    full_name: string | null;
    nickname: string | null;
  } | null;
};

type TripMemberRow = {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    nickname: string | null;
  } | null;
};

const DEFAULT_PAYMENT_SETTINGS = {
  flights_cost_aud: 0,
  show_payment_options: false,
  monthly_option_title: 'Monthly Option',
  monthly_option_amount_label: null,
  monthly_option_description: null,
  quarterly_option_title: 'Quarterly Option',
  quarterly_option_amount_label: null,
  quarterly_option_description: null,
  show_bank_details: false,
  bank_account_name: null,
  bank_bsb: null,
  bank_account_number: null,
  bank_payid: null,
  bank_notes: null,
};

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

    if (!tripId) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    if (profile.role === 'member') {
      const isMember = await isUserTripMember(profile.id, tripId);
      if (!isMember) {
        return errorResponse(ApiErrors.FORBIDDEN);
      }
    }

    const isAdmin = ['trip_admin', 'admin', 'super_admin'].includes(profile.role);

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

    const { data: paymentSettings } = await supabase
      .from('trip_payment_settings')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();

    const paymentSummaryMap = new Map<string, MemberPaymentSummary>();

    if (isAdmin) {
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
              nickname,
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

      const { data: tripMembers } = await supabase
        .from('trip_members')
        .select('user_id, profiles!user_id(id, full_name, nickname)')
        .eq('trip_id', tripId);

      const allMemberSummaries = Array.from(paymentSummaryMap.values());

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

      const typedMilestones = (milestones || []) as PaymentMilestone[];
      return NextResponse.json({
        schedule: typedMilestones,
        memberPaymentSummary: allMemberSummaries,
        totalTarget:
          typedMilestones.length > 0
            ? typedMilestones[typedMilestones.length - 1].accumulated_amount
            : 0,
        paymentSettings: paymentSettings
          ? {
              ...DEFAULT_PAYMENT_SETTINGS,
              ...paymentSettings,
            }
          : DEFAULT_PAYMENT_SETTINGS,
      });
    }

    const typedMilestones = (milestones || []) as PaymentMilestone[];

    return NextResponse.json({
      schedule: typedMilestones,
      memberPaymentSummary: [],
      totalTarget:
        typedMilestones.length > 0
          ? typedMilestones[typedMilestones.length - 1].accumulated_amount
          : 0,
      paymentSettings: paymentSettings
        ? {
            ...DEFAULT_PAYMENT_SETTINGS,
            ...paymentSettings,
          }
        : DEFAULT_PAYMENT_SETTINGS,
    });
  } catch (error) {
    console.error('Payment schedule API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
