'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, CheckCircle2, EyeOff, TrendingUp } from 'lucide-react';

interface BudgetCategory {
  id: string;
  name: string;
  planned_aud: number;
  color: string;
  spent_aud: number;
  remaining_aud: number;
  over_budget: boolean;
}

interface BudgetOverview {
  total_budget_aud: number;
  total_planned_aud: number;
  total_spent_aud: number;
  total_collected_aud?: number;
  total_collected_from_members_aud?: number;
  budget_remaining_aud: number;
  collection_gap_aud: number;
  member_count: number;
  cost_share_per_member_aud: number;
}

interface MemberPayment {
  user_id: string;
  full_name: string | null;
  nickname: string | null;
  total_paid_aud: number;
  cost_share_aud: number;
  remaining_aud: number;
  is_current_user: boolean;
}

interface BudgetData {
  visibility: { show_group: boolean; show_individual: boolean; is_admin: boolean; acting_as_member?: boolean };
  overview: BudgetOverview | null;
  categories: BudgetCategory[];
  member_payments: MemberPayment[];
  settings: { exchange_rate_mad_aud: number; notes: string | null };
}

function fmt(amount: number) {
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  tripId: string;
  viewAsMember?: boolean;
}

export default function MemberBudgetView({ tripId, viewAsMember = false }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};
        const summaryUrl = viewAsMember
          ? `/api/trips/${tripId}/budget/summary?view_as_member=true`
          : `/api/trips/${tripId}/budget/summary`;
        const res = await fetch(summaryUrl, { headers });
        if (!res.ok) return;
        const json = await res.json();
        setData(json.data);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [tripId, viewAsMember, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <DollarSign className="w-7 h-7 text-brand-tan animate-pulse" />
      </div>
    );
  }

  // Nothing visible to this member
  if (!data || (!data.visibility.show_group && !data.visibility.show_individual)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <EyeOff className="w-10 h-10 text-brand-cream/20" />
        <p className="text-brand-cream/50 font-medium">Budget information isn&apos;t available yet</p>
        <p className="text-sm text-brand-cream/30">The organisers will make this visible when ready</p>
      </div>
    );
  }

  const { overview, categories, member_payments, visibility, settings } = data;
  const totalCollected = overview
    ? (overview.total_collected_aud ?? overview.total_collected_from_members_aud ?? 0)
    : 0;

  // The current user's own row
  const myPayment = member_payments.find((m) => m.is_current_user);

  return (
    <div className="space-y-6">

      {/* ── My Cost Share ─────────────────────────────────────────────────── */}
      {visibility.show_individual && myPayment && (
        <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-brand-cream mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-brand-tan" />
            My Cost Share
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <p className="text-xs text-brand-cream/50 uppercase tracking-wider mb-1">Total Share</p>
              <p className="text-2xl font-bold text-brand-cream">{fmt(myPayment.cost_share_aud)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-cream/50 uppercase tracking-wider mb-1">Paid</p>
              <p className="text-2xl font-bold text-brand-tan">{fmt(myPayment.total_paid_aud)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-cream/50 uppercase tracking-wider mb-1">Remaining</p>
              <p className={`text-2xl font-bold ${myPayment.remaining_aud <= 0 ? 'text-green-400' : 'text-amber-400'}`}>
                {fmt(myPayment.remaining_aud)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="w-full h-3 bg-brand-black rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${myPayment.remaining_aud <= 0 ? 'bg-green-500' : 'bg-brand-tan'}`}
                style={{
                  width: `${Math.min(100, myPayment.cost_share_aud > 0
                    ? (myPayment.total_paid_aud / myPayment.cost_share_aud) * 100
                    : 0)}%`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-brand-cream/50">
              {myPayment.cost_share_aud > 0
                ? Math.round((myPayment.total_paid_aud / myPayment.cost_share_aud) * 100)
                : 0}% paid
            </span>
            {myPayment.remaining_aud <= 0 && (
              <span className="flex items-center gap-1.5 text-green-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Fully paid
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Group Budget Overview ─────────────────────────────────────────── */}
      {visibility.show_group && overview && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-brand-cream flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-tan" />
            Group Budget
          </h2>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Total Budget', value: fmt(overview.total_budget_aud) },
              { label: 'Collected', value: fmt(totalCollected) },
              { label: 'Spent', value: fmt(overview.total_spent_aud) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-4">
                <p className="text-xs text-brand-cream/50 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-bold text-brand-cream">{value}</p>
              </div>
            ))}
          </div>

          {/* Collection progress */}
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-5 space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-brand-cream/70">Collection progress</span>
                <span className="text-brand-tan font-semibold">
                  {overview.total_budget_aud > 0
                    ? Math.round((totalCollected / overview.total_budget_aud) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-brand-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-tan rounded-full"
                  style={{
                    width: `${Math.min(100, overview.total_budget_aud > 0
                      ? (totalCollected / overview.total_budget_aud) * 100
                      : 0)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-brand-cream/40 mt-1.5">
                {fmt(totalCollected)} of {fmt(overview.total_budget_aud)} collected
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-brand-cream/70">Spend vs budget</span>
                <span className={`font-semibold ${overview.total_spent_aud > overview.total_budget_aud ? 'text-red-400' : 'text-green-400'}`}>
                  {overview.total_budget_aud > 0
                    ? Math.round((overview.total_spent_aud / overview.total_budget_aud) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-brand-black rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${overview.total_spent_aud > overview.total_budget_aud ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{
                    width: `${Math.min(100, overview.total_budget_aud > 0
                      ? (overview.total_spent_aud / overview.total_budget_aud) * 100
                      : 0)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-brand-cream/40 mt-1.5">
                {fmt(overview.total_spent_aud)} spent · {fmt(Math.max(0, overview.total_budget_aud - overview.total_spent_aud))} remaining
              </p>
            </div>
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-tan/20">
                <p className="font-semibold text-brand-cream">Budget by Category</p>
              </div>
              <div className="divide-y divide-brand-tan/10">
                {categories.map((cat) => {
                  const pct = cat.planned_aud > 0 ? Math.min(100, (cat.spent_aud / cat.planned_aud) * 100) : 0;
                  return (
                    <div key={cat.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-brand-cream font-medium text-sm">{cat.name}</span>
                          {cat.over_budget && (
                            <span className="text-xs text-red-400 border border-red-400/40 rounded-full px-2 py-0.5">Over budget</span>
                          )}
                        </div>
                        <span className="text-sm text-brand-cream/60">
                          {fmt(cat.spent_aud)} / {fmt(cat.planned_aud)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-brand-black rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: cat.over_budget ? '#ef4444' : cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {settings.notes && (
            <div className="bg-brand-dark-grey/50 border border-brand-tan/10 rounded-lg p-4">
              <p className="text-sm text-brand-cream/60">{settings.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
