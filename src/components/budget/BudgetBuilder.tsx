'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, X, ChevronDown, ChevronUp,
  Users, Eye, EyeOff, AlertTriangle, Check, RefreshCw,
  DollarSign, Wallet, User, BookOpen,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type BudgetPartBasis = 'per_person' | 'group';
type BudgetPaymentType = 'group' | 'personal';

interface BudgetPart {
  id: string;
  name: string;
  basis: BudgetPartBasis;
  amount_aud: number;
  member_count: number;
  payment_type: BudgetPaymentType;
}

export interface BudgetCategory {
  id: string;
  name: string;
  planned_aud: number;
  color: string;
  sort_order: number;
  notes: string | null;
  spent_aud?: number;
  remaining_aud?: number;
  over_budget?: boolean;
}

export interface BudgetOverview {
  member_count: number;
  total_budget_aud: number;
  total_spent_aud?: number;
}

export interface BudgetBuilderSettings {
  total_budget_aud: number;
  per_person_budget_aud: number;
  show_group_budget_to_members: boolean;
  show_individual_breakdown_to_members: boolean;
  projected_member_count?: number | null;
  notes: string | null;
  exchange_rate_mad_aud: number;
  enabled_currencies: string[];
}

// Collapsed coverage type — replaces confusing basis × payment_type matrix
type CoverageType = 'kitty_per_person' | 'kitty_fixed' | 'personal';

const COVERAGE_LABELS: Record<CoverageType, { label: string; hint: string; color: string }> = {
  kitty_per_person: { label: 'Group Kitty · per person', hint: 'Each member contributes this to the group kitty', color: 'text-brand-tan' },
  kitty_fixed:      { label: 'Group Kitty · fixed total', hint: 'Fixed shared cost covered by the group kitty', color: 'text-brand-tan' },
  personal:         { label: 'Personal · per person',    hint: 'Each member arranges and pays this themselves', color: 'text-purple-300' },
};

const CATEGORY_COLORS = [
  '#B5621E', '#C9B98A', '#6B8E6B', '#6B7FAE',
  '#AE6B6B', '#AE8B6B', '#8B6BAE', '#6BAEAE', '#AE6BAE', '#888888',
];

