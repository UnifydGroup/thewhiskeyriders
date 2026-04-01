'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, DollarSign, AlertCircle, Banknote } from 'lucide-react';

interface PaymentMilestone {
  id: string;
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
  description: string;
}

interface PaymentScheduleSectionProps {
  tripId: string;
  tripName?: string;
  showPaymentInfo?: boolean;
}

export default function PaymentScheduleSection({
  tripId,
  tripName,
  showPaymentInfo = true,
}: PaymentScheduleSectionProps) {
  const [schedule, setSchedule] = useState<PaymentMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/payments/schedule?trip_id=${tripId}`);
        if (!res.ok) throw new Error('Failed to fetch schedule');
        const data = await res.json();
        setSchedule(data.schedule || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [tripId]);

  if (loading) {
    return (
      <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-brand-tan/20 rounded w-1/4"></div>
          <div className="h-4 bg-brand-tan/20 rounded w-full"></div>
          <div className="h-4 bg-brand-tan/20 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-brand-dark-grey border border-red-500/40 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-300">
          <AlertCircle className="w-5 h-5" />
          <p>Error loading payment schedule: {error}</p>
        </div>
      </div>
    );
  }

  if (!schedule || schedule.length === 0) {
    return null;
  }

  const scheduleTargetAmount = schedule[schedule.length - 1]?.accumulated_amount || 5000;
  const isMorocco2027 = (tripName || '').toLowerCase().includes('morocco 2027');
  const flightsCost = isMorocco2027 ? 2500 : 0;
  const totalTripCost = scheduleTargetAmount + flightsCost;

  return (
    <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-tan/10 to-brand-tan/5 border-b border-brand-tan/30 p-6">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-6 h-6 text-brand-tan" />
          <h3 className="text-xl font-bold text-brand-cream">Payment Schedule</h3>
        </div>
        <p className="text-sm text-brand-cream/70">
          Total trip cost:{' '}
          <span className="font-semibold text-brand-tan">${totalTripCost.toFixed(2)}</span>
        </p>
        {flightsCost > 0 && (
          <p className="text-sm text-brand-cream/70 mt-1">
            Payment schedule target (member deposits):{' '}
            <span className="font-semibold text-brand-tan">${scheduleTargetAmount.toFixed(2)}</span>
            {' '}+ Flights:{' '}
            <span className="font-semibold text-brand-tan">${flightsCost.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Payment Options */}
        {showPaymentInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-brand-cream/10 to-brand-cream/5 rounded-lg p-4 border border-brand-cream/30 hover:border-brand-cream/50 transition-colors">
              <div className="flex items-start gap-3">
                <Banknote className="w-5 h-5 text-brand-cream mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-brand-cream">Monthly Option</p>
                  <p className="text-sm text-brand-tan mt-1 font-semibold">$250 per month</p>
                  <p className="text-xs text-brand-cream/60 mt-2">Initial $500 deposit, then 19 × $250</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-brand-tan/10 to-brand-tan/5 rounded-lg p-4 border border-brand-tan/30 hover:border-brand-tan/50 transition-colors">
              <div className="flex items-start gap-3">
                <Banknote className="w-5 h-5 text-brand-tan mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-brand-cream">Quarterly Option</p>
                  <p className="text-sm text-brand-tan mt-1 font-semibold">$750 per quarter</p>
                  <p className="text-xs text-brand-cream/60 mt-2">Initial $500 deposit, then 6 × $750</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-0">
          <h4 className="font-semibold text-brand-cream mb-4">Payment Milestones</h4>
          <div className="space-y-3">
            {schedule.map((milestone, index) => {
              const date = new Date(milestone.milestone_date);
              const isLastMilestone = index === schedule.length - 1;

              return (
                <div key={milestone.id} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 bg-brand-tan rounded-full border-4 border-brand-dark-grey shadow-lg shadow-brand-tan/30"></div>
                    {!isLastMilestone && (
                      <div className="w-1 h-12 bg-gradient-to-b from-brand-tan to-brand-tan/30 mt-2"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-4 flex-1">
                    <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-4 hover:border-brand-tan/40 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-brand-cream">
                            {date.toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-brand-cream/70 mt-1">
                            {milestone.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-brand-tan">
                            ${milestone.accumulated_amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-brand-cream/50 mt-1">Accumulated</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bank Details */}
        {showPaymentInfo && (
          <div className="bg-gradient-to-r from-brand-tan/10 to-brand-tan/5 rounded-lg p-4 border border-brand-tan/30 mt-6">
            <h4 className="font-semibold text-brand-cream mb-3">Bank Details</h4>
            <div className="text-sm text-brand-cream/80 space-y-2 font-mono">
              <p>
                <span className="font-semibold text-brand-tan">Account Name:</span> Andreas Gloor
              </p>
              <p>
                <span className="font-semibold text-brand-tan">BSB #:</span> 732 728
              </p>
              <p>
                <span className="font-semibold text-brand-tan">Account #:</span> 524337
              </p>
              <p>
                <span className="font-semibold text-brand-tan">PayID:</span> 0409 651 993
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
