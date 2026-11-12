'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Users, Calculator, Save, RefreshCw, Trash2, AlertTriangle, Check, ArrowDownToLine,
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';
import {
  splitTotal,
  type MemberBudgetsConfig, type MemberBudgetMode, type MemberBudgetSplitMethod,
} from '@/lib/budget/memberBudgets';
import { getMemberBreakdown, type CategoryLike } from '@/lib/budget/memberBreakdown';

interface TabMember {
  id: string;
  full_name: string | null;
  nickname: string | null;
}

type ConfirmFn = (opts: { title: string; message: string; confirmLabel?: string; variant?: 'danger' | 'warning' | 'info' }) => Promise<boolean>;

interface Props {
  members: TabMember[];
  categories: CategoryLike[];
  /** Saved config (null = none; payment targets come from the budget builder). */
  saved: MemberBudgetsConfig | null;
  /** Budget builder's kitty share per member (user_id → AUD), from the summary API. */
  builderShares: Record<string, number>;
  /** Amount each member has paid so far (user_id → AUD). */
  paidByMember: Record<string, number>;
  onSave: (config: MemberBudgetsConfig | null) => Promise<void>;
  confirm: ConfirmFn;
  onOpenBuilder?: () => void;
}

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const label = (m: TabMember) => m.nickname || m.full_name || 'Member';

