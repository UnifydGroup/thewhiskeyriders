'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Calculator, Save, RefreshCw, Trash2, AlertTriangle, Check, ArrowDownToLine } from 'lucide-react';
import {
  splitTotal,
  type MemberBudgetsConfig, type MemberBudgetMode, type MemberBudgetSplitMethod,
} from '@/lib/budget/memberBudgets';

interface PanelMember {
  id: string;
  full_name: string | null;
  nickname: string | null;
}

interface Props {
  members: PanelMember[];
  /** Saved config (null = none; payment targets come from the budget builder). */
  saved: MemberBudgetsConfig | null;
  /** Budget builder's computed kitty share per member (user_id → AUD). */
  builderShares: Record<string, number>;
  onSave: (config: MemberBudgetsConfig | null) => Promise<void>;
  confirm: (opts: { title: string; message: string; confirmLabel?: string; variant?: 'danger' | 'warning' | 'info' }) => Promise<boolean>;
  onOpenBuilder?: () => void;
}

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const label = (m: PanelMember) => m.nickname || m.full_name || 'Member';

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

export default function MemberBudgetsPanel({ members, saved, builderShares, onSave, confirm, onOpenBuilder }: Props) {
  const sortedMembers = useMemo(() => [...members].sort((a, b) => label(a).localeCompare(label(b))), [members]);
  const memberIds = useMemo(() => sortedMembers.map((m) => m.id), [sortedMembers]);

  const [mode, setMode] = useState<MemberBudgetMode>(saved?.mode ?? 'per_member');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [totalInput, setTotalInput] = useState('');
  const [splitMethod, setSplitMethod] = useState<MemberBudgetSplitMethod>(saved?.split_method ?? 'equal');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  const draftNum = (id: string) => {
    const v = drafts[id];
    if (v === undefined || v.trim() === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const rows = sortedMembers.map((m) => {
    const budget = draftNum(m.id);
    const builder = builderShares[m.id] ?? 0;
    return { m, budget, builder, gap: budget === null ? null : budget - builder };
  });
  const enteredCount = rows.filter((r) => r.budget !== null).length;
  const budgetsTotal = rows.reduce((s, r) => s + (r.budget ?? r.builder), 0);
  const builderTotal = rows.reduce((s, r) => s + r.builder, 0);
  const overallGap = budgetsTotal - builderTotal;

  const setDraft = (id: string, v: string) => {
    setDrafts((prev) => ({ ...prev, [id]: v }));
    setDirty(true);
  };

  const askOverride = async (action: string): Promise<boolean> => {
    if (!saved) return true;
    return confirm({
      title: 'Override last calculation?',
      message: `Member budgets were last set from ${describe(saved)}. ${action} will replace those amounts. Continue?`,
      confirmLabel: 'Override',
      variant: 'warning',
    });
  };

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
    if (!(await askOverride('Saving'))) return;
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
    try { await onSave(null); } finally { setSaving(false); }
  };

  if (members.length === 0) return null;

  return (
    <div className="rounded-lg border border-brand-tan/20 bg-brand-black/20">
      <div className="px-4 py-3 border-b border-brand-tan/10 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-cream flex items-center gap-1.5">
            <Users className="w-4 h-4 text-brand-tan" /> Member Budgets
          </p>
          <p className="text-xs text-brand-cream/45 mt-0.5 max-w-xl">
            What each member pays into the kitty. Entered amounts replace the budget builder&apos;s figure as that member&apos;s payment target.
            Blank = use the budget builder.
          </p>
          {saved && (
            <p className="text-[11px] text-brand-tan/70 mt-1">Active: {describe(saved)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-brand-tan/20 bg-brand-black/40 p-0.5">
          {([
            ['per_member', 'Enter per member'],
            ['split_total', 'Split a total'],
          ] as [MemberBudgetMode, string][]).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`px-3 py-1 rounded text-xs font-semibold ${mode === k ? 'bg-brand-tan text-brand-black' : 'text-brand-cream/50 hover:text-brand-cream'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {mode === 'split_total' && (
        <div className="px-4 py-3 border-b border-brand-tan/10 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-brand-cream/50 uppercase tracking-wider mb-1">Group total (AUD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
              <input
                type="number" min={0} step="100"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                className="w-40 pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-sm focus:outline-none focus:ring-2 focus:ring-brand-tan"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-brand-cream/50 uppercase tracking-wider mb-1">Split</label>
            <div className="flex items-center gap-3 py-2">
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-brand-black/30 text-[11px] uppercase tracking-wider text-brand-cream/40">
              <th className="px-4 py-2 text-left font-semibold">Member</th>
              <th className="px-4 py-2 text-left font-semibold">Member budget</th>
              <th className="px-4 py-2 text-right font-semibold">Budget builder</th>
              <th className="px-4 py-2 text-right font-semibold">Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-tan/5">
            {rows.map(({ m, budget, builder, gap }) => (
              <tr key={m.id}>
                <td className="px-4 py-2 text-brand-cream">{label(m)}</td>
                <td className="px-4 py-1.5">
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
                <td className="px-4 py-2 text-right text-brand-cream/60">{fmt(builder)}</td>
                <td className="px-4 py-2 text-right">
                  {gap === null || Math.abs(gap) < 0.5
                    ? <span className="text-brand-cream/25">{gap === null ? '—' : <Check className="w-3.5 h-3.5 inline text-green-400" />}</span>
                    : <span className={gap > 0 ? 'text-sky-300' : 'text-red-400'}>{gap > 0 ? '+' : '−'}{fmt(Math.abs(gap))}</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-brand-tan/15 bg-brand-black/20 text-sm">
              <td className="px-4 py-2 text-brand-cream/50 text-xs">{enteredCount} of {members.length} set</td>
              <td className="px-4 py-2 font-semibold text-brand-cream">{fmt(budgetsTotal)}</td>
              <td className="px-4 py-2 text-right text-brand-cream/60">{fmt(builderTotal)}</td>
              <td className="px-4 py-2 text-right font-semibold">
                {Math.abs(overallGap) < 0.5
                  ? <span className="text-green-400">Balanced</span>
                  : <span className={overallGap > 0 ? 'text-sky-300' : 'text-red-400'}>{overallGap > 0 ? '+' : '−'}{fmt(Math.abs(overallGap))}</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {Math.abs(overallGap) >= 0.5 && enteredCount > 0 && (
        <div className={`mx-4 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${overallGap > 0 ? 'border-sky-500/25 bg-sky-900/15 text-sky-200/90' : 'border-red-500/25 bg-red-900/15 text-red-200/90'}`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {overallGap > 0
              ? <>Member budgets are <strong>{fmt(overallGap)} more</strong> than the budget builder plans to spend from the kitty. Allocate the extra in the budget builder (e.g. add line items, or member-specific items for members with a gap).</>
              : <>Member budgets are <strong>{fmt(-overallGap)} short</strong> of what the budget builder plans to spend from the kitty. Raise budgets or trim line items in the budget builder.</>}
            {onOpenBuilder && (
              <button type="button" onClick={onOpenBuilder} className="ml-1.5 underline font-semibold">Open budget builder →</button>
            )}
          </span>
        </div>
      )}

      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
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
  );
}
