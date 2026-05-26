'use client';

import { useEffect, useState } from 'react';
import { DollarSign, AlertCircle, Banknote, CheckCircle2, Clock } from 'lucide-react';

/** Parse a YYYY-MM-DD date string as local noon to avoid timezone-off-by-one in AU */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function fmtDateAU(dateStr: string, opts: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-AU', opts);
}

interface PaymentMilestone {
  id: string;
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
  description: string | null;
}

interface TripPaymentSettings {
  flights_cost_aud: number;
  show_payment_options: boolean;
  monthly_option_title: string;
  monthly_option_amount_label: string | null;
  monthly_option_description: string | null;
  quarterly_option_title: string;
  quarterly_option_amount_label: string | null;
  quarterly_option_description: string | null;
  show_bank_details: boolean;
  bank_account_name: string | null;
  bank_bsb: string | null;
  bank_account_number: string | null;
  bank_payid: string | null;
  bank_notes: string | null;
}
type PaymentSourceType = 'bank_account' | 'paypal';
interface PayPalWallet {
  id: string;
  currency: string;
  label: string;
  email: string;
  notes: string;
}
interface PaymentSource {
  id: string;
  type: PaymentSourceType;
  name: string;
  member_portal_enabled: boolean;
  account_name: string;
  bsb: string;
  account_number: string;
  payid: string;
  notes: string;
  wallets: PayPalWallet[];
}

interface PaymentScheduleSectionProps {
  tripId: string;
  tripName?: string;
  showPaymentInfo?: boolean;
  /** When false, hides the milestone timeline and shows only payment options + bank details */
  showSchedule?: boolean;
}

const DEFAULT_PAYMENT_SETTINGS: TripPaymentSettings = {
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

function normaliseWallet(wallet: Partial<PayPalWallet>): PayPalWallet {
  return {
    id: wallet.id || `wallet-${Math.random().toString(36).slice(2, 8)}`,
    currency: typeof wallet.currency === 'string' && wallet.currency.trim() ? wallet.currency.trim().toUpperCase() : 'AUD',
    label: typeof wallet.label === 'string' ? wallet.label : '',
    email: typeof wallet.email === 'string' ? wallet.email : '',
    notes: typeof wallet.notes === 'string' ? wallet.notes : '',
  };
}

function normalisePaymentSources(rawSources: unknown): PaymentSource[] {
  if (!Array.isArray(rawSources)) return [];
  return rawSources
    .map((raw) => {
      const source = raw && typeof raw === 'object' ? (raw as Partial<PaymentSource>) : null;
      if (!source) return null;
      const type: PaymentSourceType = source.type === 'paypal' ? 'paypal' : 'bank_account';
      return {
        id: source.id || `source-${Math.random().toString(36).slice(2, 8)}`,
        type,
        name: typeof source.name === 'string' ? source.name : (type === 'paypal' ? 'PayPal' : 'Bank Account'),
        member_portal_enabled: source.member_portal_enabled === true,
        account_name: typeof source.account_name === 'string' ? source.account_name : '',
        bsb: typeof source.bsb === 'string' ? source.bsb : '',
        account_number: typeof source.account_number === 'string' ? source.account_number : '',
        payid: typeof source.payid === 'string' ? source.payid : '',
        notes: typeof source.notes === 'string' ? source.notes : '',
        wallets: Array.isArray(source.wallets) ? source.wallets.map((wallet) => normaliseWallet(wallet as Partial<PayPalWallet>)) : [],
      };
    })
    .filter((source): source is PaymentSource => source !== null);
}

function parsePaymentSourcePayload(rawBankNotes: string | null): { note: string | null; sources: PaymentSource[] } {
  if (!rawBankNotes) return { note: null, sources: [] };

  try {
    const parsed = JSON.parse(rawBankNotes) as {
      version?: number;
      note?: unknown;
      sources?: unknown;
    };
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sources)) {
      return {
        note: typeof parsed.note === 'string' ? parsed.note : null,
        sources: normalisePaymentSources(parsed.sources),
      };
    }
  } catch {
    // Legacy notes are plain text.
  }

  return { note: rawBankNotes, sources: [] };
}