const DEFAULT_CATEGORIES = [
  { name: 'Flights',              color: '#6B7FAE' },
  { name: 'Accommodation',        color: '#6B8E6B' },
  { name: 'Ground Transport',     color: '#B5621E' },
  { name: 'Guides & Experiences', color: '#AE8B6B' },
  { name: 'Food & Drink',         color: '#C9B98A' },
  { name: 'Gear & Equipment',     color: '#8B6BAE' },
  { name: 'Visas & Insurance',    color: '#6BAEAE' },
  { name: 'Contingency',          color: '#888888' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function coverageFromPart(part: BudgetPart): CoverageType {
  if (part.payment_type === 'personal') return 'personal';
  if (part.basis === 'group') return 'kitty_fixed';
  return 'kitty_per_person';
}

function partBasisAndType(coverage: CoverageType): { basis: BudgetPartBasis; payment_type: BudgetPaymentType } {
  if (coverage === 'kitty_fixed') return { basis: 'group',      payment_type: 'group' };
  if (coverage === 'personal')    return { basis: 'per_person', payment_type: 'personal' };
  return                                 { basis: 'per_person', payment_type: 'group' };
}

function getPartTotal(part: BudgetPart, memberCount: number): number {
  if (part.basis === 'per_person') return Number(part.amount_aud) * memberCount;
  return Number(part.amount_aud);
}

// Per-person contribution to the cost summary for a single part
function getPartPerPerson(part: BudgetPart, memberCount: number): number {
  if (part.payment_type === 'personal') {
    // Personal items: per_person amount IS the per-person cost; fixed personal → divide
    return part.basis === 'per_person' ? Number(part.amount_aud) : (memberCount > 0 ? Number(part.amount_aud) / memberCount : 0);
  }
  // Group kitty: total / members = each member's kitty share from this part
  return memberCount > 0 ? getPartTotal(part, memberCount) / memberCount : 0;
}

function parseCategoryNotes(
  rawNotes: string | null,
  plannedAud: number,
  defaultMemberCount: number,
): { notesText: string; parts: BudgetPart[]; committed_aud: number } {
  const fallback: BudgetPart = {
    id: 'fallback',
    name: 'Main',
    basis: 'group',
    amount_aud: Number(plannedAud) || 0,
    member_count: Math.max(1, defaultMemberCount),
    payment_type: 'group',
  };

  if (!rawNotes) return { notesText: '', parts: [fallback], committed_aud: 0 };

  try {
    const parsed = JSON.parse(rawNotes) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const partsRaw = Array.isArray(parsed.parts) ? parsed.parts : [];
      const parts: BudgetPart[] = (partsRaw as Record<string, unknown>[])
        .map((p) => ({
          id: (typeof p.id === 'string' ? p.id : null) || `part-${Math.random().toString(36).slice(2)}`,
          name: ((typeof p.name === 'string' ? p.name : '') || '').trim(),
          basis: (p.basis === 'group' ? 'group' : 'per_person') as BudgetPartBasis,
          amount_aud: Math.max(0, Number(p.amount_aud) || 0),
          member_count: Math.max(1, Number(p.member_count) || defaultMemberCount),
          payment_type: (p.payment_type === 'personal' ? 'personal' : 'group') as BudgetPaymentType,
        }))
        .filter((p) => p.name.length > 0 || p.amount_aud > 0);
      return {
        notesText: typeof parsed.notes_text === 'string' ? parsed.notes_text : '',
        parts: parts.length > 0 ? parts : [fallback],
        committed_aud: typeof parsed.committed_aud === 'number' ? parsed.committed_aud : 0,
      };
    }
  } catch { /* fall through */ }

  return { notesText: rawNotes, parts: [fallback], committed_aud: 0 };
}

function encodeCategoryNotes(parts: BudgetPart[], notesText: string, committedAud: number): string {
  return JSON.stringify({
    notes_text: notesText.trim() || null,
    parts,
    committed_aud: committedAud || null,
  });
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

function fmtDec(n: number) {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component props ───────────────────────────────────────────────────────────

interface Props {
  tripId: string;
  categories: BudgetCategory[];
  overview: BudgetOverview | null;
  settings: BudgetBuilderSettings;
  onRefresh: () => void;
  onSettingsUpdate: (partial: Partial<BudgetBuilderSettings>) => Promise<void>;
  getAuthHeader: () => Promise<Record<string, string>>;
}

// ── BudgetBuilder ─────────────────────────────────────────────────────────────

export default function BudgetBuilder({
  tripId, categories, overview, settings, onRefresh, onSettingsUpdate, getAuthHeader,
}: Props) {

  const actualMemberCount = Math.max(1, overview?.member_count ?? 1);
  const storedProjected   = settings.projected_member_count ?? null;

  // Planning mode: when a projected count is stored and differs from actual
  const [isPlanning, setIsPlanning] = useState<boolean>(
    storedProjected !== null && storedProjected !== actualMemberCount,
  );
  const [projectedInput, setProjectedInput] = useState<string>(
    String(storedProjected ?? actualMemberCount),
  );
  const [savingMode, setSavingMode]     = useState(false);
  const [savingVis, setSavingVis]       = useState(false);

  const workingMemberCount = isPlanning
    ? Math.max(1, parseInt(projectedInput, 10) || 1)
    : actualMemberCount;

  // Sync if parent settings change (e.g. after save)
  useEffect(() => {
    const sp = settings.projected_member_count ?? null;
    if (sp !== null && sp !== actualMemberCount) {
      setIsPlanning(true);
      setProjectedInput(String(sp));
    }
  }, [settings.projected_member_count, actualMemberCount]);

  // ── Category expansion ──────────────────────────────────────────────────────
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.id)),
  );

  // Expand newly added categories
  const prevCatIds = useRef<Set<string>>(new Set(categories.map((c) => c.id)));
  useEffect(() => {
    const newIds = categories.map((c) => c.id).filter((id) => !prevCatIds.current.has(id));
    if (newIds.length > 0) {
      setExpandedCats((prev) => new Set([...prev, ...newIds]));
    }
    prevCatIds.current = new Set(categories.map((c) => c.id));
  }, [categories]);

  const toggleCat = (id: string) =>
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Category form ───────────────────────────────────────────────────────────
  const [showCatForm, setShowCatForm]   = useState(false);
  const [editingCat, setEditingCat]     = useState<BudgetCategory | null>(null);
  const [catName, setCatName]           = useState('');
  const [catColor, setCatColor]         = useState(CATEGORY_COLORS[0]);
  const [savingCat, setSavingCat]       = useState(false);
  const catNameRef = useRef<HTMLInputElement>(null);

  const openNewCatForm = () => {
    setEditingCat(null);
    setCatName('');
    setCatColor(CATEGORY_COLORS[0]);
    setShowCatForm(true);
    setTimeout(() => catNameRef.current?.focus(), 50);
  };

  const openEditCatForm = (cat: BudgetCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCat(cat);
    setCatName(cat.name);
    setCatColor(cat.color);
    setShowCatForm(true);
    setTimeout(() => catNameRef.current?.focus(), 50);
  };

  const handleSaveCat = async () => {
    if (!catName.trim()) return;
    setSavingCat(true);
    const h = await getAuthHeader();
    try {
      if (editingCat) {
        await fetch(`/api/trips/${tripId}/budget/categories/${editingCat.id}`, {
          method: 'PUT',
          headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName.trim(), color: catColor }),
        });
      } else {
        await fetch(`/api/trips/${tripId}/budget/categories`, {
          method: 'POST',
          headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: catName.trim(),
            color: catColor,
            planned_aud: 0,
            sort_order: categories.length,
          }),
        });
      }
      setShowCatForm(false);
      onRefresh();
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const h = await getAuthHeader();
    await fetch(`/api/trips/${tripId}/budget/categories/${catId}`, { method: 'DELETE', headers: h });
    onRefresh();
  };

  const handleSeedCategories = async () => {
    const h = await getAuthHeader();
    await Promise.all(
      DEFAULT_CATEGORIES.map((c, i) =>
        fetch(`/api/trips/${tripId}/budget/categories`, {
          method: 'POST',
          headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: c.name, color: c.color, planned_aud: 0, sort_order: i }),
        }),
      ),
    );
    onRefresh();
  };

  // ── Line-item form ──────────────────────────────────────────────────────────
  // editingPart: { catId, partId } — partId null = new
  const [editingPart, setEditingPart] = useState<{ catId: string; partId: string | null } | null>(null);
  const [partName, setPartName]       = useState('');
  const [partCoverage, setPartCoverage] = useState<CoverageType>('kitty_per_person');
  const [partAmount, setPartAmount]   = useState('');
  const [savingPart, setSavingPart]   = useState(false);
  const partNameRef = useRef<HTMLInputElement>(null);

  const openAddPart = (catId: string) => {
    setEditingPart({ catId, partId: null });
    setPartName('');
    setPartCoverage('kitty_per_person');
    setPartAmount('');
    setTimeout(() => partNameRef.current?.focus(), 50);
  };

  const openEditPart = (catId: string, part: BudgetPart, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPart({ catId, partId: part.id });
    setPartName(part.name);
    setPartCoverage(coverageFromPart(part));
    setPartAmount(String(part.amount_aud));
    setTimeout(() => partNameRef.current?.focus(), 50);
  };

  const cancelPartEdit = () => setEditingPart(null);

  const saveCatParts = useCallback(async (catId: string, parts: BudgetPart[], notesText = '', committedAud = 0) => {
    const h = await getAuthHeader();
    // planned_aud = total group kitty (what gets drawn from the kitty for this category)
    const plannedAud = parts
      .filter((p) => p.payment_type === 'group')
      .reduce((s, p) => s + getPartTotal(p, workingMemberCount), 0);
    await fetch(`/api/trips/${tripId}/budget/categories/${catId}`, {
      method: 'PUT',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planned_aud: plannedAud,
        notes: encodeCategoryNotes(parts, notesText, committedAud),
      }),
    });
    onRefresh();
  }, [tripId, getAuthHeader, workingMemberCount, onRefresh]);

  const handleSavePart = async () => {
    if (!editingPart || !partName.trim()) return;
    const cat = categories.find((c) => c.id === editingPart.catId);
    if (!cat) return;

    setSavingPart(true);
    try {
      const { parts: existing, notesText, committed_aud } = parseCategoryNotes(
        cat.notes, cat.planned_aud, workingMemberCount,
      );

      const { basis, payment_type } = partBasisAndType(partCoverage);
      const newPart: BudgetPart = {
        id: editingPart.partId ?? `part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name:    partName.trim(),
        basis,
        amount_aud: parseFloat(partAmount) || 0,
        member_count: workingMemberCount,
        payment_type,
      };

      let updated: BudgetPart[];
      if (editingPart.partId) {
        updated = existing.map((p) => (p.id === editingPart.partId ? newPart : p));
      } else {
        // Drop the empty fallback part if it has no name/amount
        const nonEmpty = existing.filter((p) => p.name.length > 0 || p.amount_aud > 0);
        updated = [...nonEmpty, newPart];
      }

      await saveCatParts(cat.id, updated, notesText, committed_aud);
      setEditingPart(null);
    } finally {
      setSavingPart(false);
    }
  };

  const handleDeletePart = async (catId: string, partId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const { parts, notesText, committed_aud } = parseCategoryNotes(cat.notes, cat.planned_aud, workingMemberCount);
    await saveCatParts(catId, parts.filter((p) => p.id !== partId), notesText, committed_aud);
  };

  // ── Settings updates ────────────────────────────────────────────────────────
  const handleSaveMemberCount = async () => {
    setSavingMode(true);
    try {
      const count = parseInt(projectedInput, 10) || actualMemberCount;
      await onSettingsUpdate({ projected_member_count: isPlanning ? count : null });
    } finally {
      setSavingMode(false);
    }
  };

  const handleTogglePlanning = async (planning: boolean) => {
    setIsPlanning(planning);
    setSavingMode(true);
    try {
      await onSettingsUpdate({
        projected_member_count: planning ? (parseInt(projectedInput, 10) || actualMemberCount) : null,
      });
    } finally {
      setSavingMode(false);
    }
  };

  const handleToggleVisibility = async () => {
    setSavingVis(true);
    try {
      await onSettingsUpdate({ show_group_budget_to_members: !settings.show_group_budget_to_members });
    } finally {
      setSavingVis(false);
    }
  };

  // ── Budget summary ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let groupKittyTotal = 0;
    let personalPerPerson = 0;

    for (const cat of categories) {
      const { parts } = parseCategoryNotes(cat.notes, cat.planned_aud, workingMemberCount);
      for (const part of parts) {
        if (part.payment_type === 'group') {
          groupKittyTotal += part.basis === 'per_person'
            ? Number(part.amount_aud) * workingMemberCount
            : Number(part.amount_aud);
        } else {
          // personal
          personalPerPerson += part.basis === 'per_person'
            ? Number(part.amount_aud)
            : (workingMemberCount > 0 ? Number(part.amount_aud) / workingMemberCount : 0);
        }
      }
    }

    const kittyPerPerson  = workingMemberCount > 0 ? groupKittyTotal / workingMemberCount : 0;
    const totalPerPerson  = kittyPerPerson + personalPerPerson;
    const totalTripCost   = groupKittyTotal + personalPerPerson * workingMemberCount;

    return { groupKittyTotal, kittyPerPerson, personalPerPerson, totalPerPerson, totalTripCost };
  }, [categories, workingMemberCount]);

  // Per-category breakdown for display
  const getCatSummary = useCallback((cat: BudgetCategory) => {
    const { parts } = parseCategoryNotes(cat.notes, cat.planned_aud, workingMemberCount);
    let groupTotal = 0;
    let personalTotal = 0;
    for (const p of parts) {
      if (p.payment_type === 'group') {
        groupTotal += p.basis === 'per_person' ? Number(p.amount_aud) * workingMemberCount : Number(p.amount_aud);
      } else {
        personalTotal += p.basis === 'per_person' ? Number(p.amount_aud) : (workingMemberCount > 0 ? Number(p.amount_aud) / workingMemberCount : 0);
      }
    }
    return { parts, groupTotal, personalTotal };
  }, [workingMemberCount]);

  // ── Part amount label ───────────────────────────────────────────────────────
  const partAmountLabel = (coverage: CoverageType) =>
    coverage === 'kitty_fixed' ? 'Fixed total (AUD)' : 'Amount per person (AUD)';

  const partRowTotal = (coverage: CoverageType, amount: number) => {
    if (coverage === 'kitty_per_person') return amount * workingMemberCount;
    return amount;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        {/* Planning mode toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-brand-tan/20 bg-brand-black/40 p-1">
            <button
              onClick={() => handleTogglePlanning(false)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all ${
                !isPlanning
                  ? 'bg-brand-tan text-brand-black shadow-sm'
                  : 'text-brand-cream/50 hover:text-brand-cream'
              }`}
            >
              <Check className="w-3 h-3" />
              Live
              <span className="ml-1 opacity-70">{actualMemberCount} members</span>
            </button>
            <button
              onClick={() => handleTogglePlanning(true)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all ${
                isPlanning
                  ? 'bg-amber-500/90 text-brand-black shadow-sm'
                  : 'text-brand-cream/50 hover:text-brand-cream'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              Planning
            </button>
          </div>

          {isPlanning && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 border border-amber-500/30 bg-amber-900/20 rounded-lg px-2.5 py-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={projectedInput}
                  onChange={(e) => setProjectedInput(e.target.value)}
                  onBlur={handleSaveMemberCount}
                  className="w-10 bg-transparent text-amber-300 text-sm font-semibold focus:outline-none"
                />
                <span className="text-amber-400/60 text-xs">projected</span>
              </div>
              {savingMode && <RefreshCw className="w-3.5 h-3.5 text-brand-cream/30 animate-spin" />}
            </div>
          )}
        </div>

        {/* Right side: visibility + add category */}
        <div className="flex items-center gap-3">
          {/* Member visibility toggle */}
          <button
            onClick={handleToggleVisibility}
            disabled={savingVis}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              settings.show_group_budget_to_members
                ? 'border-green-600/40 bg-green-900/20 text-green-400 hover:bg-green-900/30'
                : 'border-brand-tan/20 bg-brand-black/40 text-brand-cream/40 hover:text-brand-cream/70'
            }`}
          >
            {savingVis
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : settings.show_group_budget_to_members
                ? <Eye className="w-3.5 h-3.5" />
                : <EyeOff className="w-3.5 h-3.5" />
            }
            {settings.show_group_budget_to_members ? 'Visible to members' : 'Hidden from members'}
          </button>

          {categories.length === 0 && (
            <button
              onClick={handleSeedCategories}
              className="flex items-center gap-1.5 border border-brand-tan/30 hover:border-brand-tan text-brand-cream px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-tan/10 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Defaults
            </button>
          )}

          <button
            onClick={openNewCatForm}
            className="flex items-center gap-1.5 bg-brand-tan hover:bg-brand-tan/90 text-brand-black px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category
          </button>
        </div>
      </div>

      {/* Planning mode banner */}
      {isPlanning && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/25 bg-amber-900/15 px-4 py-2.5">
          <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300/80">
            <span className="font-semibold text-amber-300">Planning mode</span> — estimates based on{' '}
            <span className="font-semibold">{workingMemberCount} projected members</span>.
            Switch to <span className="font-semibold">Live</span> to use actual confirmed members ({actualMemberCount}).
          </p>
        </div>
      )}

      {/* ── Summary bar ─────────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-brand-tan/10">

            {/* Group kitty per person */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="w-3.5 h-3.5 text-brand-tan/60" />
                <p className="text-[11px] text-brand-cream/50 uppercase tracking-wider">Kitty / person</p>
              </div>
              <p className="text-2xl font-bold text-brand-tan">{fmt(summary.kittyPerPerson)}</p>
              <p className="text-xs text-brand-cream/35 mt-0.5">{fmt(summary.groupKittyTotal)} group total</p>
            </div>

            {/* Personal per person */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-purple-400/60" />
                <p className="text-[11px] text-brand-cream/50 uppercase tracking-wider">Personal / person</p>
              </div>
              <p className="text-2xl font-bold text-purple-300">{fmt(summary.personalPerPerson)}</p>
              <p className="text-xs text-brand-cream/35 mt-0.5">each member self-funds</p>
            </div>

            {/* Total per person (hero) */}
            <div className="px-5 py-4 md:col-span-2 bg-brand-black/30">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-brand-cream/60" />
                <p className="text-[11px] text-brand-cream/50 uppercase tracking-wider">
                  Estimated total per person
                  {isPlanning && <span className="ml-1.5 text-amber-400">(projected)</span>}
                </p>
              </div>
              <p className="text-3xl font-bold text-brand-cream">{fmt(summary.totalPerPerson)}</p>
              <p className="text-xs text-brand-cream/40 mt-0.5">
                {fmt(summary.kittyPerPerson)} kitty
                {summary.personalPerPerson > 0 && ` + ${fmt(summary.personalPerPerson)} personal`}
                {' · '}
                collect {fmt(summary.groupKittyTotal)} from {workingMemberCount} members
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/edit category form ───────────────────────────────────────────── */}
      {showCatForm && (
        <div className="rounded-xl border border-brand-tan/30 bg-brand-dark-grey p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-brand-cream text-sm">
              {editingCat ? 'Edit Category' : 'New Category'}
            </h3>
            <button onClick={() => setShowCatForm(false)} className="text-brand-cream/40 hover:text-brand-cream">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-brand-cream/60 mb-1">Category name</label>
              <input
                ref={catNameRef}
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCat(); if (e.key === 'Escape') setShowCatForm(false); }}
                placeholder="e.g. Accommodation"
                className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-sm focus:outline-none focus:ring-2 focus:ring-brand-tan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-cream/60 mb-1">Colour</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCatColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${catColor === c ? 'border-white scale-125' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowCatForm(false)}
              className="px-3 py-1.5 border border-brand-tan/30 rounded-lg text-brand-cream text-sm hover:bg-brand-tan/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCat}
              disabled={savingCat || !catName.trim()}
              className="px-4 py-1.5 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50"
            >
              {savingCat ? 'Saving…' : editingCat ? 'Save' : 'Add Category'}
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {categories.length === 0 && !showCatForm && (
        <div className="rounded-xl border border-dashed border-brand-tan/20 py-14 text-center">
          <DollarSign className="w-10 h-10 text-brand-tan/25 mx-auto mb-3" />
          <p className="text-brand-cream/50 font-medium">No budget categories yet</p>
          <p className="text-sm text-brand-cream/30 mt-1 mb-5">
            Add a category to start building your trip budget
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSeedCategories}
              className="flex items-center gap-2 border border-brand-tan/30 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10"
            >
              <Plus className="w-4 h-4" />
              Add Default Categories
            </button>
            <button
              onClick={openNewCatForm}
              className="flex items-center gap-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black px-4 py-2 rounded-lg text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Custom Category
            </button>
          </div>
        </div>
      )}

      {/* ── Category cards ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const isExpanded = expandedCats.has(cat.id);
          const { parts, groupTotal, personalTotal } = getCatSummary(cat);
          const isEditingInThisCat = editingPart?.catId === cat.id;

          return (
            <div
              key={cat.id}
              className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey overflow-hidden"
            >
              {/* Card header — clickable to expand */}
              <button
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-brand-tan/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-semibold text-brand-cream truncate">{cat.name}</span>
                  <span className="text-xs text-brand-cream/35 flex-shrink-0">
                    {parts.length} item{parts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  {/* Mini totals */}
                  <div className="hidden sm:flex items-center gap-3 text-sm">
                    {groupTotal > 0 && (
                      <span className="text-brand-tan font-medium">{fmt(groupTotal)} <span className="text-brand-cream/30 font-normal text-xs">kitty</span></span>
                    )}
                    {personalTotal > 0 && (
                      <span className="text-purple-300 font-medium">{fmt(personalTotal)} <span className="text-brand-cream/30 font-normal text-xs">personal/pp</span></span>
                    )}
                    {groupTotal === 0 && personalTotal === 0 && (
                      <span className="text-brand-cream/25 text-xs">no amounts yet</span>
                    )}
                  </div>

                  {/* Edit / delete cat */}
                  <div className="flex gap-1">
                    <span
                      role="button"
                      onClick={(e) => openEditCatForm(cat, e)}
                      className="p-1.5 text-brand-cream/25 hover:text-brand-cream rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </span>
                    <span
                      role="button"
                      onClick={(e) => handleDeleteCat(cat.id, e)}
                      className="p-1.5 text-brand-cream/25 hover:text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-brand-cream/30" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-brand-cream/30" />
                  )}
                </div>
              </button>

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-brand-tan/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand-black/30">
                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-cream/35">Line Item</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-cream/35">Coverage</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-cream/35">Amount</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-cream/35">Total</th>
                        <th className="px-4 py-2.5 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-tan/5">
                      {parts.map((part) => {
                        const isEditingThis = isEditingInThisCat && editingPart?.partId === part.id;
                        const coverage = coverageFromPart(part);
                        const total = getPartTotal(part, workingMemberCount);
                        const coverageMeta = COVERAGE_LABELS[coverage];

                        if (isEditingThis) {
                          return (
                            <tr key={part.id} className="bg-brand-black/30">
                              <td className="px-4 py-3" colSpan={5}>
                                <PartForm
                                  partNameRef={editingPart?.partId === part.id ? partNameRef : undefined}
                                  name={partName} setName={setPartName}
                                  coverage={partCoverage} setCoverage={setPartCoverage}
                                  amount={partAmount} setAmount={setPartAmount}
                                  workingMemberCount={workingMemberCount}
                                  saving={savingPart}
                                  onSave={handleSavePart}
                                  onCancel={cancelPartEdit}
                                />
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={part.id} className="hover:bg-brand-tan/5 group">
                            <td className="px-5 py-3 text-brand-cream font-medium">{part.name || <span className="text-brand-cream/25 italic">unnamed</span>}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${coverageMeta.color}`}>
                                {coverageMeta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-brand-cream/70">
                              {fmtDec(Number(part.amount_aud))}
                              {part.basis === 'per_person' && (
                                <span className="text-brand-cream/30 text-xs ml-1">× {workingMemberCount}</span>
                              )}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${part.payment_type === 'personal' ? 'text-purple-300' : 'text-brand-tan'}`}>
                              {part.payment_type === 'group' ? fmt(total) : fmtDec(Number(part.amount_aud))}
                              {part.payment_type === 'personal' && <span className="text-brand-cream/30 text-xs ml-1">/pp</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => openEditPart(cat.id, part, e)}
                                  className="p-1.5 text-brand-cream/40 hover:text-brand-cream rounded"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePart(cat.id, part.id)}
                                  className="p-1.5 text-brand-cream/40 hover:text-red-400 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Add line item inline form row */}
                      {isEditingInThisCat && editingPart?.partId === null && (
                        <tr className="bg-brand-black/30">
                          <td className="px-4 py-3" colSpan={5}>
                            <PartForm
                              partNameRef={partNameRef}
                              name={partName} setName={setPartName}
                              coverage={partCoverage} setCoverage={setPartCoverage}
                              amount={partAmount} setAmount={setPartAmount}
                              workingMemberCount={workingMemberCount}
                              saving={savingPart}
                              onSave={handleSavePart}
                              onCancel={cancelPartEdit}
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Footer: category totals + add button */}
                    <tfoot>
                      <tr className="border-t border-brand-tan/10 bg-brand-black/20">
                        <td colSpan={2} className="px-5 py-3">
                          {!(isEditingInThisCat && editingPart?.partId === null) && (
                            <button
                              onClick={() => openAddPart(cat.id)}
                              className="flex items-center gap-1.5 text-xs text-brand-tan/60 hover:text-brand-tan font-medium transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add line item
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-brand-cream/30">Totals</td>
                        <td className="px-4 py-3 text-right">
                          {groupTotal > 0 && (
                            <span className="text-brand-tan font-semibold text-sm">{fmt(groupTotal)}</span>
                          )}
                          {personalTotal > 0 && (
                            <span className="text-purple-300 font-semibold text-sm ml-2">
                              {fmtDec(personalTotal)}<span className="text-brand-cream/30 font-normal text-xs">/pp</span>
                            </span>
                          )}
                          {groupTotal === 0 && personalTotal === 0 && (
                            <span className="text-brand-cream/20 text-xs">—</span>
                          )}
                        </td>
                        <td />
                      </tr>

                      {/* Spend progress row — only if there's actual spend data */}
                      {(cat.spent_aud !== undefined && cat.spent_aud > 0) && (
                        <tr className="border-t border-brand-tan/5 bg-brand-black/10">
                          <td colSpan={5} className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-brand-black rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${cat.over_budget ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(100, groupTotal > 0 ? (cat.spent_aud / groupTotal) * 100 : 0)}%` }}
                                />
                              </div>
                              <span className="text-xs text-brand-cream/40 flex-shrink-0">
                                {fmt(cat.spent_aud ?? 0)} spent
                                {cat.over_budget && (
                                  <span className="ml-1.5 text-red-400 font-medium">
                                    <AlertTriangle className="w-3 h-3 inline mr-0.5" />over budget
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bottom add category button ───────────────────────────────────────── */}
      {categories.length > 0 && (
        <button
          onClick={openNewCatForm}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-brand-tan/20 hover:border-brand-tan/40 rounded-xl py-3 text-sm text-brand-cream/40 hover:text-brand-cream/70 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add another category
        </button>
      )}

    </div>
  );
}