function describe(config: MemberBudgetsConfig): string {
  const total = Object.values(config.amounts).reduce((s, n) => s + n, 0);
  const when = config.updated_at
    ? new Date(config.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'earlier';
  if (config.mode === 'split_total') {
    const how = config.split_method === 'builder' ? 'in proportion to the budget builder' : 'equally';
    return `${fmt(config.total_aud ?? total)} split ${how} (saved ${when})`;
  }
  return `amounts entered per member, ${fmt(total)} in total (saved ${when})`;
}

function Gap({ gap }: { gap: number | null }) {
  if (gap === null) return <span className="text-brand-cream/25">—</span>;
  if (Math.abs(gap) < 0.5) return <Check className="w-3.5 h-3.5 inline text-green-400" />;
  return (
    <span className={gap > 0 ? 'text-sky-300' : 'text-red-400'}>
      {gap > 0 ? '+' : '−'}{fmt(Math.abs(gap))}
    </span>
  );
}

export default function MemberBudgetsTab({
  members, categories, saved, builderShares, paidByMember, onSave, confirm, onOpenBuilder,
}: Props) {
  const sortedMembers = useMemo(() => [...members].sort((a, b) => label(a).localeCompare(label(b))), [members]);
  const memberIds = useMemo(() => sortedMembers.map((m) => m.id), [sortedMembers]);

  const [mode, setMode] = useState<MemberBudgetMode>(saved?.mode ?? 'per_member');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [totalInput, setTotalInput] = useState('');
  const [splitMethod, setSplitMethod] = useState<MemberBudgetSplitMethod>(saved?.split_method ?? 'equal');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Load the saved config into the form whenever it changes (e.g. after save / refresh)
  const savedKey = saved ? `${saved.updated_at}|${Object.keys(saved.amounts).length}` : 'none';
  useEffect(() => {
    const d: Record<string, string> = {};
    if (saved) for (const [id, n] of Object.entries(saved.amounts)) d[id] = String(n);
    setDrafts(d);
    setMode(saved?.mode ?? 'per_member');
    setSplitMethod(saved?.split_method ?? 'equal');
    setTotalInput(saved?.total_aud ? String(saved.total_aud) : '');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  // Category / line-item breakdown per member from the budget builder
  const breakdowns = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getMemberBreakdown>>();
    for (const id of memberIds) map.set(id, getMemberBreakdown(categories, id, memberIds));
    return map;
  }, [categories, memberIds]);

  const draftNum = (id: string) => {
    const v = drafts[id];
    if (v === undefined || v.trim() === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const rows = sortedMembers.map((m) => {
    const budget = draftNum(m.id);
    const builder = builderShares[m.id] ?? 0;
    const target = budget ?? builder;
    const paid = paidByMember[m.id] ?? 0;
    return { m, budget, builder, target, paid, remaining: Math.max(0, target - paid), gap: budget === null ? null : budget - builder };
  });
  const enteredCount = rows.filter((r) => r.budget !== null).length;
  const budgetsTotal = rows.reduce((s, r) => s + r.target, 0);
  const builderTotal = rows.reduce((s, r) => s + r.builder, 0);
  const paidTotal = rows.reduce((s, r) => s + r.paid, 0);
  const overallGap = budgetsTotal - builderTotal;

  const setDraft = (id: string, v: string) => {
    setDrafts((prev) => ({ ...prev, [id]: v }));
    setDirty(true);
  };

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allExpanded = expanded.size === memberIds.length && memberIds.length > 0;

  const handleCalculateSplit = async () => {
    const total = parseFloat(totalInput);
    if (!Number.isFinite(total) || total <= 0 || memberIds.length === 0) return;
    if (dirty && enteredCount > 0) {
      const ok = await confirm({
        title: 'Replace entered amounts?',
        message: 'This will replace the amounts currently in the form with the new split. Nothing is saved until you click Save.',
        confirmLabel: 'Replace',
        variant: 'warning',
      });
      if (!ok) return;
    }
    const split = splitTotal(total, memberIds, splitMethod === 'builder' ? builderShares : undefined);
    const d: Record<string, string> = {};
    for (const id of memberIds) d[id] = String(split[id]);
    setDrafts(d);
    setDirty(true);
  };

  const handleFillFromBuilder = () => {
    const d: Record<string, string> = {};
    for (const id of memberIds) d[id] = String(Math.round((builderShares[id] ?? 0) * 100) / 100);
    setDrafts(d);
    setDirty(true);
  };

  const handleSave = async () => {
    const amounts: Record<string, number> = {};
    for (const id of memberIds) {
      const n = draftNum(id);
      if (n !== null) amounts[id] = Math.round(n * 100) / 100;
    }
    if (Object.keys(amounts).length === 0) return;
    if (saved) {
      const ok = await confirm({
        title: 'Override last calculation?',
        message: `Member budgets were last set from ${describe(saved)}. Saving will replace those amounts. Continue?`,
        confirmLabel: 'Override',
        variant: 'warning',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const total = parseFloat(totalInput);
      await onSave({
        mode,
        amounts,
        total_aud: mode === 'split_total' && Number.isFinite(total) ? total : null,
        split_method: mode === 'split_total' ? splitMethod : null,
        updated_at: new Date().toISOString(),
      });
      setDirty(false);
    } catch {
      // Error already shown by the parent; leave the form dirty so Save can be retried
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Clear member budgets?',
      message: 'Payment targets will go back to the amounts calculated by the budget builder.',
      confirmLabel: 'Clear',
      variant: 'danger',
    });
    if (!ok) return;
    setSaving(true);
    try { await onSave(null); } catch { /* error shown by parent */ } finally { setSaving(false); }
  };

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-brand-tan/15 bg-brand-dark-grey p-8 text-center text-brand-cream/50 text-sm">
        No members found for this trip. Add members in the trip settings first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-cream flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-tan" /> Member Budgets
          </h2>
          <p className="mt-0.5 text-sm text-brand-cream/55 max-w-2xl">
            What each member pays into the kitty. An entered budget becomes that member&apos;s payment target; leave it blank to use the
            budget builder&apos;s figure. Expand a member to see their costs by category.
          </p>
          {saved && <p className="text-xs text-brand-tan/80 mt-1">Active: {describe(saved)}</p>}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-brand-tan/20 bg-brand-black/40 p-1 self-start">
          {([
            ['per_member', 'Enter per member'],
            ['split_total', 'Split a total'],
          ] as [MemberBudgetMode, string][]).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`px-3 py-1.5 rounded text-xs font-semibold ${mode === k ? 'bg-brand-tan text-brand-black' : 'text-brand-cream/50 hover:text-brand-cream'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: 'Member budgets', v: fmt(budgetsTotal), sub: `${enteredCount} of ${members.length} set`, cls: 'text-brand-cream' },
          { k: 'Budget builder', v: fmt(builderTotal), sub: 'allocated to line items', cls: 'text-brand-tan' },
          {
            k: 'Gap',
            v: Math.abs(overallGap) < 0.5 ? 'Balanced' : `${overallGap > 0 ? '+' : '−'}${fmt(Math.abs(overallGap))}`,
            sub: Math.abs(overallGap) < 0.5 ? 'budgets match the plan' : overallGap > 0 ? 'unallocated' : 'over member budgets',
            cls: Math.abs(overallGap) < 0.5 ? 'text-green-400' : overallGap > 0 ? 'text-sky-300' : 'text-red-400',
          },
          { k: 'Paid so far', v: fmt(paidTotal), sub: `${fmt(Math.max(0, budgetsTotal - paidTotal))} to collect`, cls: 'text-green-400' },
        ].map((c) => (
          <div key={c.k} className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-brand-cream/45">{c.k}</p>
            <p className={`text-xl font-bold mt-0.5 ${c.cls}`}>{c.v}</p>
            <p className="text-[11px] text-brand-cream/35">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Split a total */}
      {mode === 'split_total' && (
        <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey px-4 py-3 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[11px] text-brand-cream/50 uppercase tracking-wider mb-1">Group total (AUD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
              <input
                type="number" min={0} step="100"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                className="w-44 pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-sm focus:outline-none focus:ring-2 focus:ring-brand-tan"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-brand-cream/50 uppercase tracking-wider mb-1">Split</label>
            <div className="flex flex-wrap items-center gap-4 py-2">
              <label className="flex items-center gap-1.5 text-xs text-brand-cream/70 cursor-pointer">
                <input type="radio" checked={splitMethod === 'equal'} onChange={() => setSplitMethod('equal')} />
                Equally
              </label>
              <label className="flex items-center gap-1.5 text-xs text-brand-cream/70 cursor-pointer" title="Members with more costs in the budget builder (e.g. return flights) get a bigger share">
                <input type="radio" checked={splitMethod === 'builder'} onChange={() => setSplitMethod('builder')} />
                In proportion to budget builder
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCalculateSplit}
            disabled={!(parseFloat(totalInput) > 0)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-tan/40 text-brand-cream text-xs font-semibold hover:bg-brand-tan/10 disabled:opacity-40"
          >
            <Calculator className="w-3.5 h-3.5" /> Calculate split
          </button>
        </div>
      )}

      {/* Imbalance */}
      {Math.abs(overallGap) >= 0.5 && enteredCount > 0 && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs ${overallGap > 0 ? 'border-sky-500/25 bg-sky-900/15 text-sky-200/90' : 'border-red-500/25 bg-red-900/15 text-red-200/90'}`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {overallGap > 0
              ? <>Member budgets are <strong>{fmt(overallGap)} more</strong> than the budget builder plans to spend from the kitty. Allocate the extra in the budget builder (add line items, or member-specific items for members with a gap).</>
              : <>Member budgets are <strong>{fmt(-overallGap)} short</strong> of what the budget builder plans to spend from the kitty. Raise budgets or trim line items in the budget builder.</>}
            {onOpenBuilder && (
              <button type="button" onClick={onOpenBuilder} className="ml-1.5 underline font-semibold">Open budget builder →</button>
            )}
          </span>
        </div>
      )}

      {/* Member accordion table */}
      <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-brand-black">
              <tr className="text-[11px] uppercase tracking-wider text-brand-cream/40">
                <th className="pl-3 pr-1 py-2.5 w-8">
                  <button
                    type="button"
                    onClick={() => setExpanded(allExpanded ? new Set() : new Set(memberIds))}
                    className="text-brand-cream/40 hover:text-brand-cream"
                    title={allExpanded ? 'Collapse all' : 'Expand all'}
                  >
                    {allExpanded ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">Member</th>
                <th className="px-3 py-2.5 text-left font-semibold">Member budget</th>
                <th className="px-3 py-2.5 text-right font-semibold">Budget builder</th>
                <th className="px-3 py-2.5 text-right font-semibold">Gap</th>
                <th className="px-3 py-2.5 text-right font-semibold">Paid</th>
                <th className="px-3 py-2.5 text-right font-semibold">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, builder, paid, remaining, gap }) => {
                const isOpen = expanded.has(m.id);
                const cats = breakdowns.get(m.id) ?? [];
                const kittyTotal = cats.reduce((s, c) => s + c.kitty_aud, 0);
                const personalTotal = cats.reduce((s, c) => s + c.personal_aud, 0);
                return (
                  <Fragment key={m.id}>
                    <tr
                      className={`border-t border-brand-tan/10 cursor-pointer ${isOpen ? 'bg-brand-tan/5' : 'hover:bg-brand-tan/5'}`}
                      onClick={() => toggle(m.id)}
                    >
                      <td className="pl-3 pr-1 py-2.5 text-brand-cream/40">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-brand-cream">{label(m)}</td>
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="relative w-36">
                          <span className="absolute left-2.5 top-1.5 text-brand-cream/40 text-sm">$</span>
                          <input
                            type="number" min={0} step="0.01"
                            value={drafts[m.id] ?? ''}
                            placeholder={String(Math.round(builder))}
                            onChange={(e) => setDraft(m.id, e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 bg-brand-black border border-brand-tan/25 rounded text-brand-cream text-sm placeholder:text-brand-cream/20 focus:outline-none focus:ring-2 focus:ring-brand-tan"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-brand-cream/60">{fmt(builder)}</td>
                      <td className="px-3 py-2.5 text-right"><Gap gap={gap} /></td>
                      <td className="px-3 py-2.5 text-right text-brand-tan font-semibold">{fmt(paid)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={remaining <= 0 ? 'text-green-400' : 'text-amber-400'}>{remaining <= 0 ? 'Paid' : fmt(remaining)}</span>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-brand-black/30">
                        <td />
                        <td colSpan={6} className="px-3 pb-4 pt-1">
                          {cats.length === 0 ? (
                            <p className="text-xs text-brand-cream/40 py-2">No budget builder line items apply to {label(m)} yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {cats.map((c) => (
                                <div key={c.id} className="rounded-lg border border-brand-tan/10 overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-1.5 bg-brand-black/40">
                                    <span className="flex items-center gap-2 text-xs font-semibold text-brand-cream">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                      {c.name}
                                    </span>
                                    <span className="text-xs">
                                      {c.kitty_aud > 0 && <span className="text-brand-tan font-semibold">{fmt(c.kitty_aud)}</span>}
                                      {c.personal_aud > 0 && <span className="text-purple-300 font-semibold ml-2">{fmt(c.personal_aud)} personal</span>}
                                    </span>
                                  </div>
                                  <ul className="divide-y divide-brand-tan/5">
                                    {c.items.map((it) => (
                                      <li key={it.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                        <span className="text-brand-cream/75 flex flex-wrap items-center gap-1.5">
                                          {it.name}
                                          {it.payment_type === 'personal' && <span className="px-1.5 rounded bg-purple-900/30 text-purple-300 text-[10px]">Personal</span>}
                                          {!it.billed && <span className="px-1.5 rounded bg-amber-900/30 text-amber-300 text-[10px]">Not billed</span>}
                                          {it.assigned && <span className="px-1.5 rounded bg-sky-900/30 text-sky-300 text-[10px]">Selected members</span>}
                                          {it.basis === 'group' && <span className="text-brand-cream/30 text-[10px]">share of fixed cost</span>}
                                        </span>
                                        <span className={
                                          it.payment_type === 'personal' ? 'text-purple-300' : it.billed ? 'text-brand-cream' : 'text-brand-cream/35 line-through'
                                        }>
                                          {fmt(it.share_aud)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                              <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 pt-1 text-xs">
                                <span className="text-brand-cream/50">Kitty <span className="text-brand-tan font-semibold">{fmt(kittyTotal)}</span></span>
                                {personalTotal > 0 && (
                                  <span className="text-brand-cream/50">Personal <span className="text-purple-300 font-semibold">{fmt(personalTotal)}</span></span>
                                )}
                                <span className="text-brand-cream/50">Total trip cost <span className="text-brand-cream font-semibold">{fmt(kittyTotal + personalTotal)}</span></span>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-brand-tan/20 bg-brand-black/30 text-sm">
                <td />
                <td className="px-3 py-2.5 text-xs text-brand-cream/50">Totals</td>
                <td className="px-3 py-2.5 font-semibold text-brand-cream">{fmt(budgetsTotal)}</td>
                <td className="px-3 py-2.5 text-right text-brand-cream/60">{fmt(builderTotal)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">
                  {Math.abs(overallGap) < 0.5
                    ? <span className="text-green-400">Balanced</span>
                    : <Gap gap={overallGap} />}
                </td>
                <td className="px-3 py-2.5 text-right text-brand-tan font-semibold">{fmt(paidTotal)}</td>
                <td className="px-3 py-2.5 text-right text-amber-400">{fmt(rows.reduce((s, r) => s + r.remaining, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-brand-tan/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleFillFromBuilder} className="flex items-center gap-1 text-xs text-brand-cream/50 hover:text-brand-cream">
              <ArrowDownToLine className="w-3.5 h-3.5" /> Fill from budget builder
            </button>
            {saved && (
              <button type="button" onClick={handleClear} disabled={saving} className="flex items-center gap-1 text-xs text-brand-cream/40 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> Clear member budgets
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-[11px] text-amber-400/80">Unsaved changes</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || enteredCount === 0 || !dirty}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-tan text-brand-black text-xs font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-40"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save member budgets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