export default function PaymentScheduleSection({
  tripId,
  showPaymentInfo = true,
  showSchedule = true,
}: PaymentScheduleSectionProps) {
  const [schedule, setSchedule] = useState<PaymentMilestone[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<TripPaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
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
        setPaymentSettings({ ...DEFAULT_PAYMENT_SETTINGS, ...(data.paymentSettings || {}) });
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

  // When showing schedule, bail if there are no milestones.
  // When hiding schedule (bank-details-only mode), still render if there's bank info.
  if (showSchedule && (!schedule || schedule.length === 0)) {
    return null;
  }
  if (!showSchedule && !showPaymentInfo) {
    return null;
  }

  const scheduleTargetAmount = schedule[schedule.length - 1]?.accumulated_amount || 0;
  const flightsCost = Number(paymentSettings.flights_cost_aud || 0);
  const totalTripCost = scheduleTargetAmount + flightsCost;

  const showMonthlyOption = Boolean(
    paymentSettings.monthly_option_amount_label || paymentSettings.monthly_option_description
  );
  const showQuarterlyOption = Boolean(
    paymentSettings.quarterly_option_amount_label || paymentSettings.quarterly_option_description
  );
  const parsedPaymentSources = parsePaymentSourcePayload(paymentSettings.bank_notes);
  const bankSources = parsedPaymentSources.sources.filter((source) => source.type === 'bank_account');
  const selectedMemberPortalSource = bankSources.find((source) => source.member_portal_enabled) || bankSources[0] || null;
  const memberPortalSources = selectedMemberPortalSource ? [selectedMemberPortalSource] : [];
  const hasMemberPortalSourceDetails = memberPortalSources.some((source) =>
    Boolean(
      source.account_name ||
      source.bsb ||
      source.account_number ||
      source.payid ||
      source.notes
    )
  );
  const fallbackLegacyBankDetails = memberPortalSources.length === 0
    ? {
        name: paymentSettings.bank_account_name,
        bsb: paymentSettings.bank_bsb,
        account_number: paymentSettings.bank_account_number,
        payid: paymentSettings.bank_payid,
      }
    : null;
  const hasLegacyBankDetails = Boolean(
    fallbackLegacyBankDetails?.name ||
    fallbackLegacyBankDetails?.bsb ||
    fallbackLegacyBankDetails?.account_number ||
    fallbackLegacyBankDetails?.payid
  );
  const hasBankDetails = hasMemberPortalSourceDetails || hasLegacyBankDetails || parsedPaymentSources.note;

  // In bank-details-only mode, bail if there's truly nothing useful to show.
  if (!showSchedule && !hasBankDetails && !showMonthlyOption && !showQuarterlyOption) {
    return null;
  }

  return (
    <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-brand-tan/10 to-brand-tan/5 border-b border-brand-tan/30 p-6">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-6 h-6 text-brand-tan" />
          <h3 className="text-xl font-bold text-brand-cream">
            {showSchedule ? 'Payment Schedule' : 'How to Pay'}
          </h3>
        </div>
        {showSchedule && (
          <>
            <p className="text-sm text-brand-cream/70">
              Total trip cost:{' '}
              <span className="font-semibold text-brand-tan">
                ${totalTripCost.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </p>
            {flightsCost > 0 && (
              <p className="text-sm text-brand-cream/70 mt-1">
                Payment schedule target:{' '}
                <span className="font-semibold text-brand-tan">
                  ${scheduleTargetAmount.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                {' '}+ Flights:{' '}
                <span className="font-semibold text-brand-tan">
                  ${flightsCost.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </p>
            )}
          </>
        )}
        {!showSchedule && (
          <p className="text-sm text-brand-cream/50">Bank details and payment options</p>
        )}
      </div>

      <div className="p-6 space-y-6">
        {showPaymentInfo && paymentSettings.show_payment_options && (showMonthlyOption || showQuarterlyOption) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {showMonthlyOption && (
              <div className="bg-gradient-to-br from-brand-cream/10 to-brand-cream/5 rounded-lg p-4 border border-brand-cream/30 hover:border-brand-cream/50 transition-colors">
                <div className="flex items-start gap-3">
                  <Banknote className="w-5 h-5 text-brand-cream mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-brand-cream">{paymentSettings.monthly_option_title || 'Monthly Option'}</p>
                    {paymentSettings.monthly_option_amount_label && (
                      <p className="text-sm text-brand-tan mt-1 font-semibold">{paymentSettings.monthly_option_amount_label}</p>
                    )}
                    {paymentSettings.monthly_option_description && (
                      <p className="text-xs text-brand-cream/60 mt-2">{paymentSettings.monthly_option_description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showQuarterlyOption && (
              <div className="bg-gradient-to-br from-brand-tan/10 to-brand-tan/5 rounded-lg p-4 border border-brand-tan/30 hover:border-brand-tan/50 transition-colors">
                <div className="flex items-start gap-3">
                  <Banknote className="w-5 h-5 text-brand-tan mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-brand-cream">{paymentSettings.quarterly_option_title || 'Quarterly Option'}</p>
                    {paymentSettings.quarterly_option_amount_label && (
                      <p className="text-sm text-brand-tan mt-1 font-semibold">{paymentSettings.quarterly_option_amount_label}</p>
                    )}
                    {paymentSettings.quarterly_option_description && (
                      <p className="text-xs text-brand-cream/60 mt-2">{paymentSettings.quarterly_option_description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {showSchedule && <div className="space-y-0">
          <h4 className="font-semibold text-brand-cream mb-4">Payment Milestones</h4>
          <div className="space-y-3">
            {schedule.map((milestone, index) => {
              const isLastMilestone = index === schedule.length - 1;
              const today = new Date();
              today.setHours(12, 0, 0, 0);
              const milestoneDate = parseLocalDate(milestone.milestone_date);
              const isPast = milestoneDate < today;
              const isToday = milestoneDate.toDateString() === today.toDateString();
              const isUpcoming = !isPast && !isToday;

              return (
                <div key={milestone.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-4 h-4 rounded-full border-4 border-brand-dark-grey shadow-lg ${
                      isPast || isToday ? 'bg-brand-tan shadow-brand-tan/30' : 'bg-brand-tan/40 shadow-brand-tan/10'
                    }`} />
                    {!isLastMilestone && (
                      <div className={`w-0.5 h-12 mt-2 ${
                        isPast ? 'bg-brand-tan/60' : 'bg-brand-tan/20'
                      }`} />
                    )}
                  </div>

                  <div className="pb-4 flex-1">
                    <div className={`border rounded-lg p-4 transition-colors ${
                      isToday
                        ? 'bg-brand-tan/10 border-brand-tan/50'
                        : isPast
                          ? 'bg-brand-dark-grey border-brand-tan/20'
                          : 'bg-brand-dark-grey border-brand-tan/10 hover:border-brand-tan/30'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-brand-cream">
                              {fmtDateAU(milestone.milestone_date, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                            {isToday && (
                              <span className="text-xs px-2 py-0.5 bg-brand-tan/20 border border-brand-tan/40 text-brand-tan rounded-full font-medium">
                                Due today
                              </span>
                            )}
                            {isPast && !isToday && (
                              <span className="flex items-center gap-1 text-xs text-brand-tan/60">
                                <CheckCircle2 className="w-3 h-3" /> Past due
                              </span>
                            )}
                            {isUpcoming && (
                              <span className="flex items-center gap-1 text-xs text-brand-cream/30">
                                <Clock className="w-3 h-3" /> Upcoming
                              </span>
                            )}
                          </div>
                          {milestone.description && (
                            <p className="text-sm text-brand-cream/60 mt-1">{milestone.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-lg font-bold ${isPast || isToday ? 'text-brand-tan' : 'text-brand-cream/70'}`}>
                            ${milestone.accumulated_amount.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-brand-cream/40 mt-0.5">accumulated</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>}

        {showPaymentInfo && paymentSettings.show_bank_details && hasBankDetails && (
          <div className="bg-gradient-to-r from-brand-tan/10 to-brand-tan/5 rounded-lg p-4 border border-brand-tan/30 mt-6">
            <h4 className="font-semibold text-brand-cream mb-3">Payment Account</h4>
            <div className="space-y-3 text-sm text-brand-cream/80">
              {memberPortalSources.length > 0 ? (
                memberPortalSources.map((source) => (
                  <div key={source.id} className="bg-brand-black/20 border border-brand-tan/20 rounded-lg p-3">
                    <p className="font-semibold text-brand-tan mb-2">{source.name || (source.type === 'paypal' ? 'PayPal' : 'Bank Account')}</p>
                    {source.type === 'paypal' ? (
                      <div className="space-y-2">
                        {source.wallets.map((wallet) => (
                          <div key={wallet.id} className="text-xs text-brand-cream/80 border border-brand-tan/10 rounded p-2">
                            <p>
                              <span className="font-semibold text-brand-tan">Wallet:</span> {wallet.label || 'Wallet'} ({wallet.currency || 'AUD'})
                            </p>
                            {wallet.email && (
                              <p>
                                <span className="font-semibold text-brand-tan">PayPal:</span> {wallet.email}
                              </p>
                            )}
                            {wallet.notes && <p className="text-brand-cream/70">{wallet.notes}</p>}
                          </div>
                        ))}
                        {source.notes && <p className="text-brand-cream/70">{source.notes}</p>}
                      </div>
                    ) : (
                      <div className="font-mono text-xs space-y-1">
                        {source.account_name && (
                          <p>
                            <span className="font-semibold text-brand-tan">Account Name:</span> {source.account_name}
                          </p>
                        )}
                        {source.bsb && (
                          <p>
                            <span className="font-semibold text-brand-tan">BSB #:</span> {source.bsb}
                          </p>
                        )}
                        {source.account_number && (
                          <p>
                            <span className="font-semibold text-brand-tan">Account #:</span> {source.account_number}
                          </p>
                        )}
                        {source.payid && (
                          <p>
                            <span className="font-semibold text-brand-tan">PayID:</span> {source.payid}
                          </p>
                        )}
                        {source.notes && <p className="text-brand-cream/70">{source.notes}</p>}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm text-brand-cream/80 space-y-2 font-mono">
                  {fallbackLegacyBankDetails?.name && (
                    <p>
                      <span className="font-semibold text-brand-tan">Account Name:</span> {fallbackLegacyBankDetails.name}
                    </p>
                  )}
                  {fallbackLegacyBankDetails?.bsb && (
                    <p>
                      <span className="font-semibold text-brand-tan">BSB #:</span> {fallbackLegacyBankDetails.bsb}
                    </p>
                  )}
                  {fallbackLegacyBankDetails?.account_number && (
                    <p>
                      <span className="font-semibold text-brand-tan">Account #:</span> {fallbackLegacyBankDetails.account_number}
                    </p>
                  )}
                  {fallbackLegacyBankDetails?.payid && (
                    <p>
                      <span className="font-semibold text-brand-tan">PayID:</span> {fallbackLegacyBankDetails.payid}
                    </p>
                  )}
                </div>
              )}
              {parsedPaymentSources.note && (
                <p className="text-brand-cream/70">{parsedPaymentSources.note}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