// ── PartForm sub-component ────────────────────────────────────────────────────

interface PartFormProps {
  partNameRef?: React.RefObject<HTMLInputElement | null>;
  name: string;
  setName: (v: string) => void;
  coverage: CoverageType;
  setCoverage: (v: CoverageType) => void;
  amount: string;
  setAmount: (v: string) => void;
  workingMemberCount: number;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function PartForm({
  partNameRef, name, setName, coverage, setCoverage,
  amount, setAmount, workingMemberCount, saving, onSave, onCancel,
}: PartFormProps) {
  const amountNum = parseFloat(amount) || 0;
  const previewTotal = coverage === 'kitty_per_person' ? amountNum * workingMemberCount : amountNum;
  const isPersonal = coverage === 'personal';

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
      {/* Name */}
      <div className="flex-1 min-w-0">
        <label className="block text-[11px] font-medium text-brand-cream/50 mb-1 uppercase tracking-wider">Line item name</label>
        <input
          ref={partNameRef as React.RefObject<HTMLInputElement>}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. International flights"
          className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-sm focus:outline-none focus:ring-2 focus:ring-brand-tan"
        />
      </div>

      {/* Coverage */}
      <div className="sm:w-52">
        <label className="block text-[11px] font-medium text-brand-cream/50 mb-1 uppercase tracking-wider">Coverage</label>
        <select
          value={coverage}
          onChange={(e) => setCoverage(e.target.value as CoverageType)}
          className={`w-full px-3 py-2 bg-brand-black border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-tan ${
            isPersonal ? 'border-purple-500/40 text-purple-300' : 'border-brand-tan/30 text-brand-cream'
          }`}
        >
          {(Object.keys(COVERAGE_LABELS) as CoverageType[]).map((k) => (
            <option key={k} value={k}>{COVERAGE_LABELS[k].label}</option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="sm:w-40">
        <label className="block text-[11px] font-medium text-brand-cream/50 mb-1 uppercase tracking-wider">
          {coverage === 'kitty_fixed' ? 'Fixed total' : 'Per person'}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
            className="w-full pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-sm focus:outline-none focus:ring-2 focus:ring-brand-tan"
          />
        </div>
      </div>

      {/* Preview total + actions */}
      <div className="flex items-center gap-2 pb-0.5">
        {amountNum > 0 && (
          <span className={`text-sm font-semibold whitespace-nowrap ${isPersonal ? 'text-purple-300' : 'text-brand-tan'}`}>
            = {isPersonal ? `${fmtDec(amountNum)}/pp` : fmt(previewTotal)}
          </span>
        )}
        <button
          onClick={onSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-tan text-brand-black text-xs font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-40 whitespace-nowrap"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="p-2 text-brand-cream/40 hover:text-brand-cream rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
