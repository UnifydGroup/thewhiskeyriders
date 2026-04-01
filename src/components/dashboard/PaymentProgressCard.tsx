'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, DollarSign, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

interface PaymentMilestone {
  id: string;
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
  description: string;
}

interface MemberPayment {
  id: string;
  member_id: string;
  trip_id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  notes?: string;
  created_at: string;
}

interface PaymentProgressCardProps {
  tripId: string;
  memberId: string;
  tripName: string;
}

export default function PaymentProgressCard({
  tripId,
  memberId,
  tripName,
}: PaymentProgressCardProps) {
  const [schedule, setSchedule] = useState<PaymentMilestone[]>([]);
  const [memberPayments, setMemberPayments] = useState<MemberPayment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        setLoading(true);

        // Fetch schedule
        const scheduleRes = await fetch(`/api/payments/schedule?trip_id=${tripId}`);
        if (!scheduleRes.ok) throw new Error('Failed to fetch schedule');
        const scheduleData = await scheduleRes.json();
        setSchedule(scheduleData.schedule || []);

        // Fetch member payments
        const paymentsRes = await fetch(
          `/api/payments/member-payment?trip_id=${tripId}&member_id=${memberId}`
        );
        if (!paymentsRes.ok) throw new Error('Failed to fetch payments');
        const paymentsData = await paymentsRes.json();
        const payments = paymentsData.payments || [];
        setMemberPayments(payments);

        // Calculate total paid
        const total = payments.reduce(
          (sum: number, p: MemberPayment) => sum + p.amount,
          0
        );
        setTotalPaid(total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentData();
  }, [tripId, memberId]);

  if (loading) {
    return (
      <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-brand-tan/20 rounded w-1/4"></div>
          <div className="h-8 bg-brand-tan/20 rounded w-1/3"></div>
          <div className="h-4 bg-brand-tan/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-brand-dark-grey border border-red-500/40 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-300">
          <AlertCircle className="w-5 h-5" />
          <p>Error loading payment information: {error}</p>
        </div>
      </div>
    );
  }

  const targetAmount = schedule.length > 0 ? schedule[schedule.length - 1].accumulated_amount : 5000;
  const progressPercentage = (totalPaid / targetAmount) * 100;
  const nextMilestone = schedule.find((m) => m.accumulated_amount > totalPaid);

  return (
    <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-brand-tan" />
          <h3 className="text-lg font-semibold text-brand-cream">Payment Progress</h3>
        </div>
        <p className="text-sm text-brand-cream/60">{tripName}</p>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-brand-tan/10 to-brand-tan/5 border border-brand-tan/30 rounded-lg p-4">
          <p className="text-xs font-semibold text-brand-tan uppercase tracking-wide">Total Paid</p>
          <p className="text-3xl font-bold text-brand-cream mt-2">${totalPaid.toFixed(2)}</p>
          <p className="text-xs text-brand-cream/60 mt-2">of ${targetAmount.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-brand-cream/10 to-brand-cream/5 border border-brand-cream/20 rounded-lg p-4">
          <p className="text-xs font-semibold text-brand-cream/80 uppercase tracking-wide">Remaining</p>
          <p className="text-3xl font-bold text-brand-cream mt-2">
            ${(targetAmount - totalPaid).toFixed(2)}
          </p>
          <p className="text-xs text-brand-cream/60 mt-2">
            {Math.round(progressPercentage)}% complete
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-brand-cream/70 uppercase">Progress</p>
          <p className="text-sm font-bold text-brand-tan">{Math.round(progressPercentage)}%</p>
        </div>
        <div className="h-4 bg-brand-dark-grey-grey border border-brand-tan/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-tan via-brand-tan to-brand-tan rounded-full transition-all duration-700 shadow-lg shadow-brand-tan/20"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Next Milestone */}
      {nextMilestone && (
        <div className="bg-gradient-to-r from-brand-cream/10 to-brand-cream/5 border border-brand-cream/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-brand-tan flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-brand-cream">Next Milestone</p>
              <p className="text-sm text-brand-cream/70 mt-1">
                {new Date(nextMilestone.milestone_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-brand-tan font-semibold mt-2">
                ${nextMilestone.accumulated_amount.toFixed(2)} required
              </p>
            </div>
          </div>
        </div>
      )}

      {totalPaid >= targetAmount && (
        <div className="bg-gradient-to-r from-brand-tan/20 to-brand-tan/10 border border-brand-tan/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-brand-tan font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            <span>Payment Complete! 🎉</span>
          </div>
        </div>
      )}

      {/* Payment Schedule */}
      <div className="space-y-3 pt-4 border-t border-brand-tan/20">
        <h4 className="font-semibold text-brand-cream">Payment Schedule</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {schedule.map((milestone, index) => {
            const isPaid = totalPaid >= milestone.accumulated_amount;
            return (
              <div
                key={milestone.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isPaid
                    ? 'bg-brand-tan/20 border-brand-tan/40'
                    : 'bg-brand-dark-grey-grey border-brand-tan/10 hover:border-brand-tan/20'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {isPaid ? (
                    <CheckCircle2 className="w-4 h-4 text-brand-tan flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-brand-tan/30 rounded-full flex-shrink-0"></div>
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      isPaid ? 'text-brand-tan' : 'text-brand-cream'
                    }`}>
                      {new Date(milestone.milestone_date).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className={`text-xs ${
                      isPaid ? 'text-brand-tan/80' : 'text-brand-cream/60'
                    }`}>
                      {milestone.description}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-semibold ${
                  isPaid ? 'text-brand-tan' : 'text-brand-cream'
                }`}>
                  ${milestone.accumulated_amount.toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Payments */}
      {memberPayments.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-brand-tan/20">
          <h4 className="font-semibold text-brand-cream">Recent Payments</h4>
          <div className="space-y-2">
            {memberPayments.slice(0, 3).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-brand-dark-grey-grey border border-brand-tan/10 rounded-lg hover:border-brand-tan/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-brand-cream">
                    {new Date(payment.payment_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  {payment.payment_method && (
                    <p className="text-xs text-brand-cream/50">{payment.payment_method}</p>
                  )}
                </div>
                <p className="font-semibold text-brand-tan">${payment.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
