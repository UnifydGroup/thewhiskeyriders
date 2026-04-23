'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';
import {
  AlertCircle, RefreshCw, CreditCard, Banknote,
  Building2, CircleDollarSign, HelpCircle,
} from 'lucide-react';

interface Transaction {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  notes?: string | null;
}

interface MemberTransactionsProps {
  memberId: string;
  tripId: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD date string as local noon to avoid timezone-off-by-one in AU */
function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes('T') || dateStr.includes('Z')) return new Date(dateStr);
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function fmtDateAU(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtAUD(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - parseLocalDate(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return fmtDateAU(dateStr);
}

/** Parse JSON-encoded notes and return the human-readable text */
function parseNoteText(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { text?: string };
    if (parsed && typeof parsed.text === 'string') return parsed.text.trim();
  } catch { /* plain text */ }
  return raw.trim();
}

function MethodIcon({ method }: { method: string | null }) {
  const m = (method || '').toLowerCase();
  if (m === 'bank_transfer' || m === 'bpay') return <Building2 className="w-3.5 h-3.5" />;
  if (m === 'payid')                          return <CircleDollarSign className="w-3.5 h-3.5" />;
  if (m === 'cash')                           return <Banknote className="w-3.5 h-3.5" />;
  if (m === 'credit_card')                    return <CreditCard className="w-3.5 h-3.5" />;
  return <HelpCircle className="w-3.5 h-3.5 opacity-40" />;
}

function methodLabel(method: string | null): string {
  if (!method) return '';
  return method.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MemberTransactions({ memberId, tripId }: MemberTransactionsProps) {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [lastImport, setLastImport]     = useState<{ imported_at: string; row_count: number } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [txRes, logRes] = await Promise.all([
        supabase
          .from('member_payments')
          .select('id, payment_date, amount, payment_method, notes')
          .eq('member_id', memberId)
          .eq('trip_id', tripId)
          .order('payment_date', { ascending: true }),
        fetch(`/api/payments/import-log?trip_id=${tripId}`),
      ]);

      if (txRes.error) throw txRes.error;
      setTransactions(txRes.data || []);

      if (logRes.ok) {
        const logData = await logRes.json();
        setLastImport(logData.log ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [memberId, tripId]);

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Error ──

  if (error) {
    return (
      <div className="bg-brand-dark-grey border border-red-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-300 font-medium">Could not load transactions</p>
            <p className="text-red-400/60 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ──

  if (transactions.length === 0) {
    return (
      <div className="bg-brand-dark-grey border border-brand-tan/10 rounded-xl p-8 text-center">
        <CircleDollarSign className="w-10 h-10 text-brand-tan/30 mx-auto mb-3" />
        <p className="text-brand-cream/60 font-medium">No payment transactions recorded yet</p>
        <p className="text-brand-cream/30 text-sm mt-1">Your payments will appear here once recorded by the trip admin.</p>
      </div>
    );
  }

  // ── Data ──

  const totalPaid = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  // Build running total (ascending order, oldest first)
  let running = 0;
  const withRunning = transactions.map((t) => {
    running += Number(t.amount);
    return { ...t, running };
  });
  // Reverse for display (newest first)
  const displayList = [...withRunning].reverse();

  return (
    <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-brand-tan/10 to-transparent border-b border-brand-tan/20 px-5 py-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-brand-cream">Transaction History</h4>
          <div className="flex items-center gap-3">
            {lastImport && (
              <span className="flex items-center gap-1.5 text-xs text-brand-cream/30">
                <RefreshCw className="w-3 h-3" />
                Updated {timeAgo(lastImport.imported_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-px bg-brand-tan/10">
        <div className="bg-brand-dark-grey px-5 py-3">
          <p className="text-xs text-brand-cream/50 uppercase tracking-wide">Total Paid</p>
          <p className="text-xl font-bold text-brand-tan mt-0.5">{fmtAUD(totalPaid)}</p>
        </div>
        <div className="bg-brand-dark-grey px-5 py-3">
          <p className="text-xs text-brand-cream/50 uppercase tracking-wide">Transactions</p>
          <p className="text-xl font-bold text-brand-cream mt-0.5">{transactions.length}</p>
        </div>
      </div>

      {/* Transaction table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-tan/10">
              <th className="px-5 py-3 text-left text-xs font-semibold text-brand-cream/50 uppercase tracking-wide">Date</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-brand-cream/50 uppercase tracking-wide">Amount</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-brand-cream/50 uppercase tracking-wide hidden sm:table-cell">Method</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-brand-cream/50 uppercase tracking-wide hidden md:table-cell">Notes</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-brand-cream/50 uppercase tracking-wide hidden lg:table-cell">Running Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-tan/5">
            {displayList.map((t, idx) => {
              const noteText = parseNoteText(t.notes);
              const isLatest = idx === 0;
              return (
                <tr
                  key={t.id}
                  className={`hover:bg-brand-tan/5 transition-colors ${isLatest ? 'bg-brand-tan/5' : ''}`}
                >
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <p className="font-medium text-brand-cream">{fmtDateAU(t.payment_date)}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <p className="font-bold text-brand-tan">{fmtAUD(t.amount)}</p>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    {t.payment_method ? (
                      <span className="flex items-center gap-1.5 text-brand-cream/60">
                        <MethodIcon method={t.payment_method} />
                        {methodLabel(t.payment_method)}
                      </span>
                    ) : (
                      <span className="text-brand-cream/25">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-brand-cream/50 max-w-[180px] truncate block">
                      {noteText || <span className="text-brand-cream/20">—</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                    <span className="text-xs text-brand-cream/40">{fmtAUD(t.running)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-brand-tan/20 bg-brand-black/20">
              <td className="px-5 py-3 font-semibold text-brand-cream/60">Total</td>
              <td className="px-5 py-3 text-right font-bold text-brand-tan">{fmtAUD(totalPaid)}</td>
              <td className="hidden sm:table-cell" />
              <td className="hidden md:table-cell" />
              <td className="hidden lg:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
