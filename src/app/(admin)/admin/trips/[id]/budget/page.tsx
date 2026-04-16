'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DollarSign, Plus, Trash2, Edit2, X, CheckCircle2, AlertCircle,
  TrendingUp, TrendingDown, Settings, LayoutGrid, Receipt, Eye, EyeOff,
  RefreshCw, Upload, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  BookOpen, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import ExpenseImportPanel from '@/components/budget/ExpenseImportPanel';
import PaymentImportPanel from '@/components/payments/PaymentImportPanel';
import { getMemberDisplayName, getMemberListName } from '@/lib/member-display';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; planned_aud: number; color: string; sort_order: number; notes: string | null; spent_aud?: number; remaining_aud?: number; over_budget?: boolean; }
type BudgetPartBasis = 'per_person' | 'group';
interface BudgetPart { id: string; name: string; basis: BudgetPartBasis; amount_aud: number; member_count: number; }
interface Expense {
  id: string; description: string; amount: number; currency: string; amount_aud: number;
  expense_date: string; category: { id: string; name: string; color: string } | null;
  paid_by_type: string; paid_by_label: string | null;
  payer: { id: string; full_name: string | null; nickname: string | null } | null;
  notes: string | null; source: string; reconciled: boolean;
}
interface LedgerRow { id: string; type: 'income' | 'expense'; sub_type: string; date: string; description: string; amount_aud: number; running_balance: number; reconciled: boolean; source: string; category?: any; notes?: string | null; }
interface MemberPayment { id: string; member_id: string; payment_date: string; amount: number; payment_method: string | null; notes: string | null; profiles?: { full_name: string | null; nickname: string | null }; }
interface PaymentMilestone { id: string; trip_id: string; milestone_date: string; accumulated_amount: number; description: string; }
interface MemberPaymentSummary { member_id: string; full_name: string; nickname?: string | null; total_paid: number; payment_count: number; last_payment_date: string | null; }
interface IncomeEntry { id: string; description: string; amount_aud: number; income_date: string; category: string | null; notes: string | null; source: string; reconciled: boolean; }
interface MemberBreakdown { user_id: string; full_name: string | null; nickname: string | null; total_paid_aud: number; cost_share_aud: number; remaining_aud: number; }
interface Overview { total_budget_aud: number; total_income_aud: number; total_collected_from_members_aud: number; total_manual_income_aud: number; total_spent_aud: number; net_position_aud: number; budget_remaining_aud: number; collection_gap_aud: number; member_count: number; cost_share_per_member_aud: number; unreconciled_count: number; }
interface BudgetSettings { total_budget_aud: number; exchange_rate_mad_aud: number; show_group_budget_to_members: boolean; show_individual_breakdown_to_members: boolean; notes: string | null; }

const CURRENCIES = ['AUD', 'MAD', 'USD', 'EUR'];
const CATEGORY_COLORS = ['#B5621E','#C9B98A','#6B8E6B','#6B7FAE','#AE6B6B','#AE8B6B','#8B6BAE','#6BAEAE','#AE6BAE','#888888'];
const DEFAULT_CATEGORIES = [
  { name: 'Flights', color: '#6B7FAE' }, { name: 'Accommodation', color: '#6B8E6B' },
  { name: 'Ground Transport', color: '#B5621E' }, { name: 'Guides & Experiences', color: '#AE8B6B' },
  { name: 'Food & Drink', color: '#C9B98A' }, { name: 'Gear & Equipment', color: '#8B6BAE' },
  { name: 'Visas & Insurance', color: '#6BAEAE' }, { name: 'Contingency', color: '#888888' },
];

function createBudgetPart(defaultMemberCount: number): BudgetPart {
  return {
    id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    basis: 'per_person',
    amount_aud: 0,
    member_count: Math.max(1, defaultMemberCount),
  };
}

