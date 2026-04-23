'use client';

import { useEffect, useState } from 'react';
import {
  Calendar, CheckCircle2, AlertCircle, TrendingUp,
  Clock, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PaymentMilestone {
  id: string;
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
  description: string | null;
}

interface MemberPayment {
  id: string;
  member_id: string;
  trip_id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  notes?: string | null;
  created_at: string;
}

interface PaymentProgressCardProps {
  tripId: string;
  memberId: string;
  tripName: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD date string as local noon to avoid timezone-off-by-one in AU */
function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes('T') || dateStr.includes('Z')) return new Date(dateStr);
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function fmtDateAU(dateStr: string, opts: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-AU', opts);
}

function fmtAUD(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function daysUntil(dateStr: string): number {
  const target = parseLocalDate(dateStr);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

/** Parse JSON-encoded notes to get the human-readable text */
function parseNoteText(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { text?: string };
    if (parsed && typeof parsed.text === 'string') return parsed.text;
  } catch { /* plain text */ }
  return raw;
}

function paymentMethodLabel(method: string | undefined): string {
  if (!method) return '';
  return method.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PaymentProgressCard({
  tripId,
  memberId,
  tripName,
}: PaymentProgressCardProps) {
  const [schedule, setSchedule] = useState<PaymentMilestone[]>([]);
  const [memberPayments, setMemberPayments] = useState<MemberPayment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [targetAmount, setTargetAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        setLoading(true);

        const [scheduleRes, paymentsRes] = await Promise.all([
          fetch(`/api/payments/schedule?trip_id=${tripId}`),
          fetch(`/api/payments/member-payment?trip_id=${tripId}&member_id=${memberId}`),
        ]);

        if (!scheduleRes.ok) throw new Error('Failed to fetch schedule');
        if (!paymentsRes.ok) throw new Error('Failed to fetch payments');

        const scheduleData = await scheduleRes.json();
        const paymentsData = await paymentsRes.json();

        const sched: PaymentMilestone[] = scheduleData.schedule || [];
        const payments: MemberPayment[] = paymentsData.payments || [];

        setSchedule(sched);
        setTargetAmount(Number(scheduleData.totalTarget || 0));
        setMemberPayments(payments);
        setTotalPaid(payments.reduce((sum, p) => sum + Number(p.amount), 0));
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
      <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-brand-tan/20 rounded w-1/3"></div>
          <div className="h-10 bg-brand-tan/20 rounded w-1/2"></div>
          <div className="h-3 bg-brand-tan/20 rounded w-full"></div>
          <div className="h-3 bg-brand-tan/20 rounded w-4/5"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-brand-dark-grey border border-red-500/40 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-300">
          <AlertCircle className="w-5 h-5" />
          <p>Error loading payment information: {error}</p>
        </div>
      </div>
    );
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const progressPct = targetAmount > 0 ? Math.min(100, (totalPaid / targetAmount) * 100) : 0;
  const isComplete = totalPaid >= targetAmount && targetAmount > 0;

  // What should have been paid by now (based on passed milestone dates)
  const passedMilestones = schedule.filter((m) => parseLocalDate(m.milestone_date) <= today);
  const expectedByNow = passedMilestones.length > 0
    ? passedMilestones[passedMilestones.length - 1].accumulated_amount
    : 0;
  const overdue = Math.max(0, expectedByNow - totalPaid);
  const isOnTrack = totalPaid >= expectedByNow;
  const isBehind = !isComplete && overdue > 0;

  // Next upcoming milestone
  const nextMilestone = schedule.find((m) => parseLocalDate(m.milestone_date) > today && m.accumulated_amount > totalPaid);
  const nextDays = nextMilestone ? daysUntil(nextMilestone.milestone_date) : null;
  const amountNeeded = nextMilestone ? Math.max(0, nextMilestone.accumulated_amount - totalPaid) : 0;

  // Payments sorted newest-first for display, oldest-first for running total
  const paymentsSortedDesc = [...memberPayments].sort(
    (a, b) => parseLocalDate(b.payment_date).getTime() - parseLocalDate(a.payment_date).getTime()
  );
  const displayedPayments = showAllPayments ? paymentsSortedDesc : paymentsSortedDesc.slice(0, 5);

  // Schedule items to show
  const displayedSchedule = showFullSchedule ? schedule : schedule.slice(0, 5);

  return (
    <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-brand-tan/10 to-transparent border-b border-brand-tan/20 px-6 py-4">
        <div className="flex items-center gap-2 mb-0.5">
          <TrendingUp className="w-5 h-5 text-brand-tan" />
          <h3 className="text-lg font-bold text-brand-cream">Payment Progress</h3>
        </div>
        <p className="text-sm text-brand-cream/50">{tripName}</p>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Complete banner ── */}
        {isComplete && (
          <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-600/40 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-400">Payment Complete!</p>
              <p className="text-sm text-green-400/70">You've paid {fmtAUD(totalPaid)} — fully covered.</p>
            </div>
          </div>
        )}

        {/* ── Behind schedule warning ── */}
        {isBehind && (
          <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-600/40 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-400">Behind Schedule</p>
              <p className="text-sm text-red-400/80 mt-0.5">
                {fmtAUD(overdue)} overdue — {fmtAUD(expectedByNow)} was due by{' '}
                {passedMilestones.length > 0
                  ? fmtDateAU(passedMilestones[passedMilestones.length - 1].milestone_date, { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'now'}.
              </p>
            </div>
          </div>
        )}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brand-black/40 border border-brand-tan/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-brand-tan/80 uppercase tracking-wide mb-1">Total Paid</p>
            <p className="text-3xl font-bold text-brand-cream">{fmtAUD(totalPaid)}</p>
            <p className="text-xs text-brand-cream/40 mt-1">of {fmtAUD(targetAmount)}</p>
          </div>
          <div className="bg-brand-black/40 border border-brand-tan/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-brand-tan/80 uppercase tracking-wide mb-1">Remaining</p>
            <p className="text-3xl font-bold text-brand-cream">{fmtAUD(Math.max(0, targetAmount - totalPaid))}</p>
            <p className="text-xs text-brand-cream/40 mt-1">{Math.round(progressPct)}% complete</p>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-brand-cream/50">
            <span>Progress</span>
            <span className="font-bold text-brand-tan">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-3 bg-brand-black/50 border border-brand-tan/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isComplete ? 'bg-green-500' : isBehind ? 'bg-red-500' : 'bg-gradient-to-r from-brand-tan to-brand-tan/80'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {/* Expected vs actual marker */}
          {!isComplete && expectedByNow > 0 && targetAmount > 0 && (
            <div className="relative h-1">
              <div
                className="absolute top-0 w-0.5 h-4 bg-white/30 rounded-full -translate-y-1"
                style={{ left: `${Math.min(100, (expectedByNow / targetAmount) * 100)}%` }}
                title={`Expected by now: ${fmtAUD(expectedByNow)}`}
              />
            </div>
          )}
          {!isComplete && expectedByNow > 0 && (
            <p className="text-xs text-brand-cream/40">
              <span className="inline-block w-2 h-2 bg-white/30 rounded-full mr-1 align-middle" />
              Expected by now: {fmtAUD(expectedByNow)}
              {isOnTrack && !isBehind && <span className="text-green-400 ml-2">✓ On track</span>}
            </p>
          )}
        </div>

        {/* ── Next milestone ── */}
        {nextMilestone && !isComplete && (
          <div className="bg-brand-black/30 border border-brand-tan/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-brand-tan flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold text-brand-cream">Next Milestone</p>
                  {nextDays !== null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      nextDays <= 7 ? 'bg-red-900/40 text-red-400 border border-red-600/30' :
                      nextDays <= 30 ? 'bg-amber-900/40 text-amber-400 border border-amber-600/30' :
                      'bg-brand-tan/10 text-brand-tan border border-brand-tan/20'
                    }`}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      {nextDays === 0 ? 'Due today' : nextDays < 0 ? `${Math.abs(nextDays)}d overdue` : `${nextDays}d away`}
                    </span>
                  )}
                </div>
                <p className="text-sm text-brand-cream/60 mt-1">
                  {fmtDateAU(nextMilestone.milestone_date, { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {nextMilestone.description && (
                  <p className="text-xs text-brand-cream/50 mt-0.5">{nextMilestone.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <ArrowRight className="w-4 h-4 text-brand-tan flex-shrink-0" />
                  <p className="text-sm text-brand-tan font-semibold">
                    {fmtAUD(amountNeeded)} needed to reach {fmtAUD(nextMilestone.accumulated_amount)} target
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Payment Schedule Timeline ── */}
        {schedule.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-brand-tan/10">
            <h4 className="font-semibold text-brand-cream text-sm uppercase tracking-wide">Payment Schedule</h4>
            <div className="space-y-2">
              {displayedSchedule.map((milestone) => {
                const milestoneDate = parseLocalDate(milestone.milestone_date);
                const isPast = milestoneDate <= today;
                const isMet = totalPaid >= milestone.accumulated_amount;
                const isPastUnmet = isPast && !isMet;

                return (
                  <div
                    key={milestone.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                      isMet
                        ? 'bg-brand-tan/10 border-brand-tan/30'
                        : isPastUnmet
                          ? 'bg-red-900/10 border-red-600/20'
                          : 'bg-brand-black/20 border-brand-tan/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isMet ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-tan flex-shrink-0" />
                      ) : isPastUnmet ? (
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-brand-tan/30 rounded-full flex-shrink-0" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${isMet ? 'text-brand-tan' : isPastUnmet ? 'text-red-400' : 'text-brand-cream'}`}>
                          {fmtDateAU(milestone.milestone_date, { month: 'short', year: 'numeric' })}
                        </p>
                        {milestone.description && (
                          <p className="text-xs text-brand-cream/40">{milestone.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isMet ? 'text-brand-tan' : isPastUnmet ? 'text-red-400' : 'text-brand-cream'}`}>
                        {fmtAUD(milestone.accumulated_amount)}
                      </p>
                      {isPastUnmet && (
                        <p className="text-xs text-red-400/70">{fmtAUD(milestone.accumulated_amount - totalPaid)} short</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {schedule.length > 5 && (
              <button
                onClick={() => setShowFullSchedule(!showFullSchedule)}
                className="flex items-center gap-1.5 text-xs text-brand-tan/70 hover:text-brand-tan transition-colors"
              >
                {showFullSchedule ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showFullSchedule ? 'Show less' : `Show all ${schedule.length} milestones`}
              </button>
            )}
          </div>
        )}

        {/* ── Payment History ── */}
        {memberPayments.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-brand-tan/10">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-brand-cream text-sm uppercase tracking-wide">
                Payment History <span className="text-brand-cream/40 font-normal normal-case">({memberPayments.length})</span>
              </h4>
            </div>
            <div className="space-y-2">
              {displayedPayments.map((payment) => {
                const noteText = parseNoteText(payment.notes);
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between px-4 py-3 bg-brand-black/20 border border-brand-tan/10 rounded-lg hover:border-brand-tan/25 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-cream">
                        {fmtDateAU(payment.payment_date, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-brand-cream/40 mt-0.5">
                        {paymentMethodLabel(payment.payment_method)}
                        {noteText ? ` · ${noteText}` : ''}
                      </p>
                    </div>
                    <p className="font-bold text-brand-tan">{fmtAUD(payment.amount)}</p>
                  </div>
                );
              })}
            </div>
            {memberPayments.length > 5 && (
              <button
                onClick={() => setShowAllPayments(!showAllPayments)}
                className="flex items-center gap-1.5 text-xs text-brand-tan/70 hover:text-brand-tan transition-colors"
              >
                {showAllPayments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllPayments ? 'Show less' : `Show all ${memberPayments.length} payments`}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
