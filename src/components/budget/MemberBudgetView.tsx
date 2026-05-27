'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DollarSign, CheckCircle2, EyeOff, TrendingUp,
  Users, User, Check, Circle, Wallet, RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  planned_aud: number;
  spent_aud: number;
  over_budget: boolean;
  group_planned_aud?: number;
  personal_planned_aud?: number;
}

interface BudgetOverview {
  total_budget_aud: number;
  total_spent_aud: number;
  total_collected_from_members_aud?: number;
  member_count: number;
  kitty_per_member_aud?: number;
  personal_budget_per_member_aud?: number;
  total_group_planned_aud?: number;
  total_personal_planned_aud?: number;
  total_interest_income_aud?: number;
}

interface MyPayment {
  user_id: string;
  total_paid_aud: number;
  kitty_share_aud?: number;
  cost_share_aud: number;
  personal_budget_aud?: number;
  total_trip_cost_aud?: number;
  remaining_aud: number;
  is_current_user: boolean;
}

interface CostItem {
  id: string;
  name: string;
  description: string | null;
  is_self_funded: boolean;
  notes: string | null;
}

interface BudgetData {
  visibility: { show_group: boolean; show_individual: boolean; is_admin: boolean; acting_as_member?: boolean };
  overview: BudgetOverview | null;
  categories: BudgetCategory[];
  member_payments: MyPayment[];
  member_breakdown: MyPayment[];
  member_cost_items: CostItem[];
  settings: { exchange_rate_mad_aud: number; notes: string | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

function fmtDec(n: number) {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(paid: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  tripId: string;
  viewAsMember?: boolean;
}

export default function MemberBudgetView({ tripId, viewAsMember = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};
        const url = viewAsMember
          ? `/api/trips/${tripId}/budget/summary?view_as_member=true`
          : `/api/trips/${tripId}/budget/summary`;
        const res = await fetch(url, { headers });
        if (!res.ok) return;
        const json = await res.json();
        setData(json.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tripId, viewAsMember, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 text-brand-tan/50 animate-spin" />
      </div>
    );
  }

  if (!data || (!data.visibility.show_group && !data.visibility.show_individual)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <EyeOff className="w-10 h-10 text-brand-cream/20" />
        <p className="text-brand-cream/50 font-medium">Budget information isn&apos;t available yet</p>
        <p className="text-sm text-brand-cream/30">The organisers will share this when ready</p>
      </div>
    );
  }

  const { overview, categories, member_breakdown, member_payments, member_cost_items, visibility, settings } = data;

  // Find this member's row
  const allRows = [...(member_breakdown ?? []), ...(member_payments ?? [])];
  const myRow = allRows.find((m) => m.is_current_user);

  const kittyShare    = myRow?.kitty_share_aud  ?? myRow?.cost_share_aud   ?? overview?.kitty_per_member_aud      ?? 0;
  const personalShare = myRow?.personal_budget_aud ?? overview?.personal_budget_per_member_aud ?? 0;
  const paid          = myRow?.total_paid_aud   ?? 0;
  const totalCost     = myRow?.total_trip_cost_aud ?? (kittyShare + personalShare);
  const kittyRemaining = Math.max(0, kittyShare - paid);
  const paidPct       = pct(paid, kittyShare);

  // Personal-category breakdown: categories with personal_planned_aud > 0
  const personalCategories = categories.filter((c) => (c.personal_planned_aud ?? 0) > 0);

  // Cost tracker
  const hasCostItems   = member_cost_items.length > 0;
  const selfFundedCount = member_cost_items.filter((i) => i.is_self_funded).length;

  return (
    <div className="space-y-5">

      {/* ── My total trip cost ─────────────────────────────────────────────── */}
      {visibility.show_individual && (kittyShare > 0 || personalShare > 0) && (
        <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey overflow-hidden">

          {/* Hero total */}
          <div className="px-6 pt-5 pb-4 bg-brand-black/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-cream/40 mb-1">
              Your estimated trip cost
            </p>
            <p className="text-4xl font-bold text-brand-cream">{fmt(totalCost)}</p>
            {kittyShare > 0 && personalShare > 0 && (
              <p className="text-sm text-brand-cream/40 mt-1.5">
                {fmt(kittyShare)} group kitty &nbsp;+&nbsp; {fmt(personalShare)} personal items
              </p>
            )}
          </div>

          {/* ── Group kitty section ──────────────────────────────────────── */}
          {kittyShare > 0 && (
            <div className="px-6 py-5 border-t border-brand-tan/10 space-y-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-tan/60" />
                <p className="text-sm font-semibold text-brand-cream/80">Group Kitty Contribution</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-brand-black/40 rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-brand-cream/40 mb-1">Your share</p>
                  <p className="text-xl font-bold text-brand-cream">{fmt(kittyShare)}</p>
                </div>
                <div className="bg-brand-black/40 rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-brand-cream/40 mb-1">Paid</p>
                  <p className={`text-xl font-bold ${paid > 0 ? 'text-brand-tan' : 'text-brand-cream/40'}`}>{fmt(paid)}</p>
                </div>
                <div className="bg-brand-black/40 rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-brand-cream/40 mb-1">Remaining</p>
                  <p className={`text-xl font-bold ${kittyRemaining <= 0 ? 'text-green-400' : 'text-amber-400'}`}>
                    {kittyRemaining <= 0 ? fmtDec(0) : fmt(kittyRemaining)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-brand-cream/40 mb-1.5">
                  <span>{paidPct}% paid toward kitty</span>
                  {kittyRemaining <= 0 && (
                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully paid
                    </span>
                  )}
                </div>
                <div className="w-full h-3 bg-brand-black rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${kittyRemaining <= 0 ? 'bg-green-500' : 'bg-brand-tan'}`}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Personal items section ───────────────────────────────────── */}
          {personalShare > 0 && (
            <div className="px-6 py-5 border-t border-brand-tan/10 space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400/70" />
                <p className="text-sm font-semibold text-brand-cream/80">Personal Items</p>
                <span className="text-xs text-brand-cream/35">— you arrange and pay these directly</span>
              </div>

              {personalCategories.length > 0 ? (
                <div className="space-y-1">
                  {personalCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between py-2 border-b border-brand-tan/5 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm text-brand-cream/80">{cat.name}</span>
                      </div>
                      <span className="text-sm text-purple-300 font-medium">
                        ~{fmt(cat.personal_planned_aud ?? 0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-brand-cream/35 uppercase tracking-wider">Personal total</span>
                    <span className="text-sm font-semibold text-purple-300">~{fmt(personalShare)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-purple-900/15 border border-purple-500/20 rounded-lg px-4 py-3">
                  <p className="text-2xl font-bold text-purple-200">~{fmt(personalShare)}</p>
                  <p className="text-xs text-brand-cream/40 mt-1">Budget yourself for personal items not covered by the group kitty</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Cost tracker checklist ─────────────────────────────────────────── */}
      {hasCostItems && (
        <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-tan/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-tan/60" />
              <p className="font-semibold text-brand-cream text-sm">Your Checklist</p>
            </div>
            <span className="text-xs text-brand-cream/40">
              {selfFundedCount} of {member_cost_items.length} confirmed
            </span>
          </div>

          <div className="divide-y divide-brand-tan/5">
            {member_cost_items.map((item) => (
              <div key={item.id} className={`flex items-start gap-3 px-5 py-3.5 ${item.is_self_funded ? '' : 'opacity-60'}`}>
                <div className="flex-shrink-0 mt-0.5">
                  {item.is_self_funded
                    ? <Check className="w-4 h-4 text-green-400" />
                    : <Circle className="w-4 h-4 text-brand-cream/25" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.is_self_funded ? 'text-brand-cream' : 'text-brand-cream/50'}`}>
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-xs text-brand-cream/35 mt-0.5">{item.description}</p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-brand-tan/60 mt-0.5 italic">{item.notes}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 text-xs font-medium mt-0.5 ${item.is_self_funded ? 'text-green-400' : 'text-brand-cream/25'}`}>
                  {item.is_self_funded ? 'Sorted' : 'Pending'}
                </span>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-brand-black/20 border-t border-brand-tan/10">
            <p className="text-xs text-brand-cream/35">
              Your organiser manages this list. Items marked Sorted mean you&apos;ve confirmed you&apos;re handling them.
            </p>
          </div>
        </div>
      )}

      {/* ── Group budget overview (only if admin has made it visible) ──────── */}
      {visibility.show_group && overview && (
        <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-tan/10 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-tan/60" />
            <p className="font-semibold text-brand-cream text-sm">Group Budget Overview</p>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Budget split */}
            {(overview.total_group_planned_aud !== undefined || overview.total_personal_planned_aud !== undefined) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-brand-black/30 rounded-lg p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-brand-tan/50" />
                    <p className="text-[11px] uppercase tracking-wider text-brand-cream/40">Group Kitty</p>
                  </div>
                  <p className="text-xl font-bold text-brand-cream">{fmt(overview.total_group_planned_aud ?? 0)}</p>
                  {overview.kitty_per_member_aud !== undefined && (
                    <p className="text-xs text-brand-cream/35 mt-0.5">{fmt(overview.kitty_per_member_aud)} per person</p>
                  )}
                </div>
                <div className="bg-brand-black/30 rounded-lg p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-purple-400/50" />
                    <p className="text-[11px] uppercase tracking-wider text-brand-cream/40">Personal</p>
                  </div>
                  <p className="text-xl font-bold text-purple-200">{fmt(overview.total_personal_planned_aud ?? 0)}</p>
                  {overview.personal_budget_per_member_aud !== undefined && (
                    <p className="text-xs text-brand-cream/35 mt-0.5">~{fmt(overview.personal_budget_per_member_aud)} per person</p>
                  )}
                </div>
              </div>
            )}

            {/* Spend progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-brand-cream/40 mb-1">
                <span>Group spend vs budget</span>
                <span className={overview.total_spent_aud > (overview.total_group_planned_aud ?? overview.total_budget_aud) ? 'text-red-400' : 'text-green-400'}>
                  {pct(overview.total_spent_aud, overview.total_group_planned_aud ?? overview.total_budget_aud)}%
                </span>
              </div>
              <div className="w-full h-2 bg-brand-black rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${overview.total_spent_aud > (overview.total_group_planned_aud ?? overview.total_budget_aud) ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${pct(overview.total_spent_aud, overview.total_group_planned_aud ?? overview.total_budget_aud)}%` }}
                />
              </div>
              <p className="text-xs text-brand-cream/30">
                {fmt(overview.total_spent_aud)} spent
                {' · '}
                {fmt(Math.max(0, (overview.total_group_planned_aud ?? overview.total_budget_aud) - overview.total_spent_aud))} remaining
              </p>
            </div>

            {/* Category breakdown */}
            {categories.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[11px] uppercase tracking-wider text-brand-cream/30 mb-2">By category</p>
                {categories.map((cat) => {
                  const groupAmt = cat.group_planned_aud ?? cat.planned_aud;
                  const spentPct = pct(cat.spent_aud, groupAmt);
                  if (groupAmt === 0 && (cat.personal_planned_aud ?? 0) === 0) return null;
                  return (
                    <div key={cat.id} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-brand-cream/60 flex-1 truncate">{cat.name}</span>
                      {(cat.personal_planned_aud ?? 0) > 0 && groupAmt === 0 ? (
                        <span className="text-xs text-purple-300/60">Personal</span>
                      ) : (
                        <>
                          <div className="w-20 h-1.5 bg-brand-black rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${cat.over_budget ? 'bg-red-500' : 'bg-brand-tan/50'}`}
                              style={{ width: `${spentPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-brand-cream/40 w-14 text-right flex-shrink-0">
                            {fmt(cat.spent_aud)}<span className="text-brand-cream/20">/{fmt(groupAmt)}</span>
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes from organiser */}
      {settings.notes && (() => {
        let notesText = settings.notes;
        try {
          const parsed = JSON.parse(settings.notes);
          if (typeof parsed?.notes_text === 'string') notesText = parsed.notes_text;
          else return null;
        } catch { /* plain text */ }
        if (!notesText?.trim()) return null;
        return (
          <div className="bg-brand-dark-grey/50 border border-brand-tan/10 rounded-xl px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-brand-cream/30 mb-2">Note from organiser</p>
            <p className="text-sm text-brand-cream/60">{notesText}</p>
          </div>
        );
      })()}

      {/* Nothing meaningful to show for this member */}
      {!hasCostItems && !visibility.show_group && (!visibility.show_individual || (!kittyShare && !personalShare)) && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <DollarSign className="w-10 h-10 text-brand-tan/20" />
          <p className="text-brand-cream/50 font-medium">Budget details coming soon</p>
          <p className="text-sm text-brand-cream/30">Your organiser will share cost information here</p>
        </div>
      )}

    </div>
  );
}
