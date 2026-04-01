'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { AlertCircle, RefreshCw } from 'lucide-react';

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MemberTransactions({ memberId, tripId }: MemberTransactionsProps) {
  const supabase = createClient();
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [lastImport, setLastImport]       = useState<{ imported_at: string; row_count: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
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
    load();
  }, [memberId, tripId]);

  if (loading) return <div className="flex items-center justify-center py-8"><Spinner size="lg" /></div>;

  if (error) return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (transactions.length === 0) return (
    <Card>
      <CardContent className="py-6 text-center">
        <p className="text-brand-cream/70">No payment transactions recorded yet</p>
      </CardContent>
    </Card>
  );

  const totalPaid = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payment Transactions</CardTitle>
          {lastImport && (
            <div className="flex items-center gap-1.5 text-xs text-brand-cream/40">
              <RefreshCw className="w-3 h-3" />
              <span>Updated {timeAgo(lastImport.imported_at)}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-brand-dark-grey/50 border border-brand-tan/20 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-brand-cream/70">Total Paid</p>
                <p className="text-2xl font-bold text-brand-tan">${totalPaid.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-brand-cream/70">Transactions</p>
                <p className="text-2xl font-bold text-brand-cream">{transactions.length}</p>
              </div>
            </div>
          </div>

          {/* Transaction list */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-tan/20">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-brand-cream">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-brand-cream">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-brand-cream">Method</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-brand-cream">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-brand-tan/10 hover:bg-brand-dark-grey/30">
                    <td className="px-4 py-3 text-sm text-brand-cream">
                      {new Date(t.payment_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-tan">${t.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-brand-cream/70">
                      {(t.payment_method ?? 'N/A').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-cream/60">{t.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