function normaliseBudgetParts(parts: BudgetPart[], defaultMemberCount: number): BudgetPart[] {
  const safeDefault = Math.max(1, defaultMemberCount);
  return parts
    .map((part) => ({
      id: part.id || `part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: (part.name || '').trim(),
      basis: part.basis === 'group' ? 'group' : 'per_person',
      amount_aud: Number.isFinite(Number(part.amount_aud)) ? Math.max(0, Number(part.amount_aud)) : 0,
      member_count: Number.isFinite(Number(part.member_count)) ? Math.max(1, Math.floor(Number(part.member_count))) : safeDefault,
    }))
    .filter((part) => part.name.length > 0 || part.amount_aud > 0);
}

function getBudgetPartTotal(part: BudgetPart) {
  return part.basis === 'per_person'
    ? Number(part.amount_aud) * Number(part.member_count)
    : Number(part.amount_aud);
}

function getCategoryTotalFromParts(parts: BudgetPart[]) {
  return parts.reduce((sum, part) => sum + getBudgetPartTotal(part), 0);
}

function parseCategoryNotes(
  rawNotes: string | null,
  plannedAud: number,
  defaultMemberCount: number
): { notesText: string; parts: BudgetPart[] } {
  const fallbackPart: BudgetPart = {
    id: `part-fallback-${Date.now()}`,
    name: 'Main',
    basis: 'group',
    amount_aud: Number(plannedAud) || 0,
    member_count: Math.max(1, defaultMemberCount),
  };
  if (!rawNotes) {
    return { notesText: '', parts: [fallbackPart] };
  }

  try {
    const parsed = JSON.parse(rawNotes);
    if (parsed && typeof parsed === 'object') {
      const partsRaw = Array.isArray((parsed as any).parts) ? (parsed as any).parts : [];
      const normalised = normaliseBudgetParts(partsRaw as BudgetPart[], defaultMemberCount);
      return {
        notesText: typeof (parsed as any).notes_text === 'string'
          ? (parsed as any).notes_text
          : '',
        parts: normalised.length > 0 ? normalised : [fallbackPart],
      };
    }
  } catch {
    // Backwards compatibility for plain-text notes
  }

  return { notesText: rawNotes, parts: [fallbackPart] };
}

function encodeCategoryNotes(notesText: string, parts: BudgetPart[]): string | null {
  const payload = {
    notes_text: notesText.trim() || null,
    parts,
  };
  return JSON.stringify(payload);
}

function fmt(n: number) { return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtSigned(n: number) { return (n >= 0 ? '+' : '') + fmt(n); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtShort(d: string) { return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); }

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminBudgetPage() {
  const params = useParams();
  const tripId = params.id as string;
  const supabase = createClient();

  type Tab = 'pl' | 'ledger' | 'income' | 'expenses' | 'reconcile' | 'categories' | 'settings';
  const [tab, setTab] = useState<Tab>('pl');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Data
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [memberPayments, setMemberPayments] = useState<MemberPayment[]>([]);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentMilestone[]>([]);
  const [memberPaymentSummary, setMemberPaymentSummary] = useState<MemberPaymentSummary[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [memberBreakdown, setMemberBreakdown] = useState<MemberBreakdown[]>([]);
  const [tripMembers, setTripMembers] = useState<{ id: string; full_name: string | null; nickname: string | null }[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>({ total_budget_aud: 0, exchange_rate_mad_aud: 0.14, show_group_budget_to_members: true, show_individual_breakdown_to_members: true, notes: null });

  // UI state — expense form
  const [showExpForm, setShowExpForm] = useState(false);
  const [showExpImport, setShowExpImport] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState({
    description: '', amount: '', currency: 'AUD', exchange_rate: '',
    amount_aud: '', amount_aud_overridden: false,
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '', paid_by_type: 'group_kitty', paid_by_member: '', paid_by_label: '', notes: '',
  });

  // UI state — income form
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentImport, setShowPaymentImport] = useState(false);
  const [showLegacyPaymentSection, setShowLegacyPaymentSection] = useState(true);
  const [showPlannerIncomeSection, setShowPlannerIncomeSection] = useState(true);
  const [incomeForm, setIncomeForm] = useState({ description: '', amount_aud: '', income_date: new Date().toISOString().split('T')[0], category: 'other', notes: '' });
  const [paymentForm, setPaymentForm] = useState({
    member_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    notes: '',
  });
  const [lastImport, setLastImport] = useState<{ imported_at: string; row_count: number } | null>(null);

  // UI state — category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({
    name: '',
    color: '#B5621E',
    notes_text: '',
    parts: [createBudgetPart(1)] as BudgetPart[],
  });

  const showToast = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, [supabase]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/trips/${tripId}/budget/summary`, { headers: h });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const d = json.data;
      setOverview(d.overview);
      setCategories(d.categories ?? []);
      setExpenses(d.expenses ?? []);
      setLedger(d.ledger ?? []);
      setMemberPayments(d.member_payments ?? []);
      setIncomeEntries(d.income_entries ?? []);
      setMemberBreakdown(d.member_breakdown ?? []);
      if (d.settings) setSettings(d.settings);

      const paymentRes = await fetch(`/api/payments/schedule?trip_id=${tripId}`, { headers: h });
      if (paymentRes.ok) {
        const paymentJson = await paymentRes.json();
        setPaymentSchedule(paymentJson.schedule ?? []);
        setMemberPaymentSummary(paymentJson.memberPaymentSummary ?? []);
      } else {
        setPaymentSchedule([]);
        setMemberPaymentSummary([]);
      }

      const logRes = await fetch(`/api/payments/import-log?trip_id=${tripId}`, { headers: h });
      if (logRes.ok) {
        const logData = await logRes.json();
        setLastImport(logData.log ?? null);
      } else {
        setLastImport(null);
      }
    } catch { showToast('error', 'Failed to load budget data'); }
    finally { setLoading(false); }
  }, [tripId, getAuthHeader]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('trip_members').select('user_id, profiles(id, full_name, nickname)').eq('trip_id', tripId);
      if (data) setTripMembers(data.map((m: any) => ({ id: m.user_id, full_name: m.profiles?.full_name ?? null, nickname: m.profiles?.nickname ?? null })));
    };
    load();
  }, [tripId, supabase]);

  // ── AUD calculation when expense form currency/amount changes ─────────────

  const recalcAud = (amount: string, currency: string, rate: string, overridden: boolean) => {
    if (overridden) return; // Don't recalc if user manually set AUD
    const a = parseFloat(amount);
    const r = parseFloat(rate) || settings.exchange_rate_mad_aud;
    if (!isNaN(a)) {
      const aud = currency === 'AUD' ? a : a * r;
      setExpForm((prev) => ({ ...prev, amount_aud: aud.toFixed(2) }));
    }
  };

  const handleExpFormChange = (field: string, value: string) => {
    setExpForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'amount' || field === 'currency' || field === 'exchange_rate') {
        if (!prev.amount_aud_overridden) {
          const a = parseFloat(field === 'amount' ? value : prev.amount);
          const r = parseFloat(field === 'exchange_rate' ? value : prev.exchange_rate) || settings.exchange_rate_mad_aud;
          const c = field === 'currency' ? value : prev.currency;
          if (!isNaN(a)) next.amount_aud = (c === 'AUD' ? a : a * r).toFixed(2);
        }
      }
      if (field === 'amount_aud') next.amount_aud_overridden = true;
      if (field === 'currency' && value === 'AUD') { next.amount_aud_overridden = false; next.exchange_rate = ''; }
      return next;
    });
  };

  // ── Expense CRUD ──────────────────────────────────────────────────────────

  const openExpForm = (exp?: Expense) => {
    if (exp) {
      setEditingExp(exp);
      setExpForm({
        description: exp.description, amount: String(exp.amount), currency: exp.currency,
        exchange_rate: String(exp.amount > 0 && exp.amount_aud > 0 && exp.currency !== 'AUD' ? (exp.amount_aud / exp.amount).toFixed(6) : ''),
        amount_aud: String(exp.amount_aud), amount_aud_overridden: false,
        expense_date: exp.expense_date, category_id: exp.category?.id ?? '',
        paid_by_type: exp.paid_by_type || 'group_kitty',
        paid_by_member: exp.payer?.id ?? '', paid_by_label: exp.paid_by_label ?? '', notes: exp.notes ?? '',
      });
    } else {
      setEditingExp(null);
      setExpForm({ description: '', amount: '', currency: 'AUD', exchange_rate: '', amount_aud: '', amount_aud_overridden: false, expense_date: new Date().toISOString().split('T')[0], category_id: '', paid_by_type: 'group_kitty', paid_by_member: '', paid_by_label: '', notes: '' });
    }
    setShowExpForm(true);
    setShowExpImport(false);
  };

  const handleSaveExp = async () => {
    if (!expForm.description || !expForm.amount || !expForm.expense_date) return showToast('error', 'Description, amount and date are required');
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const exchange_rate = expForm.currency === 'AUD' ? 1 : (parseFloat(expForm.exchange_rate) || settings.exchange_rate_mad_aud);
      const amount_aud = expForm.amount_aud ? parseFloat(expForm.amount_aud) : (expForm.currency === 'AUD' ? parseFloat(expForm.amount) : parseFloat(expForm.amount) * exchange_rate);
      const paid_by = expForm.paid_by_type === 'member' ? expForm.paid_by_member || null : null;
      const body = JSON.stringify({
        description: expForm.description, amount: expForm.amount, currency: expForm.currency,
        exchange_rate, amount_aud, amount_aud_overridden: expForm.amount_aud_overridden,
        expense_date: expForm.expense_date, category_id: expForm.category_id || null,
        paid_by, paid_by_type: expForm.paid_by_type,
        paid_by_label: expForm.paid_by_type === 'external' ? expForm.paid_by_label : null,
        notes: expForm.notes || null, source: 'manual',
      });
      const url = editingExp ? `/api/trips/${tripId}/budget/expenses/${editingExp.id}` : `/api/trips/${tripId}/budget/expenses`;
      const res = await fetch(url, { method: editingExp ? 'PUT' : 'POST', headers: h, body });
      if (!res.ok) throw new Error();
      showToast('success', editingExp ? 'Expense updated' : 'Expense recorded');
      setShowExpForm(false);
      fetchData();
    } catch { showToast('error', 'Failed to save expense'); }
    finally { setSaving(false); }
  };

  const handleDeleteExp = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const h = await getAuthHeader();
      await fetch(`/api/trips/${tripId}/budget/expenses/${id}`, { method: 'DELETE', headers: h });
      showToast('success', 'Expense deleted'); fetchData();
    } catch { showToast('error', 'Failed to delete expense'); }
  };

  // ── Income CRUD ───────────────────────────────────────────────────────────

  const handleSaveIncome = async () => {
    if (!incomeForm.description || !incomeForm.amount_aud || !incomeForm.income_date) return showToast('error', 'All fields are required');
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/income`, { method: 'POST', headers: h, body: JSON.stringify(incomeForm) });
      if (!res.ok) throw new Error();
      showToast('success', 'Income entry added');
      setShowIncomeForm(false);
      setIncomeForm({ description: '', amount_aud: '', income_date: new Date().toISOString().split('T')[0], category: 'other', notes: '' });
      fetchData();
    } catch { showToast('error', 'Failed to save income entry'); }
    finally { setSaving(false); }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!confirm('Delete this income entry?')) return;
    try {
      const h = await getAuthHeader();
      await fetch(`/api/trips/${tripId}/budget/income?entryId=${id}`, { method: 'DELETE', headers: h });
      showToast('success', 'Income entry deleted'); fetchData();
    } catch { showToast('error', 'Failed to delete income entry'); }
  };

  const handleSavePayment = async () => {
    if (!paymentForm.member_id || !paymentForm.amount || !paymentForm.payment_date) {
      return showToast('error', 'Member, amount and date are required');
    }

    setSaving(true);
    try {
      const res = await fetch('/api/payments/member-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: paymentForm.member_id,
          trip_id: tripId,
          payment_date: paymentForm.payment_date,
          amount: parseFloat(paymentForm.amount),
          payment_method: paymentForm.payment_method || 'bank_transfer',
          notes: paymentForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error();

      showToast('success', 'Payment recorded');
      setShowPaymentForm(false);
      setPaymentForm({
        member_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        notes: '',
      });
      fetchData();
    } catch {
      showToast('error', 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  // ── Category CRUD ─────────────────────────────────────────────────────────

  const defaultParticipantCount = Math.max(1, overview?.member_count || tripMembers.length || 1);

  const openCatForm = (cat?: Category) => {
    if (cat) {
      const parsed = parseCategoryNotes(cat.notes, cat.planned_aud, defaultParticipantCount);
      setEditingCat(cat);
      setCatForm({
        name: cat.name,
        color: cat.color,
        notes_text: parsed.notesText,
        parts: parsed.parts,
      });
    } else {
      setEditingCat(null);
      setCatForm({
        name: '',
        color: '#B5621E',
        notes_text: '',
        parts: [createBudgetPart(defaultParticipantCount)],
      });
    }
    setShowCatForm(true);
  };

  const updateCatPart = (partId: string, patch: Partial<BudgetPart>) => {
    setCatForm((prev) => ({
      ...prev,
      parts: prev.parts.map((part) => part.id === partId ? { ...part, ...patch } : part),
    }));
  };

  const addCatPart = () => {
    setCatForm((prev) => ({
      ...prev,
      parts: [...prev.parts, createBudgetPart(defaultParticipantCount)],
    }));
  };

  const removeCatPart = (partId: string) => {
    setCatForm((prev) => {
      const remaining = prev.parts.filter((part) => part.id !== partId);
      return {
        ...prev,
        parts: remaining.length > 0 ? remaining : [createBudgetPart(defaultParticipantCount)],
      };
    });
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return showToast('error', 'Category name is required');
    const parts = normaliseBudgetParts(catForm.parts, defaultParticipantCount);
    if (parts.length === 0) return showToast('error', 'Add at least one budget part');

    const planned_aud = getCategoryTotalFromParts(parts);
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const body = JSON.stringify({
        name: catForm.name.trim(),
        planned_aud,
        color: catForm.color,
        notes: encodeCategoryNotes(catForm.notes_text, parts),
      });
      const url = editingCat ? `/api/trips/${tripId}/budget/categories/${editingCat.id}` : `/api/trips/${tripId}/budget/categories`;
      const res = await fetch(url, { method: editingCat ? 'PUT' : 'POST', headers: h, body });
      if (!res.ok) throw new Error();
      showToast('success', editingCat ? 'Category updated' : 'Category added');
      setShowCatForm(false); fetchData();
    } catch { showToast('error', 'Failed to save category'); }
    finally { setSaving(false); }
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      const h = await getAuthHeader();
      await fetch(`/api/trips/${tripId}/budget/categories/${id}`, { method: 'DELETE', headers: h });
      showToast('success', 'Category deleted'); fetchData();
    } catch { showToast('error', 'Failed to delete'); }
  };

  const handleSeedCategories = async () => {
    if (!confirm('Add default categories?')) return;
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      await Promise.all(DEFAULT_CATEGORIES.map((c, i) => fetch(`/api/trips/${tripId}/budget/categories`, { method: 'POST', headers: h, body: JSON.stringify({ name: c.name, planned_aud: 0, color: c.color, sort_order: i }) })));
      showToast('success', 'Default categories added'); fetchData();
    } catch { showToast('error', 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Reconciliation ────────────────────────────────────────────────────────

  const handleReconcile = async (type: 'expense' | 'income', id: string, reconciled: boolean) => {
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      await fetch(`/api/trips/${tripId}/budget/reconcile`, { method: 'POST', headers: h, body: JSON.stringify({ type, id, reconciled }) });
      fetchData();
    } catch { showToast('error', 'Failed to update reconciliation'); }
  };

  // ── Settings ──────────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/settings`, { method: 'PUT', headers: h, body: JSON.stringify(settings) });
      if (!res.ok) throw new Error();
      showToast('success', 'Settings saved'); fetchData();
    } catch { showToast('error', 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const unreconciledExpenses = expenses.filter((e) => !e.reconciled && e.source === 'manual');
  const unreconciledIncome = incomeEntries.filter((e) => !e.reconciled);
  const totalUnreconciled = unreconciledExpenses.length + unreconciledIncome.length;
  const targetAmount = paymentSchedule.length > 0 ? paymentSchedule[paymentSchedule.length - 1].accumulated_amount : 5000;
  const membersPaidCount = memberPaymentSummary.filter((m) => m.total_paid > 0).length;
  const today = new Date();
  const passedMilestones = paymentSchedule.filter((m) => new Date(m.milestone_date) <= today);
  const expectedByMilestone = passedMilestones.length > 0 ? passedMilestones[passedMilestones.length - 1].accumulated_amount : 0;
  const nextMilestone = paymentSchedule.find((m) => new Date(m.milestone_date) > today);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <DollarSign className="w-8 h-8 text-brand-tan animate-pulse" />
    </div>
  );

  const tabs = [
    { key: 'pl' as Tab, label: 'P&L', icon: LayoutGrid },
    { key: 'ledger' as Tab, label: 'Ledger', icon: BookOpen },
    { key: 'income' as Tab, label: 'Income', icon: ArrowDownCircle },
    { key: 'expenses' as Tab, label: 'Expenses', icon: ArrowUpCircle },
    { key: 'reconcile' as Tab, label: `Reconcile${totalUnreconciled > 0 ? ` (${totalUnreconciled})` : ''}`, icon: AlertTriangle },
    { key: 'categories' as Tab, label: 'Categories', icon: TrendingUp },
    { key: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-xl border ${toast.type === 'success' ? 'bg-green-900/95 border-green-600/60 text-green-200' : 'bg-red-900/95 border-red-600/60 text-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-brand-tan" />
          <div>
            <h1 className="text-3xl font-bold text-brand-cream">Financial Manager</h1>
            <p className="text-brand-cream/50 text-sm">Income · Expenses · Reconciliation · Budget</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalUnreconciled > 0 && (
            <button onClick={() => setTab('reconcile')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/30 border border-amber-600/40 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-900/50 transition-colors">
              <AlertTriangle className="w-4 h-4" />
              {totalUnreconciled} unreconciled
            </button>
          )}
          <button onClick={fetchData} className="p-2 text-brand-cream/40 hover:text-brand-cream transition-colors" title="Refresh"><RefreshCw className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Visibility status */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Group budget', on: settings.show_group_budget_to_members },
          { label: 'Individual breakdown', on: settings.show_individual_breakdown_to_members },
        ].map(({ label, on }) => (
          <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${on ? 'bg-green-900/20 border-green-600/30 text-green-400' : 'bg-brand-dark-grey border-brand-tan/20 text-brand-cream/40'}`}>
            {on ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {label} {on ? 'visible to members' : 'hidden'}
          </div>
        ))}
        <button onClick={() => setTab('settings')} className="text-xs text-brand-cream/30 hover:text-brand-cream/60 underline">Change visibility</button>
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-tan/20 flex gap-1 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`pb-3 px-3 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap text-sm ${tab === key ? 'text-brand-tan border-b-2 border-brand-tan' : 'text-brand-cream/50 hover:text-brand-cream'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          P&L TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'pl' && overview && (
        <div className="space-y-6">
          {/* Net position hero */}
          <div className={`rounded-xl p-6 border ${overview.net_position_aud >= 0 ? 'bg-green-900/20 border-green-600/30' : 'bg-red-900/20 border-red-600/30'}`}>
            <p className="text-sm text-brand-cream/60 uppercase tracking-wider mb-1">Net Position</p>
            <p className={`text-5xl font-bold ${overview.net_position_aud >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtSigned(overview.net_position_aud)}
            </p>
            <p className="text-sm text-brand-cream/50 mt-2">Income {fmt(overview.total_income_aud)} − Expenses {fmt(overview.total_spent_aud)}</p>
          </div>

          {/* Income vs Expenses side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income */}
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowDownCircle className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-brand-cream">Income</h3>
              </div>
              <p className="text-3xl font-bold text-green-400 mb-3">{fmt(overview.total_income_aud)}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-brand-cream/70">
                  <span>Member payments</span>
                  <span className="font-medium">{fmt(overview.total_collected_from_members_aud)}</span>
                </div>
                <div className="flex justify-between text-brand-cream/70">
                  <span>Other income</span>
                  <span className="font-medium">{fmt(overview.total_manual_income_aud)}</span>
                </div>
                <div className="flex justify-between text-brand-cream/50 pt-2 border-t border-brand-tan/10">
                  <span>Budget target</span>
                  <span>{fmt(overview.total_budget_aud)}</span>
                </div>
                <div className="flex justify-between text-amber-400/80">
                  <span>Collection gap</span>
                  <span>{fmt(Math.max(0, overview.collection_gap_aud))}</span>
                </div>
              </div>
              {/* Collection bar */}
              <div className="mt-4">
                <div className="w-full h-2 bg-brand-black rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, overview.total_budget_aud > 0 ? (overview.total_income_aud / overview.total_budget_aud) * 100 : 0)}%` }} />
                </div>
                <p className="text-xs text-brand-cream/40 mt-1">{overview.total_budget_aud > 0 ? Math.round((overview.total_income_aud / overview.total_budget_aud) * 100) : 0}% of budget collected</p>
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpCircle className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-brand-cream">Expenses</h3>
              </div>
              <p className="text-3xl font-bold text-red-400 mb-3">{fmt(overview.total_spent_aud)}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-brand-cream/50">
                  <span>Budget allocated</span>
                  <span>{fmt(overview.total_budget_aud)}</span>
                </div>
                <div className="flex justify-between text-brand-cream/70">
                  <span>Remaining budget</span>
                  <span className={overview.budget_remaining_aud < 0 ? 'text-red-400' : 'text-green-400'}>{fmt(overview.budget_remaining_aud)}</span>
                </div>
              </div>
              {/* Spend bar */}
              <div className="mt-4">
                <div className="w-full h-2 bg-brand-black rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${overview.total_spent_aud > overview.total_budget_aud ? 'bg-red-500' : 'bg-brand-tan'}`} style={{ width: `${Math.min(100, overview.total_budget_aud > 0 ? (overview.total_spent_aud / overview.total_budget_aud) * 100 : 0)}%` }} />
                </div>
                <p className="text-xs text-brand-cream/40 mt-1">{overview.total_budget_aud > 0 ? Math.round((overview.total_spent_aud / overview.total_budget_aud) * 100) : 0}% of budget spent</p>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-tan/20 flex items-center justify-between">
                <h3 className="font-semibold text-brand-cream">Expense Categories</h3>
                <button onClick={() => setTab('categories')} className="text-xs text-brand-tan hover:underline">Manage →</button>
              </div>
              <div className="divide-y divide-brand-tan/10">
                {categories.map((cat) => {
                  const pct = cat.planned_aud > 0 ? Math.min(100, ((cat.spent_aud ?? 0) / cat.planned_aud) * 100) : 0;
                  return (
                    <div key={cat.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-brand-cream text-sm font-medium truncate">{cat.name}</span>
                          <span className={`text-sm font-semibold ${cat.over_budget ? 'text-red-400' : 'text-brand-cream/80'}`}>{fmt(cat.spent_aud ?? 0)} <span className="text-brand-cream/30 font-normal">/ {fmt(cat.planned_aud)}</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-brand-black rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.over_budget ? '#ef4444' : cat.color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Member cost share */}
          {memberBreakdown.length > 0 && (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-tan/20">
                <h3 className="font-semibold text-brand-cream">Member Contributions</h3>
                <p className="text-xs text-brand-cream/40 mt-0.5">Cost share: {fmt(overview.cost_share_per_member_aud)} per member</p>
              </div>
              <table className="w-full">
                <thead className="bg-brand-black">
                  <tr>{['Member','Share','Paid','Remaining','Status'].map((h) => <th key={h} className="px-5 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {memberBreakdown.map((m) => (
                    <tr key={m.user_id} className="hover:bg-brand-tan/5">
                      <td className="px-5 py-3 font-medium text-brand-cream">{m.nickname || m.full_name || '—'}</td>
                      <td className="px-5 py-3 text-brand-cream/70">{fmt(m.cost_share_aud)}</td>
                      <td className="px-5 py-3 text-brand-tan font-semibold">{fmt(m.total_paid_aud)}</td>
                      <td className="px-5 py-3"><span className={m.remaining_aud <= 0 ? 'text-green-400' : 'text-amber-400'}>{fmt(m.remaining_aud)}</span></td>
                      <td className="px-5 py-3">{m.remaining_aud <= 0 ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-900/30 text-green-400 border border-green-600/30">Paid</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-amber-900/30 text-amber-400 border border-amber-600/30">Outstanding</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          LEDGER TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-brand-cream/50">
            <Info className="w-4 h-4" />
            Chronological view of all income and expenses with running balance
          </div>
          {ledger.length === 0 ? (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg py-12 text-center text-brand-cream/40">No transactions yet</div>
          ) : (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-black">
                  <tr>{['Date','Description','Type','Amount','Balance','Reconciled'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {ledger.map((row, i) => (
                    <tr key={`${row.id}-${i}`} className={`hover:bg-brand-tan/5 ${!row.reconciled && row.source === 'manual' ? 'border-l-2 border-amber-500/50' : ''}`}>
                      <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtShort(row.date)}</td>
                      <td className="px-4 py-3 text-brand-cream max-w-[200px]">
                        <p className="truncate">{row.description}</p>
                        {row.notes && <p className="text-xs text-brand-cream/40 truncate">{row.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${row.type === 'income' ? 'bg-green-900/20 text-green-400 border-green-600/30' : 'bg-red-900/20 text-red-400 border-red-600/30'}`}>
                          {row.type === 'income' ? '↓' : '↑'} {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        <span className={row.amount_aud >= 0 ? 'text-green-400' : 'text-red-400'}>{fmtSigned(row.amount_aud)}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        <span className={row.running_balance >= 0 ? 'text-brand-cream' : 'text-red-400'}>{fmt(row.running_balance)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.reconciled
                          ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" />Reconciled</span>
                          : row.source === 'manual'
                            ? <button onClick={() => handleReconcile(row.type === 'income' ? 'income' : 'expense', row.id, true)} className="text-xs text-amber-400 hover:underline flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Mark reconciled</button>
                            : <span className="text-xs text-brand-cream/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          INCOME TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'income' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-cream/60 text-sm">Manage member payments and additional income in one place</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPaymentForm(!showPaymentForm);
                  setShowLegacyPaymentSection(true);
                  setShowIncomeForm(false);
                  setShowPaymentImport(false);
                }}
                className="flex items-center gap-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black px-4 py-2 rounded-lg text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Record Payment
              </button>
              <button
                onClick={() => {
                  setShowPaymentImport(!showPaymentImport);
                  setShowLegacyPaymentSection(true);
                  setShowPaymentForm(false);
                  setShowIncomeForm(false);
                }}
                className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10"
              >
                <Upload className="w-4 h-4" /> Import Payments
              </button>
              <button
                onClick={() => {
                  setShowIncomeForm(!showIncomeForm);
                  setShowPlannerIncomeSection(true);
                  setShowPaymentForm(false);
                  setShowPaymentImport(false);
                }}
                className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10"
              >
                <Plus className="w-4 h-4" /> Add Other Income
              </button>
            </div>
          </div>

          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLegacyPaymentSection((prev) => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-brand-tan/5 transition-colors"
            >
              <div className="text-left">
                <h3 className="font-semibold text-brand-cream">Legacy Payment Tracker</h3>
                <p className="text-xs text-brand-cream/40 mt-0.5">Existing tracker controls and milestone status</p>
              </div>
              {showLegacyPaymentSection ? <ChevronUp className="w-5 h-5 text-brand-cream/50" /> : <ChevronDown className="w-5 h-5 text-brand-cream/50" />}
            </button>

            {showLegacyPaymentSection && (
              <div className="p-4 border-t border-brand-tan/20 space-y-4">

          {lastImport && (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg px-4 py-3">
              <p className="text-xs text-brand-cream/40 uppercase tracking-wide">Payments last imported</p>
              <p className="text-sm text-brand-cream">
                {new Date(lastImport.imported_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} · {lastImport.row_count} rows
              </p>
            </div>
          )}

          {showPaymentImport && (
            <PaymentImportPanel
              tripId={tripId}
              onClose={() => setShowPaymentImport(false)}
              onImportComplete={() => {
                setShowPaymentImport(false);
                fetchData();
              }}
            />
          )}

          {showPaymentForm && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-brand-cream">Record Member Payment</h3>
                <button onClick={() => setShowPaymentForm(false)} className="text-brand-cream/40 hover:text-brand-cream">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Member</label>
                  <select
                    value={paymentForm.member_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, member_id: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="">— Select member —</option>
                    {memberPaymentSummary.length > 0
                      ? memberPaymentSummary.map((m) => (
                          <option key={m.member_id} value={m.member_id}>
                            {getMemberListName(m as any)}
                          </option>
                        ))
                      : tripMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nickname || m.full_name || m.id}
                          </option>
                        ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="payid">PayID</option>
                    <option value="cash">Cash</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                  <input
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSavePayment} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Record Payment'}</button>
              </div>
            </div>
          )}

          {/* Member payments from tracker */}
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-brand-tan/20 flex items-center justify-between">
              <h3 className="font-semibold text-brand-cream">Member Payments <span className="text-brand-cream/40 font-normal text-sm">from Payment Tracker</span></h3>
              <span className="text-brand-tan font-semibold">{fmt(memberPayments.reduce((s, p) => s + p.amount, 0))}</span>
            </div>
            {memberPayments.length === 0 ? (
              <p className="px-5 py-8 text-center text-brand-cream/40 text-sm">No member payments recorded yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-brand-black"><tr>{['Date','Member','Amount','Method','Notes'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {memberPayments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-brand-tan/5">
                      <td className="px-4 py-3 text-brand-cream/60">{fmtShort(p.payment_date)}</td>
                      <td className="px-4 py-3 text-brand-cream">{(p.profiles as any)?.nickname || (p.profiles as any)?.full_name || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-green-400">{fmt(p.amount)}</td>
                      <td className="px-4 py-3 text-brand-cream/50 capitalize">{(p.payment_method ?? '—').replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-brand-cream/40">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Legacy Payment Tracker View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-brand-cream">Payment Tracker Status</h3>
              <p className="text-xs text-brand-cream/40">Legacy view retained in Financial Manager</p>
            </div>

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
                  {membersPaidCount}
                </p>
              </div>

              <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-6">
                <p className="text-sm text-brand-cream/70 mb-1">Target Amount</p>
                <p className="text-3xl font-bold text-brand-tan">
                  ${targetAmount.toFixed(2)}
                </p>
              </div>
            </div>

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
                      const percentPaid = targetAmount > 0 ? (member.total_paid / targetAmount) * 100 : 0;
                      const isFullyPaid = member.total_paid >= targetAmount;
                      const isAhead = !isFullyPaid && member.total_paid > expectedByMilestone;
                      const isOnTrack = !isFullyPaid && member.total_paid >= expectedByMilestone;

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
          </div>
              </div>
            )}
          </div>

          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPlannerIncomeSection((prev) => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-brand-tan/5 transition-colors"
            >
              <div className="text-left">
                <h3 className="font-semibold text-brand-cream">Financial Planner Income</h3>
                <p className="text-xs text-brand-cream/40 mt-0.5">Manual income entries for sponsorships, refunds, and other non-member income</p>
              </div>
              {showPlannerIncomeSection ? <ChevronUp className="w-5 h-5 text-brand-cream/50" /> : <ChevronDown className="w-5 h-5 text-brand-cream/50" />}
            </button>

            {showPlannerIncomeSection && (
              <div className="p-4 border-t border-brand-tan/20 space-y-4">
                {showIncomeForm && (
                  <div className="bg-brand-black/30 border border-brand-tan/30 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-brand-cream">New Income Entry</h3>
                      <button onClick={() => setShowIncomeForm(false)} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2"><label className="block text-xs font-medium text-brand-cream/60 mb-1">Description</label>
                        <input value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="e.g. Sponsorship from XYZ" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD)</label>
                        <input type="number" min="0" step="0.01" value={incomeForm.amount_aud} onChange={(e) => setIncomeForm({ ...incomeForm, amount_aud: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Date</label>
                        <input type="date" value={incomeForm.income_date} onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Category</label>
                        <select value={incomeForm.category} onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                          <option value="member_payment">Member Payment</option><option value="refund">Refund</option><option value="sponsorship">Sponsorship</option><option value="other">Other</option>
                        </select></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                        <input value={incomeForm.notes} onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                      <button onClick={() => setShowIncomeForm(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                      <button onClick={handleSaveIncome} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Add Entry'}</button>
                    </div>
                  </div>
                )}

                {incomeEntries.length > 0 ? (
                  <div className="bg-brand-black/30 border border-brand-tan/20 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-brand-tan/20 flex items-center justify-between">
                      <h3 className="font-semibold text-brand-cream">Other Income</h3>
                      <span className="text-green-400 font-semibold">{fmt(incomeEntries.reduce((s, e) => s + e.amount_aud, 0))}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-brand-black"><tr>{['Date','Description','Category','Amount','Reconciled',''].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-brand-tan/10">
                        {incomeEntries.map((e) => (
                          <tr key={e.id} className="hover:bg-brand-tan/5">
                            <td className="px-4 py-3 text-brand-cream/60">{fmtShort(e.income_date)}</td>
                            <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                            <td className="px-4 py-3 text-brand-cream/50 capitalize">{e.category?.replace('_', ' ') || '—'}</td>
                            <td className="px-4 py-3 font-semibold text-green-400">{fmt(e.amount_aud)}</td>
                            <td className="px-4 py-3">{e.reconciled ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Yes</span> : <button onClick={() => handleReconcile('income', e.id, true)} className="text-xs text-amber-400 hover:underline">Mark reconciled</button>}</td>
                            <td className="px-4 py-3"><button onClick={() => handleDeleteIncome(e.id)} className="p-1 text-brand-cream/30 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-brand-black/30 border border-brand-tan/20 rounded-lg py-8 text-center text-brand-cream/40 text-sm">
                    No manual income entries yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          EXPENSES TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-brand-cream/60 text-sm">Log and manage all trip expenses</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowExpImport(!showExpImport); setShowExpForm(false); }} className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10">
                <Upload className="w-4 h-4" /> Import Excel
              </button>
              <button onClick={() => openExpForm()} className="flex items-center gap-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black px-4 py-2 rounded-lg text-sm font-semibold">
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
          </div>

          {showExpImport && (
            <ExpenseImportPanel tripId={tripId} defaultExchangeRate={settings.exchange_rate_mad_aud}
              onClose={() => setShowExpImport(false)} onImportComplete={() => { setShowExpImport(false); fetchData(); }} />
          )}

          {showExpForm && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-brand-cream">{editingExp ? 'Edit Expense' : 'New Expense'}</h3>
                <button onClick={() => setShowExpForm(false)} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Description</label>
                  <input value={expForm.description} onChange={(e) => handleExpFormChange('description', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="e.g. Riad accommodation deposit" />
                </div>

                {/* Amount + Currency */}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount</label>
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.01" value={expForm.amount} onChange={(e) => handleExpFormChange('amount', e.target.value)} className="flex-1 px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="0.00" />
                    <select value={expForm.currency} onChange={(e) => handleExpFormChange('currency', e.target.value)} className="w-24 px-2 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* AUD equivalent */}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">
                    AUD Amount
                    {expForm.currency !== 'AUD' && <span className="text-brand-cream/30 ml-1">(auto-calculated · click to override)</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={expForm.amount_aud}
                      onChange={(e) => handleExpFormChange('amount_aud', e.target.value)}
                      className={`w-full pl-7 pr-3 py-2 bg-brand-black border rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan ${expForm.amount_aud_overridden ? 'border-amber-500/50' : 'border-brand-tan/30'}`}
                      placeholder="0.00"
                    />
                    {expForm.amount_aud_overridden && (
                      <button onClick={() => { setExpForm((p) => ({ ...p, amount_aud_overridden: false })); handleExpFormChange('amount', expForm.amount); }} className="absolute right-2 top-2 text-xs text-amber-400 hover:text-amber-300">reset</button>
                    )}
                  </div>
                  {expForm.currency !== 'AUD' && !expForm.amount_aud_overridden && (
                    <p className="text-xs text-brand-cream/30 mt-1">Using rate: 1 {expForm.currency} = {parseFloat(expForm.exchange_rate) || settings.exchange_rate_mad_aud} AUD</p>
                  )}
                </div>

                {/* Exchange rate (only for non-AUD) */}
                {expForm.currency !== 'AUD' && (
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Exchange Rate ({expForm.currency} → AUD)</label>
                    <input type="number" min="0" step="0.000001" value={expForm.exchange_rate} onChange={(e) => handleExpFormChange('exchange_rate', e.target.value)} placeholder={String(settings.exchange_rate_mad_aud)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Date</label>
                  <input type="date" value={expForm.expense_date} onChange={(e) => handleExpFormChange('expense_date', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Category</label>
                  <select value={expForm.category_id} onChange={(e) => handleExpFormChange('category_id', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                    <option value="">Uncategorised</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Paid by */}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Paid by</label>
                  <select value={expForm.paid_by_type} onChange={(e) => handleExpFormChange('paid_by_type', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                    <option value="group_kitty">Group Kitty</option>
                    <option value="member">Specific Member</option>
                    <option value="external">External / Other</option>
                  </select>
                </div>

                {expForm.paid_by_type === 'member' && (
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Select Member</label>
                    <select value={expForm.paid_by_member} onChange={(e) => handleExpFormChange('paid_by_member', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                      <option value="">— Select —</option>
                      {tripMembers.map((m) => <option key={m.id} value={m.id}>{m.nickname || m.full_name || m.id}</option>)}
                    </select>
                  </div>
                )}

                {expForm.paid_by_type === 'external' && (
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Paid by (name)</label>
                    <input value={expForm.paid_by_label} onChange={(e) => handleExpFormChange('paid_by_label', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="e.g. Supplier name" />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes (optional)</label>
                  <textarea rows={2} value={expForm.notes} onChange={(e) => handleExpFormChange('notes', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowExpForm(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSaveExp} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : editingExp ? 'Update' : 'Add Expense'}</button>
              </div>
            </div>
          )}

          {expenses.length === 0 && !showExpForm && !showExpImport ? (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg py-12 text-center text-brand-cream/40">No expenses recorded yet</div>
          ) : expenses.length > 0 && (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-black">
                  <tr>{['Date','Description','Category','Paid by','Amount','AUD','Source',''].map((h) => <th key={h} className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className={`hover:bg-brand-tan/5 ${!exp.reconciled && exp.source === 'manual' ? 'border-l-2 border-amber-500/40' : ''}`}>
                      <td className="px-3 py-3 text-brand-cream/60 whitespace-nowrap">{fmtShort(exp.expense_date)}</td>
                      <td className="px-3 py-3 text-brand-cream max-w-[160px]">
                        <p className="truncate font-medium">{exp.description}</p>
                        {exp.notes && <p className="text-xs text-brand-cream/40 truncate">{exp.notes}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {exp.category ? <span className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: exp.category.color }} />{exp.category.name}</span> : <span className="text-brand-cream/30 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-brand-cream/60 capitalize">
                        {exp.paid_by_type === 'group_kitty' ? '🏦 Kitty' : exp.paid_by_type === 'member' ? (exp.payer?.nickname || exp.payer?.full_name || 'Member') : (exp.paid_by_label || 'External')}
                      </td>
                      <td className="px-3 py-3 text-brand-cream/70 text-xs whitespace-nowrap">{exp.amount.toLocaleString()} {exp.currency}</td>
                      <td className="px-3 py-3 font-semibold text-brand-tan whitespace-nowrap">{fmt(exp.amount_aud)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${exp.source === 'import' ? 'bg-blue-900/20 text-blue-400 border-blue-600/30' : exp.reconciled ? 'bg-green-900/20 text-green-400 border-green-600/30' : 'bg-amber-900/20 text-amber-400 border-amber-600/30'}`}>
                          {exp.source === 'import' ? 'Imported' : exp.reconciled ? 'Reconciled' : 'Unreconciled'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openExpForm(exp)} className="p-1 text-brand-cream/30 hover:text-brand-cream rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteExp(exp.id)} className="p-1 text-brand-cream/30 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          RECONCILIATION TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'reconcile' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-600/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-400">Reconciliation Check</p>
              <p className="text-sm text-amber-400/70 mt-0.5">
                Manual entries are flagged until you confirm they match your records (Excel export, bank statement, etc.). Imported rows are auto-reconciled.
              </p>
            </div>
          </div>

          {totalUnreconciled === 0 ? (
            <div className="bg-brand-dark-grey border border-green-600/30 rounded-lg py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-green-400">All transactions reconciled</p>
              <p className="text-sm text-brand-cream/40 mt-1">No outstanding items to review</p>
            </div>
          ) : (
            <>
              {unreconciledExpenses.length > 0 && (
                <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-brand-tan/20 flex items-center justify-between">
                    <h3 className="font-semibold text-brand-cream">Unreconciled Expenses <span className="text-amber-400 ml-2">{unreconciledExpenses.length}</span></h3>
                    <button onClick={async () => { for (const e of unreconciledExpenses) await handleReconcile('expense', e.id, true); showToast('success', 'All marked reconciled'); }} className="text-xs text-brand-tan hover:underline">Mark all reconciled</button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-brand-black"><tr>{['Date','Description','Amount AUD','Category','Action'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-brand-tan/10">
                      {unreconciledExpenses.map((e) => (
                        <tr key={e.id} className="hover:bg-brand-tan/5">
                          <td className="px-4 py-3 text-brand-cream/60">{fmtDate(e.expense_date)}</td>
                          <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                          <td className="px-4 py-3 font-semibold text-brand-tan">{fmt(e.amount_aud)}</td>
                          <td className="px-4 py-3 text-brand-cream/50">{e.category?.name || '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleReconcile('expense', e.id, true)} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-600/30 rounded px-2 py-1 hover:bg-green-900/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Reconcile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {unreconciledIncome.length > 0 && (
                <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-brand-tan/20">
                    <h3 className="font-semibold text-brand-cream">Unreconciled Income <span className="text-amber-400 ml-2">{unreconciledIncome.length}</span></h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-brand-black"><tr>{['Date','Description','Amount','Action'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-brand-tan/10">
                      {unreconciledIncome.map((e) => (
                        <tr key={e.id} className="hover:bg-brand-tan/5">
                          <td className="px-4 py-3 text-brand-cream/60">{fmtDate(e.income_date)}</td>
                          <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                          <td className="px-4 py-3 font-semibold text-green-400">{fmt(e.amount_aud)}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleReconcile('income', e.id, true)} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-600/30 rounded px-2 py-1 hover:bg-green-900/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Reconcile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CATEGORIES TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-brand-cream/60 text-sm">Define budget line items</p>
            <div className="flex gap-2">
              {categories.length === 0 && <button onClick={handleSeedCategories} disabled={saving} className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10"><Plus className="w-4 h-4" />Add Defaults</button>}
              <button onClick={() => openCatForm()} className="flex items-center gap-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black px-4 py-2 rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" />Add Category</button>
            </div>
          </div>

          {showCatForm && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-brand-cream">{editingCat ? 'Edit' : 'New'} Category</h3>
                <button onClick={() => setShowCatForm(false)} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Name</label>
                    <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Colour</label>
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORY_COLORS.map((c) => (
                        <button key={c} onClick={() => setCatForm({ ...catForm, color: c })} className={`w-7 h-7 rounded-full border-2 transition-all ${catForm.color === c ? 'border-white scale-125' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                    <textarea rows={2} value={catForm.notes_text} onChange={(e) => setCatForm({ ...catForm, notes_text: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" />
                  </div>
                </div>

                <div className="border border-brand-tan/20 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-brand-black/40 border-b border-brand-tan/20 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-brand-cream text-sm">Budget Parts</p>
                      <p className="text-xs text-brand-cream/40">Split a category into multiple items (e.g. international + internal flights)</p>
                    </div>
                    <button onClick={addCatPart} className="text-xs px-3 py-1.5 rounded border border-brand-tan/40 text-brand-cream hover:bg-brand-tan/10">
                      <Plus className="w-3.5 h-3.5 inline mr-1" />
                      Add Part
                    </button>
                  </div>

                  <div className="divide-y divide-brand-tan/10">
                    {catForm.parts.map((part) => (
                      <div key={part.id} className="p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-brand-cream/60 mb-1">Part Name</label>
                            <input
                              value={part.name}
                              onChange={(e) => updateCatPart(part.id, { name: e.target.value })}
                              placeholder="e.g. International flight"
                              className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-brand-cream/60 mb-1">Pricing</label>
                            <select
                              value={part.basis}
                              onChange={(e) => updateCatPart(part.id, { basis: e.target.value as BudgetPartBasis })}
                              className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                            >
                              <option value="per_person">Per Person</option>
                              <option value="group">Group</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-brand-cream/60 mb-1">{part.basis === 'per_person' ? 'Amount per Person' : 'Group Amount'} (AUD)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={part.amount_aud}
                              onChange={(e) => updateCatPart(part.id, { amount_aud: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-brand-cream/60 mb-1">Members</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              disabled={part.basis === 'group'}
                              value={part.member_count}
                              onChange={(e) => updateCatPart(part.id, { member_count: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                              className={`w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan ${part.basis === 'group' ? 'opacity-40 cursor-not-allowed' : ''}`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <p className="text-brand-cream/50">Part total: <span className="text-brand-tan font-semibold">{fmt(getBudgetPartTotal(part))}</span></p>
                          <button onClick={() => removeCatPart(part.id)} className="text-brand-cream/40 hover:text-red-400 text-xs">
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                            Remove part
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-brand-black/40 border border-brand-tan/20 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-brand-cream/60">Category total</span>
                  <span className="text-lg font-semibold text-brand-tan">{fmt(getCategoryTotalFromParts(normaliseBudgetParts(catForm.parts, defaultParticipantCount)))}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowCatForm(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSaveCat} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : editingCat ? 'Update' : 'Add'}</button>
              </div>
            </div>
          )}

          {categories.length === 0 && !showCatForm ? (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg py-12 text-center text-brand-cream/40">No categories yet</div>
          ) : (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-black"><tr>{['','Category','Budget','Spent','Remaining',''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {categories.map((cat) => {
                    const parsed = parseCategoryNotes(cat.notes, cat.planned_aud, defaultParticipantCount);
                    return (
                      <tr key={cat.id} className="hover:bg-brand-tan/5">
                        <td className="px-4 py-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} /></td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-cream">{cat.name}</p>
                          <p className="text-xs text-brand-cream/40">{parsed.parts.length} part{parsed.parts.length === 1 ? '' : 's'}</p>
                        </td>
                        <td className="px-4 py-3 text-brand-cream/70">{fmt(cat.planned_aud)}</td>
                        <td className="px-4 py-3"><span className={cat.over_budget ? 'text-red-400' : 'text-brand-cream/70'}>{fmt(cat.spent_aud ?? 0)}</span></td>
                        <td className="px-4 py-3"><span className={cat.over_budget ? 'text-red-400 font-semibold' : 'text-green-400'}>{fmt(Math.abs(cat.remaining_aud ?? 0))}{cat.over_budget ? ' over' : ''}</span></td>
                        <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => openCatForm(cat)} className="p-1 text-brand-cream/30 hover:text-brand-cream"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteCat(cat.id)} className="p-1 text-brand-cream/30 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SETTINGS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'settings' && (
        <div className="max-w-lg space-y-5">
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-brand-cream">Budget Configuration</h3>
            <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Total Budget (AUD)</label><input type="number" min="0" step="100" value={settings.total_budget_aud} onChange={(e) => setSettings({ ...settings, total_budget_aud: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /><p className="text-xs text-brand-cream/30 mt-1">Used for cost-share calculation per member</p></div>
            <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label><textarea rows={3} value={settings.notes ?? ''} onChange={(e) => setSettings({ ...settings, notes: e.target.value || null })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
          </div>

          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-6 space-y-5">
            <h3 className="font-semibold text-brand-cream">Member Visibility</h3>
            <p className="text-xs text-brand-cream/40">Control what members can see in their trip budget view</p>
            {[
              { key: 'show_group_budget_to_members' as const, label: 'Show group budget to members', desc: 'Members see budget health, categories, and spend progress' },
              { key: 'show_individual_breakdown_to_members' as const, label: 'Show individual cost breakdown', desc: 'Each member sees their own cost share and payment status' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-4 cursor-pointer">
                <div className="relative mt-0.5 flex-shrink-0">
                  <input type="checkbox" className="sr-only" checked={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} />
                  <div className={`w-11 h-6 rounded-full transition-colors ${settings[key] ? 'bg-brand-tan' : 'bg-brand-black border border-brand-tan/30'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-1 mx-1 ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
                <div><p className="font-medium text-brand-cream text-sm">{label}</p><p className="text-xs text-brand-cream/40 mt-0.5">{desc}</p></div>
              </label>
            ))}
          </div>

          <button onClick={handleSaveSettings} disabled={saving} className="w-full bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
