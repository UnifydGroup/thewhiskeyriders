'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, Plus, X, AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { getMemberDisplayName, getMemberListName } from '@/lib/member-display';
import PaymentImportPanel from '@/components/payments/PaymentImportPanel';

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

interface Trip {
  id: string;
  name: string;
  slug: string;
}

export default function ManagePaymentsPage() {
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>('');
  const [schedule, setSchedule] = useState<PaymentMilestone[]>([]);
  const [memberPaymentSummary, setMemberPaymentSummary] = useState<MemberPaymentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<{ imported_at: string; row_count: number } | null>(null);

  // Form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch trips
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*');
        if (error) throw error;
        // Sort newest to oldest: prefer start_date, fall back to year in name
        const sorted = (data || []).sort((a, b) => {
          const yearA = a.start_date ? new Date(a.start_date).getFullYear() : (parseInt(a.name?.match(/\d{4}/)?.[0] ?? '0') || 0);
          const yearB = b.start_date ? new Date(b.start_date).getFullYear() : (parseInt(b.name?.match(/\d{4}/)?.[0] ?? '0') || 0);
          return yearB - yearA;
        });
        setTrips(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trips');
      }
    };
    fetchTrips();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tripFromQuery = params.get('trip_id') || params.get('tripId') || '';
    if (!tripFromQuery) return;
    setSelectedTrip((current) => current || tripFromQuery);
  }, []);

  // Fetch payment schedule when trip is selected
  useEffect(() => {
    if (!selectedTrip) {
      setSchedule([]);
      setMemberPaymentSummary([]);
      return;
    }

    const fetchPaymentData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/payments/schedule?trip_id=${selectedTrip}`);
        if (!res.ok) throw new Error('Failed to fetch payment data');

        const data = await res.json();
        setSchedule(data.schedule || []);
        setMemberPaymentSummary(data.memberPaymentSummary || []);

        // Fetch last import log
        const logRes = await fetch(`/api/payments/import-log?trip_id=${selectedTrip}`);
        if (logRes.ok) {
          const logData = await logRes.json();
          setLastImport(logData.log ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentData();
  }, [selectedTrip]);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !selectedMember || !paymentAmount) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/payments/member-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMember,
          trip_id: selectedTrip,
          payment_date: paymentDate,
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          notes: paymentNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to record payment');

      setSuccessMessage('Payment recorded successfully!');
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('bank_transfer');
      setPaymentNotes('');
      setSelectedMember('');

      // Refresh data
      const refreshRes = await fetch(`/api/payments/schedule?trip_id=${selectedTrip}`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setMemberPaymentSummary(data.memberPaymentSummary || []);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const targetAmount = schedule.length > 0 ? schedule[schedule.length - 1].accumulated_amount : 5000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-brand-tan" />
          <h1 className="text-3xl font-bold text-brand-cream">Payment Management</h1>
        </div>
        {lastImport && (
          <div className="text-right">
            <p className="text-xs text-brand-cream/40 uppercase tracking-wide">Data last imported</p>
            <p className="text-sm font-semibold text-brand-tan">
              {new Date(lastImport.imported_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs text-brand-cream/40">{lastImport.row_count} payments · {new Date(lastImport.imported_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )}
      </div>

      {/* Trip Selection */}
      <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
        <label className="block text-sm font-semibold text-brand-cream mb-2">
          Select Trip
        </label>
        <select
          value={selectedTrip}
          onChange={(e) => {
            const nextTripId = e.target.value;
            setSelectedTrip(nextTripId);

            if (typeof window === 'undefined') return;
            const params = new URLSearchParams(window.location.search);
            params.delete('tripId');
            if (nextTripId) {
              params.set('trip_id', nextTripId);
            } else {
              params.delete('trip_id');
            }

            const query = params.toString();
            const nextUrl = `/admin/payments/manage${query ? `?${query}` : ''}`;
            window.history.replaceState({}, '', nextUrl);
          }}
          className="w-full md:w-96 px-4 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
        >
          <option value="">-- Choose a trip --</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-green-300">{successMessage}</p>
        </div>
      )}

      {selectedTrip && !loading && (
        <>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowPaymentForm(!showPaymentForm);
                setShowImportPanel(false);
              }}
              className="flex items-center gap-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Record Payment
            </button>
            <button
              onClick={() => {
                setShowImportPanel(!showImportPanel);
                setShowPaymentForm(false);
              }}
              className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan/70 hover:bg-brand-tan/10 text-brand-cream font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5" />
              Import CSV / Excel
            </button>
          </div>

          {/* Payment Form */}
          {showPaymentForm && (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-brand-cream">Record Member Payment</h3>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="text-brand-cream/60 hover:text-brand-cream"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-brand-cream mb-2">
                    Member
                  </label>
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="w-full px-4 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    required
                  >
                    <option value="">-- Select member --</option>
                    {memberPaymentSummary.map((member) => (
                      <option key={member.member_id} value={member.member_id}>
                        {getMemberListName(member as any)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-brand-cream mb-2">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-brand-cream mb-2">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-4 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-brand-cream mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="payid">PayID</option>
                    <option value="cash">Cash</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-brand-cream mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full px-4 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream font-semibold hover:bg-brand-dark-grey/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Import Panel */}
          {showImportPanel && (
            <PaymentImportPanel
              tripId={selectedTrip}
              onClose={() => setShowImportPanel(false)}
              onImportComplete={async () => {
                // Refresh payment data
                const refreshRes = await fetch(`/api/payments/schedule?trip_id=${selectedTrip}`);
                if (refreshRes.ok) {
                  const data = await refreshRes.json();
                  setMemberPaymentSummary(data.memberPaymentSummary || []);
                  setSchedule(data.schedule || []);
                }
                // Refresh last import timestamp
                const logRes = await fetch(`/api/payments/import-log?trip_id=${selectedTrip}`);
                if (logRes.ok) {
                  const logData = await logRes.json();
                  setLastImport(logData.log ?? null);
                }
                setSuccessMessage('Payments imported successfully!');
                setTimeout(() => setSuccessMessage(null), 5000);
              }}
            />
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
              <p className="text-sm text-brand-cream/70 mb-1">Total Members</p>
              <p className="text-3xl font-bold text-brand-cream">
                {memberPaymentSummary.length}
              </p>
            </div>

            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
              <p className="text-sm text-brand-cream/70 mb-1">Members Paid</p>
              <p className="text-3xl font-bold text-brand-tan">
                {memberPaymentSummary.filter((m) => m.total_paid > 0).length}
              </p>
            </div>

            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
              <p className="text-sm text-brand-cream/70 mb-1">Target Amount</p>
              <p className="text-3xl font-bold text-brand-tan">
                ${targetAmount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-black border-b border-brand-tan/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">
                      Member
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">
                      Total Paid
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">
                      Remaining
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">
                      Payments
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">
                      Last Payment
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">
                      Milestone Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memberPaymentSummary.map((member) => {
                    const remaining = Math.max(0, targetAmount - member.total_paid);
                    const percentPaid = (member.total_paid / targetAmount) * 100;

                    // Milestone status: compare against the last PASSED milestone,
                    // not the next upcoming one. e.g. on 1 Apr 2026 the due amount
                    // is $2,000 (Jan 31 passed), not $2,750 (Apr 30 not yet due).
                    const today = new Date();
                    const passedMilestones = schedule.filter(
                      (m) => new Date(m.milestone_date) <= today
                    );
                    const expectedByMilestone =
                      passedMilestones.length > 0
                        ? passedMilestones[passedMilestones.length - 1].accumulated_amount
                        : 0;
                    const nextMilestone = schedule.find(
                      (m) => new Date(m.milestone_date) > today
                    );

                    const isFullyPaid = member.total_paid >= targetAmount;
                    const isAhead     = !isFullyPaid && member.total_paid > expectedByMilestone;
                    const isOnTrack   = !isFullyPaid && member.total_paid >= expectedByMilestone;

                    return (
                      <tr
                        key={member.member_id}
                        className="border-b border-brand-tan/10 hover:bg-brand-dark-grey/50"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-brand-cream">{getMemberDisplayName(member as any)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-brand-tan">
                            ${member.total_paid.toFixed(2)}
                          </p>
                          <p className="text-xs text-brand-cream/50 mt-1">{percentPaid.toFixed(0)}%</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-semibold ${remaining > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                            ${remaining.toFixed(2)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-brand-cream/70">{member.payment_count}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-brand-cream/70">
                            {member.last_payment_date
                              ? new Date(member.last_payment_date).toLocaleDateString()
                              : '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {isFullyPaid ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-900/40 text-green-300 rounded-full text-sm font-medium border border-green-500/40 mb-1">
                                <CheckCircle2 className="w-4 h-4" />
                                Paid in Full
                              </span>
                            </div>
                          ) : isAhead ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-sm font-medium border border-blue-600/30 mb-1">
                                <CheckCircle2 className="w-4 h-4" />
                                Ahead
                              </span>
                              <p className="text-xs text-blue-400/70 mt-1">
                                +${(member.total_paid - expectedByMilestone).toFixed(2)} ahead of schedule
                              </p>
                              {nextMilestone && (
                                <p className="text-xs text-blue-400/50">
                                  Next due {new Date(nextMilestone.milestone_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}: ${nextMilestone.accumulated_amount.toLocaleString()}
                                </p>
                              )}
                            </div>
                          ) : isOnTrack ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm font-medium border border-green-600/30 mb-1">
                                <CheckCircle2 className="w-4 h-4" />
                                On Track
                              </span>
                              {nextMilestone ? (
                                <p className="text-xs text-green-400/70 mt-1">
                                  Next due {new Date(nextMilestone.milestone_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}: ${nextMilestone.accumulated_amount.toLocaleString()}
                                </p>
                              ) : (
                                <p className="text-xs text-green-400/70 mt-1">Final milestone reached</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-900/30 text-red-400 rounded-full text-sm font-medium border border-red-600/30 mb-1">
                                Behind
                              </span>
                              <p className="text-xs text-red-400/70 mt-1">
                                ${(expectedByMilestone - member.total_paid).toFixed(2)} overdue
                              </p>
                              {nextMilestone && (
                                <p className="text-xs text-red-400/50">
                                  Next due {new Date(nextMilestone.milestone_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}: ${nextMilestone.accumulated_amount.toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedTrip && loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin">
            <DollarSign className="w-8 h-8 text-amber-600" />
          </div>
        </div>
      )}
    </div>
  );
}
