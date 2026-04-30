'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DollarSign, Plus, Trash2, Edit2, X, CheckCircle2, AlertCircle,
  TrendingUp, Settings, LayoutGrid, Eye, EyeOff,
  RefreshCw, Upload, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  BookOpen, ChevronDown, ChevronUp, Info, Wallet, Repeat, ArrowLeftRight,
  Building2, Landmark, Search, Download,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ExpenseImportPanel from '@/components/budget/ExpenseImportPanel';
import PaymentImportPanel from '@/components/payments/PaymentImportPanel';
import { getMemberDisplayName, getMemberListName } from '@/lib/member-display';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; planned_aud: number; color: string; sort_order: number; notes: string | null; spent_aud?: number; remaining_aud?: number; over_budget?: boolean; }
type BudgetPartBasis = 'per_person' | 'group';
type BudgetPaymentType = 'group' | 'personal';
interface BudgetPart { id: string; name: string; basis: BudgetPartBasis; amount_aud: number; member_count: number; payment_type: BudgetPaymentType; }
interface Expense {
  id: string; description: string; amount: number; currency: string; amount_aud: number;
  expense_date: string; category: { id: string; name: string; color: string } | null;
  paid_by_type: string; paid_by_label: string | null;
  payer: { id: string; full_name: string | null; nickname: string | null } | null;
  notes: string | null; source: string; reconciled: boolean;
}
interface LedgerRow { id: string; type: 'income' | 'expense'; sub_type: string; date: string; description: string; amount_aud: number; running_balance: number; reconciled: boolean; source: string; category?: unknown; notes?: string | null; currency?: string; amount_original?: number; }
interface MemberPayment { id: string; member_id: string; payment_date: string; amount: number; payment_method: string | null; notes: string | null; profiles?: { full_name: string | null; nickname: string | null }; }
interface PaymentMilestone { id: string; trip_id: string; milestone_date: string; accumulated_amount: number; description: string | null; }
interface MemberPaymentSummary { member_id: string; full_name: string; nickname?: string | null; total_paid: number; payment_count: number; last_payment_date: string | null; }
interface IncomeEntry { id: string; description: string; amount_aud: number; income_date: string; category: string | null; notes: string | null; source: string; reconciled: boolean; }
interface MemberBreakdown { user_id: string; full_name: string | null; nickname: string | null; total_paid_aud: number; cost_share_aud: number; kitty_share_aud?: number; personal_budget_aud?: number; total_trip_cost_aud?: number; remaining_aud: number; }
interface Overview { total_budget_aud: number; total_income_aud: number; total_collected_from_members_aud: number; total_manual_income_aud: number; total_interest_income_aud?: number; total_spent_aud: number; net_position_aud: number; budget_remaining_aud: number; collection_gap_aud: number; member_count: number; cost_share_per_member_aud: number; kitty_per_member_aud?: number; personal_budget_per_member_aud?: number; total_group_planned_aud?: number; total_personal_planned_aud?: number; kitty_requirement_aud?: number; unreconciled_count: number; }
interface BudgetSettings { total_budget_aud: number; per_person_budget_aud: number; exchange_rate_mad_aud: number; show_group_budget_to_members: boolean; show_individual_breakdown_to_members: boolean; enabled_currencies: string[]; notes: string | null; }
interface AccountBalances { westpac_choice: number; westpac_life: number; paypal: number; balance_date: string; }
interface TripPaymentSettings {
  flights_cost_aud: number;
  show_payment_options: boolean;
  monthly_option_title: string;
  monthly_option_amount_label: string;
  monthly_option_description: string;
  quarterly_option_title: string;
  quarterly_option_amount_label: string;
  quarterly_option_description: string;
  show_bank_details: boolean;
  bank_account_name: string;
  bank_bsb: string;
  bank_account_number: string;
  bank_payid: string;
  bank_notes: string;
  payment_sources: PaymentSource[];
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
type TransactionNoteMeta = {
  text: string;
  account_source_id: string | null;
  transfer_link_id?: string | null;
  transfer_direction?: 'in' | 'out' | null;
  linked_transaction_id?: string | null;
  counterparty_account_id?: string | null;
  payment_category?: string | null;  // member payment type label
};
type ParsedCategoryNotes = {
  notes_text?: unknown;
  parts?: unknown[];
};
type AccountOption = {
  id: string;
  name: string;
  accountType: 'bank_account' | 'paypal' | 'paypal_wallet';
  sourceType: PaymentSourceType;
  sourceId: string;
  isMemberPortalSource: boolean;
};
type ReconcileType = 'expense' | 'income';
type ReconcileChange = {
  type: ReconcileType;
  id: string;
  reconciled: boolean;
};
type AccountAssignmentChange = {
  type: 'expense' | 'income';
  id: string;
  accountId: string;
};
type TripMemberWithProfileRow = {
  user_id: string;
  profiles: {
    full_name: string | null;
    nickname: string | null;
  } | null;
};

const CURRENCIES = ['AUD', 'MAD', 'USD', 'EUR'];
const CATEGORY_COLORS = ['#B5621E','#C9B98A','#6B8E6B','#6B7FAE','#AE6B6B','#AE8B6B','#8B6BAE','#6BAEAE','#AE6BAE','#888888'];
const DEFAULT_CATEGORIES = [
  { name: 'Flights', color: '#6B7FAE' }, { name: 'Accommodation', color: '#6B8E6B' },
  { name: 'Ground Transport', color: '#B5621E' }, { name: 'Guides & Experiences', color: '#AE8B6B' },
  { name: 'Food & Drink', color: '#C9B98A' }, { name: 'Gear & Equipment', color: '#8B6BAE' },
  { name: 'Visas & Insurance', color: '#6BAEAE' }, { name: 'Contingency', color: '#888888' },
];
const DEFAULT_PAYMENT_SETTINGS: TripPaymentSettings = {
  flights_cost_aud: 0,
  show_payment_options: false,
  monthly_option_title: 'Monthly Option',
  monthly_option_amount_label: '',
  monthly_option_description: '',
  quarterly_option_title: 'Quarterly Option',
  quarterly_option_amount_label: '',
  quarterly_option_description: '',
  show_bank_details: false,
  bank_account_name: '',
  bank_bsb: '',
  bank_account_number: '',
  bank_payid: '',
  bank_notes: '',
  payment_sources: [],
};

// Stable account IDs — never change these values; they are persisted in expense/income notes JSON
const BUDGET_ACCOUNTS: { id: string; name: string; accountType: 'bank_account' | 'paypal' }[] = [
  { id: 'westpac_choice', name: 'Westpac Choice (524337)', accountType: 'bank_account' },
  { id: 'westpac_life',   name: 'Westpac Life (253840)',   accountType: 'bank_account' },
  { id: 'paypal',         name: 'PayPal',                   accountType: 'paypal' },
];

function createPaymentSource(
  type: PaymentSourceType,
  override: Partial<PaymentSource> = {}
): PaymentSource {
  const baseId = `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (type === 'paypal') {
    return {
      id: baseId,
      type,
      name: 'PayPal',
      member_portal_enabled: false,
      account_name: '',
      bsb: '',
      account_number: '',
      payid: '',
      notes: '',
      wallets: [
        {
          id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          currency: 'AUD',
          label: 'AUD Wallet',
          email: '',
          notes: '',
        },
      ],
      ...override,
    };
  }

  return {
    id: baseId,
    type,
    name: 'Bank Account',
    member_portal_enabled: false,
    account_name: '',
    bsb: '',
    account_number: '',
    payid: '',
    notes: '',
    wallets: [],
    ...override,
  };
}

function createDefaultPaymentSources() {
  return [
    createPaymentSource('bank_account', { name: 'Bank Account 1' }),
    createPaymentSource('bank_account', { name: 'Bank Account 2' }),
    createPaymentSource('paypal', { name: 'PayPal' }),
  ];
}

function normaliseWallet(wallet: Partial<PayPalWallet>): PayPalWallet {
  return {
    id: wallet.id || `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      const source = (raw && typeof raw === 'object') ? (raw as Partial<PaymentSource>) : null;
      if (!source) return null;
      const type: PaymentSourceType = source.type === 'paypal' ? 'paypal' : 'bank_account';
      const wallets = Array.isArray(source.wallets)
        ? source.wallets.map((wallet) => normaliseWallet(wallet as Partial<PayPalWallet>))
        : [];
      const normalised = createPaymentSource(type, {
        id: typeof source.id === 'string' ? source.id : undefined,
        name: typeof source.name === 'string' ? source.name : undefined,
        member_portal_enabled: source.member_portal_enabled === true,
        account_name: typeof source.account_name === 'string' ? source.account_name : undefined,
        bsb: typeof source.bsb === 'string' ? source.bsb : undefined,
        account_number: typeof source.account_number === 'string' ? source.account_number : undefined,
        payid: typeof source.payid === 'string' ? source.payid : undefined,
        notes: typeof source.notes === 'string' ? source.notes : undefined,
        wallets,
      });
      return normalised;
    })
    .filter((source): source is PaymentSource => source !== null);
}

function parsePaymentSourcesPayload(rawBankNotes: unknown): { notes: string; sources: PaymentSource[] } {
  const rawNotes = typeof rawBankNotes === 'string' ? rawBankNotes : '';
  if (!rawNotes) return { notes: '', sources: [] };

  try {
    const parsed = JSON.parse(rawNotes) as {
      version?: number;
      note?: unknown;
      sources?: unknown;
    };
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sources)) {
      return {
        notes: typeof parsed.note === 'string' ? parsed.note : '',
        sources: normalisePaymentSources(parsed.sources),
      };
    }
  } catch {
    // Legacy plain-text notes are still supported.
  }

  return { notes: rawNotes, sources: [] };
}

function parseTransactionNote(rawNotes: string | null): TransactionNoteMeta {
  if (!rawNotes) return { text: '', account_source_id: null, transfer_link_id: null, transfer_direction: null, linked_transaction_id: null, counterparty_account_id: null, payment_category: null };
  try {
    const parsed = JSON.parse(rawNotes) as {
      text?: unknown;
      account_source_id?: unknown;
      transfer_link_id?: unknown;
      transfer_direction?: unknown;
      linked_transaction_id?: unknown;
      counterparty_account_id?: unknown;
      payment_category?: unknown;
    };
    if (parsed && typeof parsed === 'object' && ('text' in parsed || 'account_source_id' in parsed)) {
      return {
        text: typeof parsed.text === 'string' ? parsed.text : '',
        account_source_id: typeof parsed.account_source_id === 'string' ? parsed.account_source_id : null,
        transfer_link_id: typeof parsed.transfer_link_id === 'string' ? parsed.transfer_link_id : null,
        transfer_direction: parsed.transfer_direction === 'in' || parsed.transfer_direction === 'out' ? parsed.transfer_direction : null,
        linked_transaction_id: typeof parsed.linked_transaction_id === 'string' ? parsed.linked_transaction_id : null,
        counterparty_account_id: typeof parsed.counterparty_account_id === 'string' ? parsed.counterparty_account_id : null,
        payment_category: typeof parsed.payment_category === 'string' ? parsed.payment_category : null,
      };
    }
  } catch {
    // Backwards compatibility for plain text notes.
  }
  return { text: rawNotes, account_source_id: null, transfer_link_id: null, transfer_direction: null, linked_transaction_id: null, counterparty_account_id: null, payment_category: null };
}

function encodeTransactionNote(
  text: string,
  accountSourceId: string | null,
  transferMeta?: Partial<Pick<TransactionNoteMeta, 'transfer_link_id' | 'transfer_direction' | 'linked_transaction_id' | 'counterparty_account_id'>>,
  paymentCategory?: string | null,
): string | null {
  const noteText = text.trim();
  const hasTransferMeta = Boolean(
    transferMeta?.transfer_link_id ||
    transferMeta?.transfer_direction ||
    transferMeta?.linked_transaction_id ||
    transferMeta?.counterparty_account_id
  );
  if (!noteText && !accountSourceId && !hasTransferMeta && !paymentCategory) return null;
  return JSON.stringify({
    text: noteText || '',
    account_source_id: accountSourceId || null,
    transfer_link_id: transferMeta?.transfer_link_id || null,
    transfer_direction: transferMeta?.transfer_direction || null,
    linked_transaction_id: transferMeta?.linked_transaction_id || null,
    counterparty_account_id: transferMeta?.counterparty_account_id || null,
    ...(paymentCategory ? { payment_category: paymentCategory } : {}),
  });
}

function getTransactionNoteText(rawNotes: string | null): string {
  return parseTransactionNote(rawNotes).text;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  instalment: 'Instalment',
  deposit: 'Deposit',
  final: 'Final',
  catchup: 'Catch-up',
  other: 'Other',
};

function getPaymentTypeLabel(rawNotes: string | null): string | null {
  const cat = parseTransactionNote(rawNotes).payment_category;
  if (!cat) return null;
  return PAYMENT_TYPE_LABELS[cat] ?? cat;
}

function isLinkedTransferNote(note: TransactionNoteMeta): boolean {
  return Boolean(note.transfer_link_id && note.linked_transaction_id && (note.transfer_direction === 'in' || note.transfer_direction === 'out'));
}

function createBudgetPart(defaultMemberCount: number): BudgetPart {
  return {
    id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    basis: 'per_person',
    amount_aud: 0,
    member_count: Math.max(1, defaultMemberCount),
    payment_type: 'group',
  };
}

function normaliseBudgetParts(parts: BudgetPart[], defaultMemberCount: number): BudgetPart[] {
  const safeDefault = Math.max(1, defaultMemberCount);
  return parts
    .map((part) => ({
      id: part.id || `part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: (part.name || '').trim(),
      basis: (part.basis === 'group' ? 'group' : 'per_person') as BudgetPartBasis,
      amount_aud: Number.isFinite(Number(part.amount_aud)) ? Math.max(0, Number(part.amount_aud)) : 0,
      member_count: Number.isFinite(Number(part.member_count)) ? Math.max(1, Math.floor(Number(part.member_count))) : safeDefault,
      payment_type: (part.payment_type === 'personal' ? 'personal' : 'group') as BudgetPaymentType,
    }))
    .filter((part) => part.name.length > 0 || part.amount_aud > 0);
}

function getCategoryGroupTotal(parts: BudgetPart[]): number {
  return parts.filter((p) => p.payment_type !== 'personal').reduce((sum, p) => sum + getBudgetPartTotal(p), 0);
}

function getCategoryPersonalTotal(parts: BudgetPart[]): number {
  return parts.filter((p) => p.payment_type === 'personal').reduce((sum, p) => sum + getBudgetPartTotal(p), 0);
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
): { notesText: string; parts: BudgetPart[]; committed_aud: number } {
  const fallbackPart: BudgetPart = {
    id: `part-fallback-${Date.now()}`,
    name: 'Main',
    basis: 'group',
    amount_aud: Number(plannedAud) || 0,
    member_count: Math.max(1, defaultMemberCount),
    payment_type: 'group',
  };
  if (!rawNotes) {
    return { notesText: '', parts: [fallbackPart], committed_aud: 0 };
  }

  try {
    const parsed = JSON.parse(rawNotes);
    if (parsed && typeof parsed === 'object') {
      const parsedNotes = parsed as ParsedCategoryNotes & { committed_aud?: unknown };
      const partsRaw = Array.isArray(parsedNotes.parts) ? parsedNotes.parts : [];
      const normalised = normaliseBudgetParts(partsRaw as BudgetPart[], defaultMemberCount);
      return {
        notesText: typeof parsedNotes.notes_text === 'string'
          ? parsedNotes.notes_text
          : '',
        parts: normalised.length > 0 ? normalised : [fallbackPart],
        committed_aud: typeof parsedNotes.committed_aud === 'number' ? parsedNotes.committed_aud : 0,
      };
    }
  } catch {
    // Backwards compatibility for plain-text notes
  }

  return { notesText: rawNotes, parts: [fallbackPart], committed_aud: 0 };
}

function encodeCategoryNotes(notesText: string, parts: BudgetPart[], committedAud: number): string | null {
  const payload = {
    notes_text: notesText.trim() || null,
    parts,
    committed_aud: committedAud || null,
  };
  return JSON.stringify(payload);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

function fmt(n: number) { return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtSigned(n: number) { return (n >= 0 ? '+' : '') + fmt(n); }
/** Parse a YYYY-MM-DD date string as local noon to avoid timezone-off-by-one in AU */
function parseLocalDate(ds: string): Date {
  // For full ISO timestamps (contains 'T' or 'Z'), use as-is
  if (ds.includes('T') || ds.includes('Z')) return new Date(ds);
  const [y, m, d] = ds.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
function fmtDate(d: string) { return parseLocalDate(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtShort(d: string) { return parseLocalDate(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); }
function normalisePaymentSettings(
  raw: Partial<Record<keyof TripPaymentSettings, unknown>> | null | undefined
): TripPaymentSettings {
  const parsedPaymentSourcePayload = parsePaymentSourcesPayload(raw?.bank_notes);
  const legacyBankSource = createPaymentSource('bank_account', {
    name: 'Bank Account 1',
    account_name: typeof raw?.bank_account_name === 'string' ? raw.bank_account_name : '',
    bsb: typeof raw?.bank_bsb === 'string' ? raw.bank_bsb : '',
    account_number: typeof raw?.bank_account_number === 'string' ? raw.bank_account_number : '',
    payid: typeof raw?.bank_payid === 'string' ? raw.bank_payid : '',
  });
  const hasLegacyBankDetails = Boolean(
    legacyBankSource.account_name ||
    legacyBankSource.bsb ||
    legacyBankSource.account_number ||
    legacyBankSource.payid
  );
  const sources = parsedPaymentSourcePayload.sources.length > 0
    ? parsedPaymentSourcePayload.sources
    : hasLegacyBankDetails
      ? [legacyBankSource, createPaymentSource('bank_account', { name: 'Bank Account 2' }), createPaymentSource('paypal', { name: 'PayPal' })]
      : createDefaultPaymentSources();
  const bankSources = sources.filter((source) => source.type === 'bank_account');
  const hasSelectedMemberPortalAccount = bankSources.some((source) => source.member_portal_enabled);
  const sourcesWithMemberPortalSelection = sources.map((source, index) => (
    source.type === 'bank_account'
      ? { ...source, member_portal_enabled: hasSelectedMemberPortalAccount ? source.member_portal_enabled : index === 0 }
      : source
  ));

  return {
    flights_cost_aud: Number(raw?.flights_cost_aud ?? 0),
    show_payment_options: raw?.show_payment_options === true,
    monthly_option_title: typeof raw?.monthly_option_title === 'string' ? raw.monthly_option_title : 'Monthly Option',
    monthly_option_amount_label: typeof raw?.monthly_option_amount_label === 'string' ? raw.monthly_option_amount_label : '',
    monthly_option_description: typeof raw?.monthly_option_description === 'string' ? raw.monthly_option_description : '',
    quarterly_option_title: typeof raw?.quarterly_option_title === 'string' ? raw.quarterly_option_title : 'Quarterly Option',
    quarterly_option_amount_label: typeof raw?.quarterly_option_amount_label === 'string' ? raw.quarterly_option_amount_label : '',
    quarterly_option_description: typeof raw?.quarterly_option_description === 'string' ? raw.quarterly_option_description : '',
    show_bank_details: raw?.show_bank_details === true,
    bank_account_name: typeof raw?.bank_account_name === 'string' ? raw.bank_account_name : '',
    bank_bsb: typeof raw?.bank_bsb === 'string' ? raw.bank_bsb : '',
    bank_account_number: typeof raw?.bank_account_number === 'string' ? raw.bank_account_number : '',
    bank_payid: typeof raw?.bank_payid === 'string' ? raw.bank_payid : '',
    bank_notes: parsedPaymentSourcePayload.notes,
    payment_sources: sourcesWithMemberPortalSelection,
  };
}

function getMemberPortalAccountId(sources: PaymentSource[]): string | null {
  const selectedBankSource = sources.find((source) => source.type === 'bank_account' && source.member_portal_enabled);
  return selectedBankSource?.id || null;
}

// ── Table sort helpers ────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';

function sortBy<T>(arr: T[], keyFn: (item: T) => string | number, dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    const av = keyFn(a), bv = keyFn(b);
    if (av === bv) return 0;
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return dir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
  });
}

function SortTh({ label, colKey, sortKey, sortDir, onSort, className }: {
  label: string; colKey: string; sortKey: string; sortDir: SortDir;
  onSort: (key: string) => void; className?: string;
}) {
  const active = colKey === sortKey;
  return (
    <th
      onClick={() => onSort(colKey)}
      className={`px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase cursor-pointer hover:text-brand-cream/70 select-none whitespace-nowrap ${className ?? ''}`}
    >
      {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : <span className="opacity-30"> ↕</span>}
    </th>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminBudgetPage() {
  const params = useParams();
  const tripId = params.id as string;
  const supabase = createClient();

  type Tab = 'pl' | 'accounts' | 'ledger' | 'income' | 'expenses' | 'reconcile' | 'categories' | 'settings';
  const [tab, setTab] = useState<Tab>('pl');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingReconcile, setApplyingReconcile] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Data
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [memberPayments, setMemberPayments] = useState<MemberPayment[]>([]);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentMilestone[]>([]);
  const [memberPaymentSummary, setMemberPaymentSummary] = useState<MemberPaymentSummary[]>([]);
  const [memberSortKey, setMemberSortKey] = useState<'name' | 'paid' | 'remaining'>('name');
  const [memberSortDir, setMemberSortDir] = useState<'asc' | 'desc'>('asc');
  const [cashflowSortKey, setCashflowSortKey] = useState<'name' | 'inflow' | 'outflow' | 'net'>('name');
  const [cashflowSortDir, setCashflowSortDir] = useState<SortDir>('asc');
  const [memberContribSortKey, setMemberContribSortKey] = useState<'name' | 'kitty' | 'personal' | 'paid' | 'remaining'>('name');
  const [memberContribSortDir, setMemberContribSortDir] = useState<SortDir>('asc');
  const [transferSortKey, setTransferSortKey] = useState<'date' | 'description' | 'amount'>('date');
  const [transferSortDir, setTransferSortDir] = useState<SortDir>('desc');
  const [ledgerSortKey, setLedgerSortKey] = useState<'date' | 'description' | 'amount' | 'balance'>('date');
  const [ledgerSortDir, setLedgerSortDir] = useState<SortDir>('desc');
  const [incomeSortKey, setIncomeSortKey] = useState<'date' | 'description' | 'amount'>('date');
  const [incomeSortDir, setIncomeSortDir] = useState<SortDir>('desc');
  const [expenseSortKey, setExpenseSortKey] = useState<'date' | 'description' | 'amount_aud'>('date');
  const [expenseSortDir, setExpenseSortDir] = useState<SortDir>('desc');
  const [unassignedSortKey, setUnassignedSortKey] = useState<'date' | 'description' | 'amount'>('date');
  const [unassignedSortDir, setUnassignedSortDir] = useState<SortDir>('desc');
  const [catSortKey, setCatSortKey] = useState<'name' | 'group' | 'personal' | 'spent' | 'remaining'>('name');
  const [catSortDir, setCatSortDir] = useState<SortDir>('asc');
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [memberBreakdown, setMemberBreakdown] = useState<MemberBreakdown[]>([]);
  const [tripMembers, setTripMembers] = useState<{ id: string; full_name: string | null; nickname: string | null }[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>({ total_budget_aud: 0, per_person_budget_aud: 0, exchange_rate_mad_aud: 0.14, show_group_budget_to_members: true, show_individual_breakdown_to_members: true, enabled_currencies: ['AUD'], notes: null });
  // When the per-person budget was last auto-computed from group total (or vice versa)
  const [budgetSyncMode, setBudgetSyncMode] = useState<'group_drives' | 'per_person_drives'>('per_person_drives');
  const [deletingAll, setDeletingAll] = useState(false);

  // Master ledger add form
  const [showLedgerAddForm, setShowLedgerAddForm] = useState(false);
  const emptyLedgerAddForm = () => ({
    txType: 'expense' as 'expense' | 'income',
    description: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'AUD',
    exchange_rate: '',
    amount_aud: '',
    amount_aud_overridden: false,
    category_id: '',
    account_source_id: '',
    paid_by_type: 'group_kitty',
    paid_by_member: '',
    income_category: 'other',
    notes: '',
  });
  const [ledgerAddForm, setLedgerAddForm] = useState(emptyLedgerAddForm());

  // UI state — expense form
  const [showExpForm, setShowExpForm] = useState(false);
  const [showExpImport, setShowExpImport] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState({
    description: '', amount: '', currency: 'AUD', exchange_rate: '',
    amount_aud: '', amount_aud_overridden: false,
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '', paid_by_type: 'group_kitty', paid_by_member: '', paid_by_label: '', account_source_id: '', notes: '',
  });

  // UI state — income form
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentImport, setShowPaymentImport] = useState(false);
  const [showLegacyPaymentSection, setShowLegacyPaymentSection] = useState(true);
  const [showPlannerIncomeSection, setShowPlannerIncomeSection] = useState(true);
  const [expandedMemberPayments, setExpandedMemberPayments] = useState<Record<string, boolean>>({});
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ description: '', amount_aud: '', income_date: new Date().toISOString().split('T')[0], category: 'other', account_source_id: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({
    member_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    payment_type: 'instalment',   // payment category / type label
    account_source_id: '',
    notes: '',
  });
  const [editingPayment, setEditingPayment] = useState<MemberPayment | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<TripPaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<PaymentMilestone | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    milestone_date: new Date().toISOString().split('T')[0],
    accumulated_amount: '',
    description: '',
  });
  const [editingLedgerRow, setEditingLedgerRow] = useState<LedgerRow | null>(null);
  const [showLedgerEditForm, setShowLedgerEditForm] = useState(false);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Set<string>>(new Set());
  const [bulkDeletingLedger, setBulkDeletingLedger] = useState(false);
  const [ledgerEditForm, setLedgerEditForm] = useState({
    description: '',
    date: new Date().toISOString().split('T')[0],
    amount_aud: '',
    account_source_id: '',
    payment_method: 'bank_transfer',
    notes: '',
  });
  const [ledgerActionMode, setLedgerActionMode] = useState<'none' | 'transfer' | 'interest' | 'fx'>('none');
  const [transferForm, setTransferForm] = useState({
    transfer_date: new Date().toISOString().split('T')[0],
    from_account_id: '',
    to_account_id: '',
    amount_aud: '',
    notes: '',
  });
  const [interestForm, setInterestForm] = useState({
    income_date: new Date().toISOString().split('T')[0],
    account_id: '',
    amount_aud: '',
    description: 'Interest Income',
    notes: '',
  });
  const [fxForm, setFxForm] = useState({
    income_date: new Date().toISOString().split('T')[0],
    account_id: '',
    amount_aud: '',
    description: 'Currency Change / FX Fluctuation',
    notes: '',
  });
  const [lastImport, setLastImport] = useState<{ imported_at: string; row_count: number } | null>(null);

  // UI state — account balances (cash position)
  const [accountBalances, setAccountBalances] = useState<AccountBalances>({ westpac_choice: 0, westpac_life: 0, paypal: 0, balance_date: new Date().toISOString().split('T')[0] });
  const [interestRatePa, setInterestRatePa] = useState(0); // annual % rate e.g. 4.5
  const [editingBalances, setEditingBalances] = useState(false);
  const [balanceForm, setBalanceForm] = useState<AccountBalances>({ westpac_choice: 0, westpac_life: 0, paypal: 0, balance_date: new Date().toISOString().split('T')[0] });
  const [settingsNotesText, setSettingsNotesText] = useState(''); // free-text notes separate from JSON blob

  // Bank import state
  const [bankImportAccount, setBankImportAccount] = useState('westpac_choice');
  const [bankImportClosingBalance, setBankImportClosingBalance] = useState('');

  // UI state — recurring income generator
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringForm, setRecurringForm] = useState({ description: 'Westpac Life Interest', amount_aud: '', start_date: new Date().toISOString().split('T')[0], months: '3', category: 'interest', account_source_id: '' });

  // UI state — expense search/filter
  const [expenseSearch, setExpenseSearch] = useState('');
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState('');
  const [pendingReconcileChanges, setPendingReconcileChanges] = useState<Record<string, ReconcileChange>>({});
  const [pendingAccountAssignments, setPendingAccountAssignments] = useState<Record<string, AccountAssignmentChange>>({});

  // UI state — bank CSV import
  const [showBankImport, setShowBankImport] = useState(false);
  const [bankCsvText, setBankCsvText] = useState('');
  const [bankCsvRows, setBankCsvRows] = useState<{ date: string; description: string; debit: number; credit: number; selected: boolean; type: 'income' | 'expense' | 'skip'; category_id: string }[]>([]);

  // UI state — category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({
    name: '',
    color: '#B5621E',
    notes_text: '',
    committed_aud: '0',
    parts: [createBudgetPart(1)] as BudgetPart[],
  });

  const showToast = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };
  const resetPaymentForm = () => {
    setEditingPayment(null);
    setPaymentForm({
      member_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      payment_type: 'instalment',
      account_source_id: getMemberPortalAccountId(paymentSettings.payment_sources) || '',
      notes: '',
    });
  };
  const resetMilestoneForm = () => {
    setEditingMilestone(null);
    setMilestoneForm({
      milestone_date: new Date().toISOString().split('T')[0],
      accumulated_amount: '',
      description: '',
    });
  };
  // Always returns a stable account ID for new transactions (Westpac Choice = primary operational account)
  const getDefaultInternalAccountId = () => 'westpac_choice';

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
      if (d.settings) {
        setSettings({
          ...d.settings,
          per_person_budget_aud: d.settings.per_person_budget_aud ?? 0,
          enabled_currencies: Array.isArray(d.settings.enabled_currencies) && d.settings.enabled_currencies.length > 0
            ? d.settings.enabled_currencies
            : ['AUD'],
        });
        // Load account balances, interest rate, and free-text notes from settings.notes JSON blob
        if (d.settings.notes) {
          try {
            const parsed = JSON.parse(d.settings.notes);
            if (parsed?.account_balances) {
              const ab = parsed.account_balances as Partial<AccountBalances>;
              const balances: AccountBalances = {
                westpac_choice: Number(ab.westpac_choice || 0),
                westpac_life: Number(ab.westpac_life || 0),
                paypal: Number(ab.paypal || 0),
                balance_date: typeof ab.balance_date === 'string' ? ab.balance_date : new Date().toISOString().split('T')[0],
              };
              setAccountBalances(balances);
              setBalanceForm(balances);
            }
            if (parsed?.interest_rate_pa !== undefined) {
              setInterestRatePa(Number(parsed.interest_rate_pa) || 0);
            }
            if (typeof parsed?.notes_text === 'string') {
              setSettingsNotesText(parsed.notes_text);
            }
          } catch {
            // notes is plain text (legacy), treat it as the free-text note
            setSettingsNotesText(d.settings.notes);
          }
        }
      }

      const paymentRes = await fetch(`/api/payments/schedule?trip_id=${tripId}`, { headers: h });
      if (paymentRes.ok) {
        const paymentJson = await paymentRes.json();
        setPaymentSchedule(paymentJson.schedule ?? []);
        setMemberPaymentSummary(paymentJson.memberPaymentSummary ?? []);
        setPaymentSettings(normalisePaymentSettings(paymentJson.paymentSettings));
      } else {
        setPaymentSchedule([]);
        setMemberPaymentSummary([]);
        setPaymentSettings(DEFAULT_PAYMENT_SETTINGS);
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
      if (data) {
        setTripMembers((data as TripMemberWithProfileRow[]).map((m) => ({
          id: m.user_id,
          full_name: m.profiles?.full_name ?? null,
          nickname: m.profiles?.nickname ?? null,
        })));
      }
    };
    load();
  }, [tripId, supabase]);

  // ── AUD calculation when expense form currency/amount changes ─────────────

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
      const expenseNote = parseTransactionNote(exp.notes);
      if (isLinkedTransferNote(expenseNote) || exp.description.toLowerCase().startsWith('transfer ')) {
        showToast('error', 'Transfer expenses cannot be edited individually. Delete and recreate the transfer.');
        return;
      }
      setEditingExp(exp);
      setExpForm({
        description: exp.description, amount: String(exp.amount), currency: exp.currency,
        exchange_rate: String(exp.amount > 0 && exp.amount_aud > 0 && exp.currency !== 'AUD' ? (exp.amount_aud / exp.amount).toFixed(6) : ''),
        amount_aud: String(exp.amount_aud), amount_aud_overridden: false,
        expense_date: exp.expense_date, category_id: exp.category?.id ?? '',
        paid_by_type: exp.paid_by_type || 'group_kitty',
        paid_by_member: exp.payer?.id ?? '', paid_by_label: exp.paid_by_label ?? '',
        account_source_id: expenseNote.account_source_id || getDefaultInternalAccountId(),
        notes: expenseNote.text,
      });
    } else {
      setEditingExp(null);
      setExpForm({ description: '', amount: '', currency: 'AUD', exchange_rate: '', amount_aud: '', amount_aud_overridden: false, expense_date: new Date().toISOString().split('T')[0], category_id: '', paid_by_type: 'group_kitty', paid_by_member: '', paid_by_label: '', account_source_id: getDefaultInternalAccountId(), notes: '' });
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
        notes: encodeTransactionNote(expForm.notes, expForm.account_source_id || null), source: 'manual',
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
    const existingExpense = expenses.find((entry) => entry.id === id);
    const expenseNote = parseTransactionNote(existingExpense?.notes ?? null);
    const deletingLinkedTransfer = isLinkedTransferNote(expenseNote);
    if (!confirm(deletingLinkedTransfer ? 'Delete this linked transfer pair?' : 'Delete this expense?')) return;
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/trips/${tripId}/budget/expenses/${id}`, { method: 'DELETE', headers: h });
      if (!res.ok) throw new Error();
      if (deletingLinkedTransfer && expenseNote.linked_transaction_id) {
        await fetch(`/api/trips/${tripId}/budget/income?entryId=${expenseNote.linked_transaction_id}`, { method: 'DELETE', headers: h });
      }
      showToast('success', 'Expense deleted'); fetchData();
    } catch { showToast('error', 'Failed to delete expense'); }
  };

  // ── Income CRUD ───────────────────────────────────────────────────────────

  const handleSaveIncome = async () => {
    if (!incomeForm.description || !incomeForm.amount_aud || !incomeForm.income_date) return showToast('error', 'All fields are required');
    const parsedAmount = Number(incomeForm.amount_aud);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return showToast('error', 'Income amount must be greater than zero');
    if (incomeForm.category === 'transfer') {
      return showToast('error', 'Use the Ledger Transfer action to create linked transfer entries');
    }
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/income`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          ...incomeForm,
          amount_aud: parsedAmount,
          notes: encodeTransactionNote(incomeForm.notes, incomeForm.account_source_id || null),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('success', 'Income entry added');
      setShowIncomeForm(false);
      setIncomeForm({ description: '', amount_aud: '', income_date: new Date().toISOString().split('T')[0], category: 'other', account_source_id: getDefaultInternalAccountId(), notes: '' });
      fetchData();
    } catch { showToast('error', 'Failed to save income entry'); }
    finally { setSaving(false); }
  };

  const handleDeleteIncome = async (id: string) => {
    const existingIncome = incomeEntries.find((entry) => entry.id === id);
    const incomeNote = parseTransactionNote(existingIncome?.notes ?? null);
    const deletingLinkedTransfer = isLinkedTransferNote(incomeNote);
    if (!confirm(deletingLinkedTransfer ? 'Delete this linked transfer pair?' : 'Delete this income entry?')) return;
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/trips/${tripId}/budget/income?entryId=${id}`, { method: 'DELETE', headers: h });
      if (!res.ok) throw new Error();
      if (deletingLinkedTransfer && incomeNote.linked_transaction_id) {
        await fetch(`/api/trips/${tripId}/budget/expenses/${incomeNote.linked_transaction_id}`, { method: 'DELETE', headers: h });
      }
      showToast('success', 'Income entry deleted'); fetchData();
    } catch { showToast('error', 'Failed to delete income entry'); }
  };

  const handleSavePayment = async () => {
    if (!paymentForm.member_id || !paymentForm.amount || !paymentForm.payment_date) {
      return showToast('error', 'Member, amount and date are required');
    }

    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const isEditing = !!editingPayment;
      const url = isEditing
        ? `/api/payments/member-payment/${editingPayment!.id}`
        : '/api/payments/member-payment';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: h,
        body: JSON.stringify({
          member_id: paymentForm.member_id,
          ...(isEditing ? {} : { trip_id: tripId }),
          payment_date: paymentForm.payment_date,
          amount: parseFloat(paymentForm.amount),
          payment_method: paymentForm.payment_method || 'bank_transfer',
          notes: encodeTransactionNote(paymentForm.notes, paymentForm.account_source_id || null, undefined, paymentForm.payment_type || null),
        }),
      });
      if (!res.ok) throw new Error();

      showToast('success', isEditing ? 'Payment updated' : 'Payment recorded');
      setShowPaymentForm(false);
      resetPaymentForm();
      fetchData();
    } catch {
      showToast('error', editingPayment ? 'Failed to update payment' : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPayment = (payment: MemberPayment) => {
    const parsedPaymentNote = parseTransactionNote(payment.notes);
    setEditingPayment(payment);
    setPaymentForm({
      member_id: payment.member_id,
      amount: String(payment.amount),
      payment_date: payment.payment_date,
      payment_method: payment.payment_method || 'bank_transfer',
      account_source_id: parsedPaymentNote.account_source_id || getMemberPortalAccountId(paymentSettings.payment_sources) || '',
      notes: parsedPaymentNote.text,
      payment_type: parsedPaymentNote.payment_category || 'instalment',
    });
    setShowPaymentForm(true);
    setShowPaymentImport(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Delete this payment?')) return;
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/payments/member-payment/${paymentId}?trip_id=${encodeURIComponent(tripId)}`, {
        method: 'DELETE',
        headers: h,
      });
      if (!res.ok) throw new Error();
      showToast('success', 'Payment deleted');
      if (editingPayment?.id === paymentId) {
        resetPaymentForm();
        setShowPaymentForm(false);
      }
      setSelectedPaymentIds((prev) => { const next = new Set(prev); next.delete(paymentId); return next; });
      fetchData();
    } catch {
      showToast('error', 'Failed to delete payment');
    }
  };

  const handleBulkDeletePayments = async () => {
    const ids = Array.from(selectedPaymentIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected payment${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const h = await getAuthHeader();
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/payments/member-payment/${id}?trip_id=${encodeURIComponent(tripId)}`, { method: 'DELETE', headers: h })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
      if (failed > 0) {
        showToast('error', `${failed} deletion${failed === 1 ? '' : 's'} failed`);
      } else {
        showToast('success', `${ids.length} payment${ids.length === 1 ? '' : 's'} deleted`);
      }
      setSelectedPaymentIds(new Set());
      if (editingPayment && ids.includes(editingPayment.id)) {
        resetPaymentForm();
        setShowPaymentForm(false);
      }
      fetchData();
    } catch {
      showToast('error', 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSavePaymentSettings = async () => {
    setSaving(true);
    try {
      const selectedMemberPortalSourceId = getMemberPortalAccountId(paymentSettings.payment_sources);
      const sourcePayload = paymentSettings.payment_sources.map((source) => ({
        ...source,
        member_portal_enabled: source.type === 'bank_account' && source.id === selectedMemberPortalSourceId,
        name: source.name || (source.type === 'paypal' ? 'PayPal' : 'Bank Account'),
        wallets: source.type === 'paypal' ? source.wallets.map((wallet) => normaliseWallet(wallet)) : [],
      }));
      const primaryBankSource = sourcePayload.find((source) => source.member_portal_enabled)
        || sourcePayload.find((source) => source.type === 'bank_account')
        || null;
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/payment-settings`, {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({
          ...paymentSettings,
          flights_cost_aud: Number(paymentSettings.flights_cost_aud) || 0,
          bank_account_name: primaryBankSource?.account_name || null,
          bank_bsb: primaryBankSource?.bsb || null,
          bank_account_number: primaryBankSource?.account_number || null,
          bank_payid: primaryBankSource?.payid || null,
          bank_notes: JSON.stringify({
            version: 1,
            note: paymentSettings.bank_notes || null,
            sources: sourcePayload,
          }),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('success', 'Payment settings saved');
      fetchData();
    } catch {
      showToast('error', 'Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  };

  const addPaymentSource = (type: PaymentSourceType) => {
    setPaymentSettings((prev) => ({
      ...prev,
      payment_sources: (() => {
        const countOfType = prev.payment_sources.filter((source) => source.type === type).length;
        const defaultName = type === 'paypal' ? 'PayPal' : `Bank Account ${countOfType + 1}`;
        const hasAnyBankSource = prev.payment_sources.some((source) => source.type === 'bank_account');
        return [...prev.payment_sources, createPaymentSource(type, {
          name: defaultName,
          member_portal_enabled: type === 'bank_account' ? !hasAnyBankSource : false,
        })];
      })(),
    }));
  };

  const removePaymentSource = (sourceId: string) => {
    setPaymentSettings((prev) => ({
      ...prev,
      payment_sources: (() => {
        const remaining = prev.payment_sources.filter((source) => source.id !== sourceId);
        const bankSources = remaining.filter((source) => source.type === 'bank_account');
        const hasSelectedPortalBankSource = bankSources.some((source) => source.member_portal_enabled);
        return remaining.map((source, index) => (
          source.type === 'bank_account' && !hasSelectedPortalBankSource && source.id === bankSources[0]?.id
            ? { ...source, member_portal_enabled: true }
            : source
        ));
      })(),
    }));
  };

  const updatePaymentSource = (sourceId: string, patch: Partial<PaymentSource>) => {
    setPaymentSettings((prev) => ({
      ...prev,
      payment_sources: (() => {
        const updated = prev.payment_sources.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                ...patch,
                member_portal_enabled: patch.type === 'paypal' ? false : source.member_portal_enabled,
                wallets: patch.type === 'paypal'
                  ? (source.wallets.length > 0 ? source.wallets : createPaymentSource('paypal').wallets)
                  : patch.type === 'bank_account'
                    ? []
                    : source.wallets,
              }
            : source
        );
        const bankSources = updated.filter((source) => source.type === 'bank_account');
        const hasPortalSelected = bankSources.some((source) => source.member_portal_enabled);
        return updated.map((source) => (
          source.type === 'bank_account' && !hasPortalSelected && source.id === bankSources[0]?.id
            ? { ...source, member_portal_enabled: true }
            : source
        ));
      })(),
    }));
  };

  const selectMemberPortalBankSource = (sourceId: string) => {
    setPaymentSettings((prev) => ({
      ...prev,
      payment_sources: prev.payment_sources.map((source) => (
        source.type === 'bank_account'
          ? { ...source, member_portal_enabled: source.id === sourceId }
          : source
      )),
    }));
  };

  const addPayPalWallet = (sourceId: string) => {
    setPaymentSettings((prev) => ({
      ...prev,
      payment_sources: prev.payment_sources.map((source) => (
        source.id === sourceId
          ? {
              ...source,
              wallets: [
                ...source.wallets,
                normaliseWallet({
                  id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  currency: 'USD',
                  label: 'Additional Wallet',
                }),
              ],
            }
          : source
      )),
    }));
  };

  const updatePayPalWallet = (sourceId: string, walletId: string, patch: Partial<PayPalWallet>) => {
    setPaymentSettings((prev) => ({
      ...prev,
      payment_sources: prev.payment_sources.map((source) => (
        source.id === sourceId
          ? {
              ...source,
              wallets: source.wallets.map((wallet) => (
                wallet.id === walletId ? normaliseWallet({ ...wallet, ...patch }) : wallet
              )),
            }
          : source
      )),
    }));
  };

  const removePayPalWallet = (sourceId: string, walletId: string) => {
    setPaymentSettings((prev) => ({
      ...prev,
      payment_sources: prev.payment_sources.map((source) => {
        if (source.id !== sourceId) return source;
        const remainingWallets = source.wallets.filter((wallet) => wallet.id !== walletId);
        return {
          ...source,
          wallets: remainingWallets.length > 0 ? remainingWallets : [normaliseWallet({ currency: 'AUD', label: 'AUD Wallet' })],
        };
      }),
    }));
  };

  const openMilestoneEditor = (milestone?: PaymentMilestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneForm({
        milestone_date: milestone.milestone_date,
        accumulated_amount: String(milestone.accumulated_amount),
        description: milestone.description || '',
      });
    } else {
      resetMilestoneForm();
    }
    setShowMilestoneForm(true);
  };

  const handleSaveMilestone = async () => {
    if (!milestoneForm.milestone_date || !milestoneForm.accumulated_amount) {
      return showToast('error', 'Date and accumulated amount are required');
    }

    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const isEditing = !!editingMilestone;
      const res = await fetch(`/api/trips/${tripId}/payment-schedule`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: h,
        body: JSON.stringify({
          ...(isEditing ? { id: editingMilestone!.id } : {}),
          milestone_date: milestoneForm.milestone_date,
          accumulated_amount: Number(milestoneForm.accumulated_amount),
          description: milestoneForm.description || null,
        }),
      });

      if (!res.ok) throw new Error();
      showToast('success', isEditing ? 'Milestone updated' : 'Milestone added');
      setShowMilestoneForm(false);
      resetMilestoneForm();
      fetchData();
    } catch {
      showToast('error', editingMilestone ? 'Failed to update milestone' : 'Failed to add milestone');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Delete this milestone?')) return;
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/trips/${tripId}/payment-schedule?milestone_id=${encodeURIComponent(milestoneId)}`, {
        method: 'DELETE',
        headers: h,
      });
      if (!res.ok) throw new Error();
      showToast('success', 'Milestone deleted');
      if (editingMilestone?.id === milestoneId) {
        resetMilestoneForm();
        setShowMilestoneForm(false);
      }
      fetchData();
    } catch {
      showToast('error', 'Failed to delete milestone');
    }
  };

  const openLedgerEditor = (row: LedgerRow) => {
    const parsed = parseTransactionNote(row.notes || null);
    const existingIncome = row.type === 'income' ? incomeEntries.find((entry) => entry.id === row.id) : null;
    const isTransferRow = isLinkedTransferNote(parsed)
      || row.description.toLowerCase().startsWith('transfer ')
      || existingIncome?.category === 'transfer';
    if (isTransferRow) {
      showToast('error', 'Transfer entries cannot be edited individually. Delete and recreate the transfer.');
      return;
    }
    const payment = memberPayments.find((item) => item.id === row.id);
    const isMemberPayment = row.type === 'income' && row.sub_type === 'member_payment';
    const defaultAccountId = isMemberPayment ? (memberPortalAccountId || '') : getDefaultInternalAccountId();
    setEditingLedgerRow(row);
    setLedgerEditForm({
      description: row.description,
      date: row.date,
      amount_aud: String(row.type === 'expense' ? Math.abs(row.amount_aud) : row.amount_aud),
      account_source_id: parsed.account_source_id || defaultAccountId,
      payment_method: payment?.payment_method || 'bank_transfer',
      notes: parsed.text,
    });
    setShowLedgerEditForm(true);
    setLedgerActionMode('none');
  };

  const resetLedgerEditor = () => {
    setEditingLedgerRow(null);
    setShowLedgerEditForm(false);
    setLedgerEditForm({
      description: '',
      date: new Date().toISOString().split('T')[0],
      amount_aud: '',
      account_source_id: '',
      payment_method: 'bank_transfer',
      notes: '',
    });
  };

  const handleSaveLedgerEdit = async () => {
    if (!editingLedgerRow) return;
    if (!ledgerEditForm.description.trim() || !ledgerEditForm.date || !ledgerEditForm.amount_aud.trim()) {
      return showToast('error', 'Description, date and amount are required');
    }
    const parsedAmount = Number(ledgerEditForm.amount_aud);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return showToast('error', 'Amount must be greater than zero');

    const isMemberPayment = editingLedgerRow.type === 'income' && editingLedgerRow.sub_type === 'member_payment';

    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      if (isMemberPayment) {
        const res = await fetch(`/api/payments/member-payment/${editingLedgerRow.id}`, {
          method: 'PUT',
          headers: h,
          body: JSON.stringify({
            payment_date: ledgerEditForm.date,
            amount: parsedAmount,
            payment_method: ledgerEditForm.payment_method || 'bank_transfer',
            notes: encodeTransactionNote(ledgerEditForm.notes, ledgerEditForm.account_source_id || null),
          }),
        });
        if (!res.ok) throw new Error();
      } else if (editingLedgerRow.type === 'income') {
        const existingIncome = incomeEntries.find((entry) => entry.id === editingLedgerRow.id);
        const res = await fetch(`/api/trips/${tripId}/budget/income?entryId=${editingLedgerRow.id}`, {
          method: 'PUT',
          headers: h,
          body: JSON.stringify({
            description: ledgerEditForm.description.trim(),
            amount_aud: parsedAmount,
            income_date: ledgerEditForm.date,
            category: existingIncome?.category || 'other',
            notes: encodeTransactionNote(ledgerEditForm.notes, ledgerEditForm.account_source_id || null),
          }),
        });
        if (!res.ok) throw new Error();
      } else {
        const existingExpense = expenses.find((entry) => entry.id === editingLedgerRow.id);
        const amountAud = Math.abs(parsedAmount);
        const payload: Record<string, unknown> = {
          description: ledgerEditForm.description.trim(),
          expense_date: ledgerEditForm.date,
          amount_aud: amountAud,
          amount_aud_overridden: true,
          notes: encodeTransactionNote(ledgerEditForm.notes, ledgerEditForm.account_source_id || null),
        };
        if (existingExpense?.currency === 'AUD') {
          payload.amount = amountAud;
        }
        const res = await fetch(`/api/trips/${tripId}/budget/expenses/${editingLedgerRow.id}`, {
          method: 'PUT',
          headers: h,
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
      }

      showToast('success', 'Transaction updated');
      resetLedgerEditor();
      fetchData();
    } catch {
      showToast('error', 'Failed to update transaction');
    } finally {
      setSaving(false);
    }
  };

  const deleteLedgerRowById = async (row: LedgerRow, h: Record<string, string>): Promise<boolean> => {
    if (row.sub_type === 'member_payment') {
      const res = await fetch(`/api/payments/member-payment/${row.id}?trip_id=${encodeURIComponent(tripId)}`, { method: 'DELETE', headers: h });
      return res.ok;
    } else if (row.type === 'income') {
      const res = await fetch(`/api/trips/${tripId}/budget/income?entryId=${encodeURIComponent(row.id)}`, { method: 'DELETE', headers: h });
      return res.ok;
    } else {
      const res = await fetch(`/api/trips/${tripId}/budget/expenses/${encodeURIComponent(row.id)}`, { method: 'DELETE', headers: h });
      return res.ok;
    }
  };

  const handleDeleteLedgerRow = async (row: LedgerRow) => {
    if (!confirm(`Delete "${row.description}"? This cannot be undone.`)) return;
    try {
      const h = await getAuthHeader();
      const ok = await deleteLedgerRowById(row, h);
      if (!ok) throw new Error();
      showToast('success', 'Transaction deleted');
      if (editingLedgerRow?.id === row.id) resetLedgerEditor();
      setSelectedLedgerIds((prev) => { const next = new Set(prev); next.delete(row.id); return next; });
      fetchData();
    } catch {
      showToast('error', 'Failed to delete transaction');
    }
  };

  const handleBulkDeleteLedgerRows = async () => {
    const ids = Array.from(selectedLedgerIds);
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} selected transaction${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBulkDeletingLedger(true);
    try {
      const h = await getAuthHeader();
      const rowsToDelete = ledger.filter((r) => ids.includes(r.id));
      const results = await Promise.allSettled(rowsToDelete.map((r) => deleteLedgerRowById(r, h)));
      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;
      if (failed > 0) {
        showToast('error', `${failed} deletion${failed === 1 ? '' : 's'} failed`);
      } else {
        showToast('success', `${ids.length} transaction${ids.length === 1 ? '' : 's'} deleted`);
      }
      setSelectedLedgerIds(new Set());
      if (editingLedgerRow && ids.includes(editingLedgerRow.id)) resetLedgerEditor();
      fetchData();
    } catch {
      showToast('error', 'Bulk delete failed');
    } finally {
      setBulkDeletingLedger(false);
    }
  };

  const toggleLedgerActionMode = (mode: 'transfer' | 'interest' | 'fx') => {
    setLedgerActionMode((prev) => (prev === mode ? 'none' : mode));
    setShowLedgerEditForm(false);
    setEditingLedgerRow(null);
  };

  const handleSaveTransfer = async () => {
    if (!transferForm.transfer_date || !transferForm.from_account_id || !transferForm.to_account_id || !transferForm.amount_aud.trim()) {
      return showToast('error', 'Date, from account, to account and amount are required');
    }
    if (transferForm.from_account_id === transferForm.to_account_id) {
      return showToast('error', 'Transfer accounts must be different');
    }
    const amount = Number(transferForm.amount_aud);
    if (!Number.isFinite(amount) || amount <= 0) return showToast('error', 'Amount must be greater than zero');

    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const fromName = getAccountDisplayName(transferForm.from_account_id);
      const toName = getAccountDisplayName(transferForm.to_account_id);
      const noteSeed = transferForm.notes.trim();
      const transferLinkId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const incomingText = noteSeed ? `Transfer from ${fromName}: ${noteSeed}` : `Transfer from ${fromName}`;
      const outgoingText = noteSeed ? `Transfer to ${toName}: ${noteSeed}` : `Transfer to ${toName}`;
      const incomingRes = await fetch(`/api/trips/${tripId}/budget/income`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          description: `Transfer from ${fromName}`,
          amount_aud: amount,
          income_date: transferForm.transfer_date,
          category: 'transfer',
          notes: encodeTransactionNote(
            incomingText,
            transferForm.to_account_id,
            {
              transfer_link_id: transferLinkId,
              transfer_direction: 'in',
              counterparty_account_id: transferForm.from_account_id,
            }
          ),
        }),
      });
      if (!incomingRes.ok) throw new Error();
      const incomingPayload = await incomingRes.json().catch(() => ({}));
      const incomingId = incomingPayload?.data?.id || incomingPayload?.id || null;

      const outgoingRes = await fetch(`/api/trips/${tripId}/budget/expenses`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          description: `Transfer to ${toName}`,
          amount,
          currency: 'AUD',
          exchange_rate: 1,
          amount_aud: amount,
          expense_date: transferForm.transfer_date,
          paid_by_type: 'group_kitty',
          notes: encodeTransactionNote(
            outgoingText,
            transferForm.from_account_id,
            {
              transfer_link_id: transferLinkId,
              transfer_direction: 'out',
              linked_transaction_id: incomingId,
              counterparty_account_id: transferForm.to_account_id,
            }
          ),
          source: 'manual',
          reconciled: true,
        }),
      });

      if (!outgoingRes.ok) {
        if (incomingId) {
          await fetch(`/api/trips/${tripId}/budget/income?entryId=${incomingId}`, { method: 'DELETE', headers: await getAuthHeader() });
        }
        throw new Error();
      }
      const outgoingPayload = await outgoingRes.json().catch(() => ({}));
      const outgoingId = outgoingPayload?.data?.id || outgoingPayload?.id || null;

      // Backfill incoming note with linked expense id so both sides are explicitly paired.
      if (incomingId && outgoingId) {
        await fetch(`/api/trips/${tripId}/budget/income?entryId=${incomingId}`, {
          method: 'PUT',
          headers: h,
          body: JSON.stringify({
            notes: encodeTransactionNote(
              incomingText,
              transferForm.to_account_id,
              {
                transfer_link_id: transferLinkId,
                transfer_direction: 'in',
                linked_transaction_id: outgoingId,
                counterparty_account_id: transferForm.from_account_id,
              }
            ),
          }),
        });
      }

      showToast('success', 'Transfer recorded');
      setTransferForm({
        transfer_date: new Date().toISOString().split('T')[0],
        from_account_id: '',
        to_account_id: '',
        amount_aud: '',
        notes: '',
      });
      setLedgerActionMode('none');
      fetchData();
    } catch {
      showToast('error', 'Failed to record transfer');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInterest = async () => {
    if (!interestForm.income_date || !interestForm.account_id || !interestForm.amount_aud.trim()) {
      return showToast('error', 'Date, account and amount are required');
    }
    const amount = Number(interestForm.amount_aud);
    if (!Number.isFinite(amount) || amount <= 0) return showToast('error', 'Interest amount must be greater than zero');

    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/income`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          description: interestForm.description.trim() || 'Interest Income',
          amount_aud: amount,
          income_date: interestForm.income_date,
          category: 'interest_income',
          notes: encodeTransactionNote(interestForm.notes, interestForm.account_id),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('success', 'Interest income recorded');
      setInterestForm({
        income_date: new Date().toISOString().split('T')[0],
        account_id: '',
        amount_aud: '',
        description: 'Interest Income',
        notes: '',
      });
      setLedgerActionMode('none');
      fetchData();
    } catch {
      showToast('error', 'Failed to record interest income');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFxAdjustment = async () => {
    if (!fxForm.income_date || !fxForm.account_id || !fxForm.amount_aud.trim()) {
      return showToast('error', 'Date, account and amount are required');
    }
    const amount = Number(fxForm.amount_aud);
    if (!Number.isFinite(amount) || amount === 0) return showToast('error', 'FX adjustment amount cannot be zero');

    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/income`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          description: fxForm.description.trim() || 'Currency Change / FX Fluctuation',
          amount_aud: amount,
          income_date: fxForm.income_date,
          category: 'currency_change',
          notes: encodeTransactionNote(fxForm.notes, fxForm.account_id),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('success', 'Currency change recorded');
      setFxForm({
        income_date: new Date().toISOString().split('T')[0],
        account_id: '',
        amount_aud: '',
        description: 'Currency Change / FX Fluctuation',
        notes: '',
      });
      setLedgerActionMode('none');
      fetchData();
    } catch {
      showToast('error', 'Failed to record currency change');
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
        committed_aud: String(parsed.committed_aud || ''),
        parts: parsed.parts,
      });
    } else {
      setEditingCat(null);
      setCatForm({
        name: '',
        color: '#B5621E',
        notes_text: '',
        committed_aud: '0',
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
        notes: encodeCategoryNotes(catForm.notes_text, parts, parseFloat(catForm.committed_aud) || 0),
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
      const res = await fetch(`/api/trips/${tripId}/budget/categories/${id}`, { method: 'DELETE', headers: h });
      if (!res.ok) throw new Error();
      showToast('success', 'Category deleted'); fetchData();
    } catch { showToast('error', 'Failed to delete'); }
  };

  const handleSeedCategories = async () => {
    if (!confirm('Add default categories?')) return;
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const responses = await Promise.all(
        DEFAULT_CATEGORIES.map((c, i) => fetch(`/api/trips/${tripId}/budget/categories`, {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ name: c.name, planned_aud: 0, color: c.color, sort_order: i }),
        }))
      );
      if (responses.some((res) => !res.ok)) throw new Error();
      showToast('success', 'Default categories added'); fetchData();
    } catch { showToast('error', 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Reconciliation ────────────────────────────────────────────────────────

  const getReconcileChangeKey = (type: ReconcileType, id: string) => `${type}:${id}`;

  const queueReconcileChange = (type: ReconcileType, id: string, reconciled: boolean, currentReconciled: boolean) => {
    const key = getReconcileChangeKey(type, id);
    setPendingReconcileChanges((prev) => {
      const next = { ...prev };
      if (reconciled === currentReconciled) {
        delete next[key];
      } else {
        next[key] = { type, id, reconciled };
      }
      return next;
    });
  };

  const discardQueuedReconcile = (type: ReconcileType, id: string) => {
    const key = getReconcileChangeKey(type, id);
    setPendingReconcileChanges((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getAccountAssignmentKey = (type: 'expense' | 'income', id: string) => `${type}:${id}`;

  const handleAssignAccount = (type: 'expense' | 'income', id: string, accountId: string) => {
    const currentAccountId = type === 'expense'
      ? parseTransactionNote(expenses.find((e) => e.id === id)?.notes ?? null).account_source_id
      : parseTransactionNote(incomeEntries.find((e) => e.id === id)?.notes ?? null).account_source_id;
    const key = getAccountAssignmentKey(type, id);
    setPendingAccountAssignments((prev) => {
      const next = { ...prev };
      if (!accountId || accountId === currentAccountId) {
        delete next[key];
      } else {
        next[key] = { type, id, accountId };
      }
      return next;
    });
  };

  const discardQueuedAccountAssignment = (type: 'expense' | 'income', id: string) => {
    const key = getAccountAssignmentKey(type, id);
    setPendingAccountAssignments((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyQueuedChanges = async () => {
    const reconcileChanges = Object.values(pendingReconcileChanges);
    const accountChanges = Object.values(pendingAccountAssignments);
    const totalChanges = reconcileChanges.length + accountChanges.length;
    if (totalChanges === 0) {
      showToast('error', 'No queued changes to apply');
      return;
    }
    setApplyingReconcile(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      let successCount = 0;
      for (const change of accountChanges) {
        if (change.type === 'expense') {
          const exp = expenses.find((e) => e.id === change.id);
          if (!exp) continue;
          const existing = parseTransactionNote(exp.notes);
          const newNotes = encodeTransactionNote(existing.text || '', change.accountId, {
            transfer_link_id: existing.transfer_link_id || null,
            transfer_direction: existing.transfer_direction || null,
            linked_transaction_id: existing.linked_transaction_id || null,
            counterparty_account_id: existing.counterparty_account_id || null,
          });
          const res = await fetch(`/api/trips/${tripId}/budget/expenses/${change.id}`, {
            method: 'PUT',
            headers: h,
            body: JSON.stringify({ notes: newNotes }),
          });
          if (res.ok) successCount++;
        } else {
          const inc = incomeEntries.find((e) => e.id === change.id);
          if (!inc) continue;
          const existing = parseTransactionNote(inc.notes);
          const newNotes = encodeTransactionNote(existing.text || '', change.accountId, {
            transfer_link_id: existing.transfer_link_id || null,
            transfer_direction: existing.transfer_direction || null,
            linked_transaction_id: existing.linked_transaction_id || null,
            counterparty_account_id: existing.counterparty_account_id || null,
          });
          const res = await fetch(`/api/trips/${tripId}/budget/income?entryId=${change.id}`, {
            method: 'PUT',
            headers: h,
            body: JSON.stringify({ notes: newNotes }),
          });
          if (res.ok) successCount++;
        }
      }

      for (const change of reconcileChanges) {
        const res = await fetch(`/api/trips/${tripId}/budget/reconcile`, {
          method: 'POST',
          headers: h,
          body: JSON.stringify(change),
        });
        if (res.ok) successCount++;
      }

      if (successCount === totalChanges) {
        showToast('success', `${successCount} queued change${successCount === 1 ? '' : 's'} saved`);
      } else if (successCount > 0) {
        showToast('error', `${successCount} of ${totalChanges} queued changes saved`);
      } else {
        showToast('error', 'Failed to save queued changes');
      }

      setPendingReconcileChanges({});
      setPendingAccountAssignments({});
      await fetchData();
    } catch {
      showToast('error', 'Failed to save queued changes');
    } finally {
      setApplyingReconcile(false);
    }
  };

  // ── Settings ──────────────────────────────────────────────────────────────

  // Build a merged settings.notes JSON blob, preserving all stored fields
  const buildNotesBlob = (overrides: Record<string, unknown> = {}): string => {
    let existing: Record<string, unknown> = {};
    if (settings.notes) { try { existing = JSON.parse(settings.notes); } catch { /* ignore */ } }
    return JSON.stringify({
      ...existing,
      account_balances: accountBalances,
      interest_rate_pa: interestRatePa,
      notes_text: settingsNotesText,
      ...overrides,
    });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      // Always merge notes into JSON blob — never overwrite with raw textarea value
      const updatedNotes = buildNotesBlob();
      const updatedSettings = { ...settings, notes: updatedNotes };
      const res = await fetch(`/api/trips/${tripId}/budget/settings`, { method: 'PUT', headers: h, body: JSON.stringify(updatedSettings) });
      if (!res.ok) throw new Error();
      setSettings((prev) => ({ ...prev, notes: updatedNotes }));
      showToast('success', 'Settings saved'); fetchData();
    } catch { showToast('error', 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleDeleteAllData = async () => {
    const confirmed = confirm(
      'DELETE ALL FINANCIAL DATA?\n\nThis will permanently delete ALL expenses and income entries for this trip. Member payment records are kept.\n\nThis cannot be undone. Type "DELETE" in the prompt to confirm.'
    );
    if (!confirmed) return;
    const typed = prompt('Type DELETE to confirm:');
    if (typed !== 'DELETE') { showToast('error', 'Cancelled — nothing was deleted'); return; }
    setDeletingAll(true);
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/trips/${tripId}/budget/all`, { method: 'DELETE', headers: h });
      if (!res.ok) throw new Error();
      const json = await res.json();
      showToast('success', json.data?.message ?? 'All data deleted');
      fetchData();
    } catch { showToast('error', 'Failed to delete data'); }
    finally { setDeletingAll(false); }
  };

  const handleSaveLedgerAdd = async () => {
    const { txType, description, date, amount, currency, exchange_rate, amount_aud, amount_aud_overridden, category_id, account_source_id, paid_by_type, paid_by_member, income_category, notes } = ledgerAddForm;
    if (!description || !date) return showToast('error', 'Description and date are required');
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return showToast('error', 'Amount must be greater than zero');
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      if (txType === 'expense') {
        const rate = currency === 'AUD' ? 1 : (parseFloat(exchange_rate) || settings.exchange_rate_mad_aud);
        const audAmount = amount_aud ? parseFloat(amount_aud) : (currency === 'AUD' ? parsedAmount : parsedAmount * rate);
        const paid_by = paid_by_type === 'member' ? paid_by_member || null : null;
        const body = JSON.stringify({
          description, amount: parsedAmount, currency, exchange_rate: rate,
          amount_aud: audAmount, amount_aud_overridden,
          expense_date: date, category_id: category_id || null,
          paid_by, paid_by_type, source: 'manual',
          notes: encodeTransactionNote(notes, account_source_id || null),
        });
        const res = await fetch(`/api/trips/${tripId}/budget/expenses`, { method: 'POST', headers: h, body });
        if (!res.ok) throw new Error();
      } else {
        const body = JSON.stringify({
          description, amount_aud: parsedAmount, income_date: date,
          category: income_category, source: 'manual', reconciled: false,
          notes: encodeTransactionNote(notes, account_source_id || null),
        });
        const res = await fetch(`/api/trips/${tripId}/budget/income`, { method: 'POST', headers: h, body });
        if (!res.ok) throw new Error();
      }
      showToast('success', txType === 'expense' ? 'Expense recorded' : 'Income recorded');
      setLedgerAddForm(emptyLedgerAddForm());
      setShowLedgerAddForm(false);
      fetchData();
    } catch { showToast('error', 'Failed to save transaction'); }
    finally { setSaving(false); }
  };

  const handleSaveAccountBalances = async () => {
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const updatedNotes = buildNotesBlob({ account_balances: balanceForm });
      const updatedSettings = { ...settings, notes: updatedNotes };
      const res = await fetch(`/api/trips/${tripId}/budget/settings`, { method: 'PUT', headers: h, body: JSON.stringify(updatedSettings) });
      if (!res.ok) throw new Error();
      setAccountBalances({ ...balanceForm });
      setSettings((prev) => ({ ...prev, notes: updatedNotes }));
      setEditingBalances(false);
      showToast('success', 'Account balances saved');
    } catch { showToast('error', 'Failed to save balances'); }
    finally { setSaving(false); }
  };

  const handleSaveInterestRate = async (rate: number) => {
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const updatedNotes = buildNotesBlob({ interest_rate_pa: rate });
      const updatedSettings = { ...settings, notes: updatedNotes };
      const res = await fetch(`/api/trips/${tripId}/budget/settings`, { method: 'PUT', headers: h, body: JSON.stringify(updatedSettings) });
      if (!res.ok) throw new Error();
      setInterestRatePa(rate);
      setSettings((prev) => ({ ...prev, notes: updatedNotes }));
      showToast('success', 'Interest rate saved');
    } catch { showToast('error', 'Failed to save interest rate'); }
  };

  const handleGenerateRecurring = async () => {
    const amount = parseFloat(recurringForm.amount_aud);
    const months = parseInt(recurringForm.months);
    if (!recurringForm.description || isNaN(amount) || amount <= 0 || isNaN(months) || months < 1) {
      return showToast('error', 'Fill in all fields with valid values');
    }
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const startDate = new Date(recurringForm.start_date);
      let created = 0;
      for (let i = 0; i < months; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        const dateStr = d.toISOString().split('T')[0];
        const body = JSON.stringify({
          description: recurringForm.description,
          amount_aud: amount,
          income_date: dateStr,
          category: recurringForm.category,
          account_source_id: recurringForm.account_source_id || null,
          notes: null,
        });
        const res = await fetch(`/api/trips/${tripId}/budget/income`, { method: 'POST', headers: h, body });
        if (res.ok) created++;
      }
      showToast('success', `Generated ${created} recurring entries`);
      setShowRecurringForm(false);
      fetchData();
    } catch { showToast('error', 'Failed to generate recurring entries'); }
    finally { setSaving(false); }
  };

  const parseBankCsv = (csvText: string) => {
    const lines = csvText.trim().split('\n').filter((l) => l.trim());
    const rows = lines.map((line) => {
      // Support Westpac CSV format: Date, Amount, Balance, Transaction Description
      // Also support: Date, Debit Amount, Credit Amount, Balance, Transaction Description
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      let date = '', description = '', debit = 0, credit = 0;
      // Try to detect format
      if (cols.length >= 4) {
        // Westpac format: Date, Amount (negative=debit), Balance, Description...
        const rawDate = cols[0];
        const rawAmount = parseFloat(cols[1]);
        description = cols.slice(3).join(' ').trim() || cols.slice(2).join(' ').trim();
        // Parse date (DD/MM/YYYY or YYYY-MM-DD)
        const dateParts = rawDate.includes('/') ? rawDate.split('/').reverse().join('-') : rawDate;
        try { date = new Date(dateParts).toISOString().split('T')[0]; } catch { date = rawDate; }
        if (!isNaN(rawAmount)) {
          if (rawAmount < 0) debit = Math.abs(rawAmount);
          else credit = rawAmount;
        }
        // Also try 5-column format: Date, Debit, Credit, Balance, Description
        if (cols.length >= 5 && isNaN(parseFloat(cols[1])) === false && cols[2] !== undefined) {
          const rawDebit = parseFloat(cols[1]);
          const rawCredit = parseFloat(cols[2]);
          if (!isNaN(rawDebit) && rawDebit > 0) debit = rawDebit;
          if (!isNaN(rawCredit) && rawCredit > 0) credit = rawCredit;
          description = cols.slice(4).join(' ').trim();
        }
      }
      if (!date || (!debit && !credit)) return null;
      const type: 'income' | 'expense' | 'skip' = credit > 0 ? 'income' : 'expense';
      return { date, description, debit, credit, selected: true, type, category_id: '' };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    setBankCsvRows(rows);
  };

  const handleImportBankRows = async () => {
    const toImport = bankCsvRows.filter((r) => r.selected && r.type !== 'skip');
    if (toImport.length === 0) return showToast('error', 'No rows selected to import');
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      let created = 0;
      // Tag every imported row with the selected account so they appear in the right account column
      const accountNotes = encodeTransactionNote('', bankImportAccount);
      for (const row of toImport) {
        if (row.type === 'income') {
          const body = JSON.stringify({ description: row.description, amount_aud: row.credit, income_date: row.date, category: 'other', notes: accountNotes });
          const res = await fetch(`/api/trips/${tripId}/budget/income`, { method: 'POST', headers: h, body });
          if (res.ok) created++;
        } else {
          const body = JSON.stringify({ description: row.description, amount: row.debit, currency: 'AUD', amount_aud: row.debit, exchange_rate: 1, amount_aud_overridden: false, expense_date: row.date, category_id: row.category_id || null, paid_by: null, paid_by_type: 'group_kitty', paid_by_label: null, notes: accountNotes, source: 'bank_import', reconciled: true });
          const res = await fetch(`/api/trips/${tripId}/budget/expenses`, { method: 'POST', headers: h, body });
          if (res.ok) created++;
        }
      }
      // If a closing balance was entered, update the account balance for that account
      const closingBalance = bankImportClosingBalance ? parseFloat(bankImportClosingBalance) : NaN;
      if (!isNaN(closingBalance)) {
        const today = new Date().toISOString().split('T')[0];
        const newBalances: AccountBalances = { ...accountBalances, [bankImportAccount]: closingBalance, balance_date: today };
        let existingNotes: Record<string, unknown> = {};
        if (settings.notes) { try { existingNotes = JSON.parse(settings.notes); } catch { /* ignore */ } }
        const updatedNotes = JSON.stringify({ ...existingNotes, account_balances: newBalances, interest_rate_pa: interestRatePa, notes_text: settingsNotesText });
        await fetch(`/api/trips/${tripId}/budget/settings`, { method: 'PUT', headers: h, body: JSON.stringify({ ...settings, notes: updatedNotes }) });
        setAccountBalances(newBalances);
        setBalanceForm(newBalances);
        setSettings((prev) => ({ ...prev, notes: updatedNotes }));
      }
      showToast('success', `Imported ${created} bank transaction${created !== 1 ? 's' : ''}${!isNaN(closingBalance) ? ' and updated account balance' : ''}`);
      setShowBankImport(false);
      setBankCsvText('');
      setBankCsvRows([]);
      setBankImportClosingBalance('');
      fetchData();
    } catch { showToast('error', 'Failed to import bank rows'); }
    finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const unreconciledExpenses = expenses.filter((e) => !e.reconciled && e.source === 'manual');
  const unreconciledIncome = incomeEntries.filter((e) => !e.reconciled);
  // Any transaction with no account assigned needs attention regardless of reconciled status
  const unassignedExpenses = expenses.filter((e) => !parseTransactionNote(e.notes).account_source_id);
  const unassignedIncome = incomeEntries.filter((e) => !parseTransactionNote(e.notes).account_source_id);
  const totalUnreconciled = unreconciledExpenses.length + unreconciledIncome.length + unassignedExpenses.length + unassignedIncome.length;
  const pendingReconcileCount = Object.keys(pendingReconcileChanges).length;
  const pendingAccountAssignmentCount = Object.keys(pendingAccountAssignments).length;
  const pendingChangeCount = pendingReconcileCount + pendingAccountAssignmentCount;
  const participantCount = Math.max(1, overview?.member_count || tripMembers.length || 1);
  const targetAmount = paymentSchedule.length > 0 ? paymentSchedule[paymentSchedule.length - 1].accumulated_amount : 0;
  const totalBudgetPerPersonAud = (overview?.total_budget_aud || 0) / participantCount;
  const categoriesBudgetTotal = categories.reduce((sum, cat) => sum + Number(cat.planned_aud || 0), 0);
  const categoriesSpentTotal = categories.reduce((sum, cat) => sum + Number(cat.spent_aud || 0), 0);
  const categoriesRemainingTotal = categories.reduce((sum, cat) => {
    const fallbackRemaining = Number(cat.planned_aud || 0) - Number(cat.spent_aud || 0);
    return sum + Number(cat.remaining_aud ?? fallbackRemaining);
  }, 0);
  // Use stable account IDs so stored notes always resolve correctly regardless of page load
  const memberPortalAccountId = 'westpac_choice';
  const accountOptions: AccountOption[] = BUDGET_ACCOUNTS.map((acct) => ({
    id: acct.id,
    name: acct.name,
    accountType: acct.accountType,
    sourceType: acct.accountType === 'paypal' ? 'paypal' : 'bank_account',
    sourceId: acct.id,
    isMemberPortalSource: acct.id === 'westpac_choice',
  }));
  const accountNameById = new Map(accountOptions.map((option) => [option.id, option.name]));
  const isTransferExpense = (entry: Expense) => {
    const note = parseTransactionNote(entry.notes);
    return Boolean(note.transfer_link_id || entry.description.toLowerCase().startsWith('transfer to'));
  };
  const isTransferIncome = (entry: IncomeEntry) => {
    const note = parseTransactionNote(entry.notes);
    return Boolean(note.transfer_link_id || entry.category === 'transfer');
  };
  const transferExpenseEntries = expenses.filter(isTransferExpense);
  const transferIncomeEntries = incomeEntries.filter(isTransferIncome);
  const transferOutflowTotal = transferExpenseEntries.reduce((sum, entry) => sum + Math.abs(Number(entry.amount_aud || 0)), 0);
  const transferInflowTotal = transferIncomeEntries.reduce((sum, entry) => sum + Math.abs(Number(entry.amount_aud || 0)), 0);
  const transferNetImbalance = transferInflowTotal - transferOutflowTotal;
  const transferLinkIndex = new Map<string, { inCount: number; outCount: number }>();
  transferIncomeEntries.forEach((entry) => {
    const note = parseTransactionNote(entry.notes);
    if (!note.transfer_link_id) return;
    const current = transferLinkIndex.get(note.transfer_link_id) || { inCount: 0, outCount: 0 };
    current.inCount += 1;
    transferLinkIndex.set(note.transfer_link_id, current);
  });
  transferExpenseEntries.forEach((entry) => {
    const note = parseTransactionNote(entry.notes);
    if (!note.transfer_link_id) return;
    const current = transferLinkIndex.get(note.transfer_link_id) || { inCount: 0, outCount: 0 };
    current.outCount += 1;
    transferLinkIndex.set(note.transfer_link_id, current);
  });
  const brokenTransferLinkCount = Array.from(transferLinkIndex.values()).filter((pair) => pair.inCount !== 1 || pair.outCount !== 1).length;
  const unlinkedTransferIncomeCount = transferIncomeEntries.filter((entry) => !parseTransactionNote(entry.notes).transfer_link_id).length;
  const unlinkedTransferExpenseCount = transferExpenseEntries.filter((entry) => !parseTransactionNote(entry.notes).transfer_link_id).length;
  const hasTransferIntegrityIssue =
    Math.abs(transferNetImbalance) > 0.01 ||
    brokenTransferLinkCount > 0 ||
    unlinkedTransferIncomeCount > 0 ||
    unlinkedTransferExpenseCount > 0;

  const accountFlowMap = new Map<string, { option: AccountOption | null; name: string; inflow: number; outflow: number }>();
  accountOptions.forEach((option) => {
    accountFlowMap.set(option.id, {
      option,
      name: option.name,
      inflow: 0,
      outflow: 0,
    });
  });
  const upsertUnassignedFlow = () => {
    if (!accountFlowMap.has('__unassigned__')) {
      accountFlowMap.set('__unassigned__', {
        option: null,
        name: 'Unassigned',
        inflow: 0,
        outflow: 0,
      });
    }
    return accountFlowMap.get('__unassigned__')!;
  };
  const applyFlow = (accountId: string | null | undefined, direction: 'inflow' | 'outflow', amount: number) => {
    const normalizedAmount = Number(amount || 0);
    if (!accountId) {
      upsertUnassignedFlow()[direction] += normalizedAmount;
      return;
    }
    const flow = accountFlowMap.get(accountId);
    if (flow) {
      flow[direction] += normalizedAmount;
      return;
    }
    upsertUnassignedFlow()[direction] += normalizedAmount;
  };
  memberPayments.forEach((payment) => {
    const paymentNote = parseTransactionNote(payment.notes);
    const accountId = paymentNote.account_source_id || memberPortalAccountId;
    applyFlow(accountId, 'inflow', Number(payment.amount || 0));
  });
  incomeEntries.forEach((entry) => {
    const incomeNote = parseTransactionNote(entry.notes);
    const accountId = incomeNote.account_source_id;
    const amount = Number(entry.amount_aud || 0);
    if (amount >= 0) {
      applyFlow(accountId, 'inflow', amount);
    } else {
      applyFlow(accountId, 'outflow', Math.abs(amount));
    }
  });
  expenses.forEach((entry) => {
    const expenseNote = parseTransactionNote(entry.notes);
    const accountId = expenseNote.account_source_id;
    applyFlow(accountId, 'outflow', Math.abs(Number(entry.amount_aud || 0)));
  });
  const accountFlowSummary = Array.from(accountFlowMap.entries())
    .map(([id, flow]) => ({
      id,
      option: flow.option,
      name: flow.name,
      inflow: flow.inflow,
      outflow: flow.outflow,
      net: flow.inflow - flow.outflow,
      typeLabel:
        id === '__unassigned__'
          ? 'Unassigned'
          : flow.option?.accountType === 'paypal_wallet'
            ? 'PayPal Wallet'
            : flow.option?.accountType === 'paypal'
              ? 'PayPal'
              : 'Bank',
      isMemberPortalSource: flow.option?.isMemberPortalSource === true,
      isUnassigned: id === '__unassigned__',
    }))
    .filter((row) => row.inflow !== 0 || row.outflow !== 0 || !row.isUnassigned);
  const getTransactionAccountId = (rawNotes: string | null | undefined, fallbackAccountId?: string | null) => {
    const parsed = parseTransactionNote(rawNotes || null);
    return parsed.account_source_id || fallbackAccountId || null;
  };
  const getAccountDisplayName = (accountId: string | null | undefined) => {
    if (!accountId) return 'Unassigned';
    const stable = BUDGET_ACCOUNTS.find((a) => a.id === accountId);
    if (stable) return stable.name;
    return accountNameById.get(accountId) || 'Unknown';
  };
  const membersPaidCount = memberPaymentSummary.filter((m) => m.total_paid > 0).length;

  const handleMemberSort = (key: 'name' | 'paid' | 'remaining') => {
    if (memberSortKey === key) {
      setMemberSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setMemberSortKey(key);
      setMemberSortDir('asc');
    }
  };

  const sortedMemberPaymentSummary = [...memberPaymentSummary].sort((a, b) => {
    const getRemainingFor = (m: MemberPaymentSummary) => {
      const bd = memberBreakdown.find((bd) => bd.user_id === m.member_id);
      const share = bd?.kitty_share_aud ?? bd?.cost_share_aud ?? 0;
      return Math.max(0, share - m.total_paid);
    };
    let cmp = 0;
    if (memberSortKey === 'name') {
      const nameA = (a.nickname || a.full_name || '').toLowerCase();
      const nameB = (b.nickname || b.full_name || '').toLowerCase();
      cmp = nameA.localeCompare(nameB);
    } else if (memberSortKey === 'paid') {
      cmp = a.total_paid - b.total_paid;
    } else if (memberSortKey === 'remaining') {
      cmp = getRemainingFor(a) - getRemainingFor(b);
    }
    return memberSortDir === 'asc' ? cmp : -cmp;
  });
  const makeSort = <K extends string>(
    setSortKey: (k: K) => void, setSortDir: (d: SortDir) => void,
    currentKey: K, currentDir: SortDir, numericKeys: K[] = [],
  ): (key: string) => void => (key: string) => {
    const k = key as K;
    if (k === currentKey) { setSortDir(currentDir === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(k); setSortDir(numericKeys.includes(k) ? 'desc' : 'asc'); }
  };

  const handleCashflowSort = makeSort(setCashflowSortKey, setCashflowSortDir, cashflowSortKey, cashflowSortDir, ['inflow','outflow','net']);
  const handleMemberContribSort = makeSort(setMemberContribSortKey, setMemberContribSortDir, memberContribSortKey, memberContribSortDir, ['kitty','personal','paid','remaining']);
  const handleTransferSort = makeSort(setTransferSortKey, setTransferSortDir, transferSortKey, transferSortDir, ['amount']);
  const handleLedgerSort = makeSort(setLedgerSortKey, setLedgerSortDir, ledgerSortKey, ledgerSortDir, ['amount','balance']);
  const handleIncomeSort = makeSort(setIncomeSortKey, setIncomeSortDir, incomeSortKey, incomeSortDir, ['amount']);
  const handleExpenseSort = makeSort(setExpenseSortKey, setExpenseSortDir, expenseSortKey, expenseSortDir, ['amount_aud']);
  const handleUnassignedSort = makeSort(setUnassignedSortKey, setUnassignedSortDir, unassignedSortKey, unassignedSortDir, ['amount']);
  const handleCatSort = makeSort(setCatSortKey, setCatSortDir, catSortKey, catSortDir, ['group','personal','spent','remaining']);

  const sortedCashflow = sortBy(accountFlowSummary, (r) => {
    if (cashflowSortKey === 'inflow') return r.inflow;
    if (cashflowSortKey === 'outflow') return r.outflow;
    if (cashflowSortKey === 'net') return r.net;
    return r.name;
  }, cashflowSortDir);

  const sortedMemberContrib = sortBy(memberBreakdown, (m) => {
    if (memberContribSortKey === 'kitty') return m.kitty_share_aud ?? m.cost_share_aud;
    if (memberContribSortKey === 'personal') return m.personal_budget_aud ?? 0;
    if (memberContribSortKey === 'paid') return m.total_paid_aud;
    if (memberContribSortKey === 'remaining') return m.remaining_aud;
    return (m.nickname ?? m.full_name ?? '').toLowerCase();
  }, memberContribSortDir);

  type TransferRow = { key: string; date: string; description: string; absAmount: number; direction: 'in' | 'out'; displayAmount: string; notes?: string | null };
  const allTransferRows: TransferRow[] = [
    ...transferExpenseEntries.map((e) => ({
      key: `exp-${e.id}`, date: e.expense_date, description: e.description,
      absAmount: Math.abs(e.amount_aud), direction: 'out' as const,
      displayAmount: `-${fmt(Math.abs(e.amount_aud))}`, notes: e.notes,
    })),
    ...transferIncomeEntries.map((e) => ({
      key: `inc-${e.id}`, date: e.income_date, description: e.description,
      absAmount: Math.abs(e.amount_aud), direction: 'in' as const,
      displayAmount: `+${fmt(Math.abs(e.amount_aud))}`, notes: e.notes,
    })),
  ];
  const sortedTransfers = sortBy(allTransferRows, (r) => {
    if (transferSortKey === 'description') return r.description;
    if (transferSortKey === 'amount') return r.absAmount;
    return r.date;
  }, transferSortDir);

  const paymentsByMember = memberPayments.reduce<Record<string, MemberPayment[]>>((acc, payment) => {
    const memberId = payment.member_id || '__unknown__';
    if (!acc[memberId]) acc[memberId] = [];
    acc[memberId].push(payment);
    return acc;
  }, {});
  const today = new Date();
  const passedMilestones = paymentSchedule.filter((m) => parseLocalDate(m.milestone_date) <= today);
  const expectedByMilestone = passedMilestones.length > 0 ? passedMilestones[passedMilestones.length - 1].accumulated_amount : 0;
  const nextMilestone = paymentSchedule.find((m) => parseLocalDate(m.milestone_date) > today);
  const collectionGapAud = overview?.collection_gap_aud ?? 0;
  const hasCollectionSurplus = collectionGapAud < 0;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <DollarSign className="w-8 h-8 text-brand-tan animate-pulse" />
    </div>
  );

  const tabs = [
    { key: 'pl' as Tab, label: 'Dashboard', icon: LayoutGrid },
    { key: 'accounts' as Tab, label: 'Accounts', icon: Landmark },
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

      {pendingChangeCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-brand-tan/30 bg-brand-dark-grey">
          <p className="text-sm text-brand-cream/80">
            {pendingChangeCount} change{pendingChangeCount === 1 ? '' : 's'} queued
            {pendingAccountAssignmentCount > 0 ? ` · ${pendingAccountAssignmentCount} account assignment${pendingAccountAssignmentCount === 1 ? '' : 's'}` : ''}
            {pendingReconcileCount > 0 ? ` · ${pendingReconcileCount} reconciliation change${pendingReconcileCount === 1 ? '' : 's'}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPendingReconcileChanges({});
                setPendingAccountAssignments({});
              }}
              disabled={applyingReconcile}
              className="px-3 py-1.5 text-xs border border-brand-tan/30 rounded text-brand-cream/80 hover:bg-brand-tan/10 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={applyQueuedChanges}
              disabled={applyingReconcile}
              className="px-3 py-1.5 text-xs bg-brand-tan text-brand-black font-semibold rounded hover:bg-brand-tan/90 disabled:opacity-50"
            >
              {applyingReconcile ? 'Applying…' : 'Apply Changes'}
            </button>
          </div>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Collected From Members</p>
            <p className="mt-1 text-xl font-semibold text-brand-cream">{fmt(overview.total_collected_from_members_aud)}</p>
          </div>
          <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Total Income</p>
            <p className="mt-1 text-xl font-semibold text-green-400">{fmt(overview.total_income_aud)}</p>
          </div>
          <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Total Spent</p>
            <p className="mt-1 text-xl font-semibold text-red-400">{fmt(overview.total_spent_aud)}</p>
          </div>
          <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Outstanding Reconciliation</p>
            <p className={`mt-1 text-xl font-semibold ${totalUnreconciled > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {totalUnreconciled}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DASHBOARD TAB
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

          {/* Cash Position Strip */}
          {(() => {
            const wcNet  = accountFlowSummary.find((r) => r.id === 'westpac_choice')?.net ?? 0;
            const wlNet  = accountFlowSummary.find((r) => r.id === 'westpac_life')?.net ?? 0;
            const ppNet  = accountFlowSummary.find((r) => r.id === 'paypal')?.net ?? 0;
            const totalNet = wcNet + wlNet + ppNet;
            const wcVar  = accountBalances.westpac_choice - wcNet;
            const wlVar  = accountBalances.westpac_life - wlNet;
            return (
              <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-brand-tan" />
                    <h3 className="font-semibold text-brand-cream">Cash Position</h3>
                    <span className="text-xs text-brand-cream/30 ml-1">from recorded transactions</span>
                  </div>
                  <button onClick={() => { setTab('accounts'); setEditingBalances(true); }} className="text-xs text-brand-tan hover:underline flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Set reconciliation balances
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-brand-tan/20 bg-brand-black/30 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-brand-cream/40" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Westpac Choice</p></div>
                    <p className="text-lg font-semibold text-brand-cream">{fmt(wcNet)}</p>
                    {accountBalances.westpac_choice > 0 && <p className={`text-[10px] mt-0.5 ${Math.abs(wcVar) < 1 ? 'text-green-400/60' : Math.abs(wcVar) < 100 ? 'text-amber-400/60' : 'text-red-400/60'}`}>Bank: {fmt(accountBalances.westpac_choice)} ({wcVar >= 0 ? '+' : ''}{fmt(wcVar)})</p>}
                  </div>
                  <div className="rounded-lg border border-brand-tan/20 bg-brand-black/30 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-brand-cream/40" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Westpac Life</p></div>
                    <p className="text-lg font-semibold text-brand-cream">{fmt(wlNet)}</p>
                    {accountBalances.westpac_life > 0 && <p className={`text-[10px] mt-0.5 ${Math.abs(wlVar) < 1 ? 'text-green-400/60' : Math.abs(wlVar) < 100 ? 'text-amber-400/60' : 'text-red-400/60'}`}>Bank: {fmt(accountBalances.westpac_life)} ({wlVar >= 0 ? '+' : ''}{fmt(wlVar)})</p>}
                  </div>
                  <div className="rounded-lg border border-amber-600/20 bg-amber-900/10 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-amber-400/60" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">PayPal</p></div>
                    <p className="text-lg font-semibold text-amber-300">{fmt(ppNet)}</p>
                    {accountBalances.paypal > 0 && <p className="text-[10px] text-brand-cream/30 mt-0.5">Manual: {fmt(accountBalances.paypal)}</p>}
                  </div>
                  <div className="rounded-lg border border-green-600/30 bg-green-900/15 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1"><DollarSign className="w-3.5 h-3.5 text-green-400/60" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Total Funds</p></div>
                    <p className="text-lg font-semibold text-green-400">{fmt(totalNet)}</p>
                  </div>
                </div>
              </div>
            );
          })()}

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
                  <span>Budget target (group)</span>
                  <span>{fmt(overview.total_budget_aud)}</span>
                </div>
                <div className="flex justify-between text-brand-cream/50">
                  <span>Budget target (per person)</span>
                  <span>{fmt(totalBudgetPerPersonAud)}</span>
                </div>
                <div className={`flex justify-between ${hasCollectionSurplus ? 'text-green-400/90' : 'text-amber-400/80'}`}>
                  <span>{hasCollectionSurplus ? 'Collection surplus' : 'Collection gap'}</span>
                  <span>{fmt(Math.abs(collectionGapAud))}</span>
                </div>
              </div>
              {/* Collection bar */}
              <div className="mt-4">
                <div className="w-full h-2 bg-brand-black rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, overview.total_budget_aud > 0 ? (overview.total_collected_from_members_aud / overview.total_budget_aud) * 100 : 0)}%` }} />
                </div>
                <p className="text-xs text-brand-cream/40 mt-1">
                  {overview.total_budget_aud > 0 ? Math.round((overview.total_collected_from_members_aud / overview.total_budget_aud) * 100) : 0}% member collection progress
                </p>
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
                  <span>Budget allocated (group)</span>
                  <span>{fmt(overview.total_budget_aud)}</span>
                </div>
                <div className="flex justify-between text-brand-cream/50">
                  <span>Budget allocated (per person)</span>
                  <span>{fmt(totalBudgetPerPersonAud)}</span>
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

          {/* Account cashflow */}
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-tan/20">
              <h3 className="font-semibold text-brand-cream">Cashflow by Account</h3>
              <p className="text-xs text-brand-cream/40 mt-0.5">Tracks inflow/outflow by account assignment from payments, income, and expenses.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-brand-black">
                  <tr>
                    <SortTh label="Account" colKey="name" sortKey={cashflowSortKey} sortDir={cashflowSortDir} onSort={handleCashflowSort} />
                    <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Type</th>
                    <SortTh label="Inflow" colKey="inflow" sortKey={cashflowSortKey} sortDir={cashflowSortDir} onSort={handleCashflowSort} />
                    <SortTh label="Outflow" colKey="outflow" sortKey={cashflowSortKey} sortDir={cashflowSortDir} onSort={handleCashflowSort} />
                    <SortTh label="Net" colKey="net" sortKey={cashflowSortKey} sortDir={cashflowSortDir} onSort={handleCashflowSort} />
                    <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Vs Balance</th>
                    <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Member Portal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {sortedCashflow.map((row) => (
                    <tr key={row.id} className="hover:bg-brand-tan/5">
                      <td className="px-4 py-3 font-medium text-brand-cream">{row.name}</td>
                      <td className="px-4 py-3 text-brand-cream/60">{row.typeLabel}</td>
                      <td className="px-4 py-3 text-green-400 font-semibold">+{fmt(row.inflow)}</td>
                      <td className="px-4 py-3 text-red-400 font-semibold">-{fmt(row.outflow)}</td>
                      <td className="px-4 py-3 font-semibold">
                        <span className={row.net >= 0 ? 'text-brand-tan' : 'text-red-400'}>{fmt(row.net)}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {(() => {
                          if (row.isUnassigned) return <span className="text-brand-cream/20 text-xs">—</span>;
                          const acctId = row.id;
                          const balanceValue = acctId === 'westpac_choice' ? accountBalances.westpac_choice
                            : acctId === 'westpac_life' ? accountBalances.westpac_life
                            : acctId === 'paypal' ? accountBalances.paypal
                            : null;
                          if (balanceValue === null) return <span className="text-brand-cream/20 text-xs">—</span>;
                          const variance = balanceValue - row.net;
                          return (
                            <span className={Math.abs(variance) < 1 ? 'text-green-400 text-xs' : Math.abs(variance) < 100 ? 'text-amber-400 text-xs' : 'text-red-400 text-xs'}>
                              {variance >= 0 ? '+' : ''}{fmt(variance)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {row.isMemberPortalSource
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-600/30">Shown to members</span>
                          : <span className="text-brand-cream/30 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-2 text-xs text-brand-cream/30 border-t border-brand-tan/10">Vs Balance compares the entered account balance against ledger net (inflow − outflow). Near zero = records match.</p>
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
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${cat.over_budget ? 'text-red-400' : 'text-brand-cream/80'}`}>{fmt(cat.spent_aud ?? 0)} <span className="text-brand-cream/30 font-normal">/ {fmt(cat.planned_aud)}</span></p>
                            <p className="text-[11px] text-brand-cream/40">Per person budget {fmt(cat.planned_aud / participantCount)}</p>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-brand-black rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.over_budget ? '#ef4444' : cat.color }} />
                        </div>
                        {(() => {
                          const committed = parseCategoryNotes(cat.notes, cat.planned_aud, defaultParticipantCount).committed_aud;
                          return committed > 0 ? (
                            <p className="text-[10px] text-amber-400/60 mt-0.5">+{fmt(committed)} committed</p>
                          ) : null;
                        })()}
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
                <p className="text-xs text-brand-cream/40 mt-0.5">
                  Kitty target: {fmt(overview.kitty_per_member_aud ?? overview.cost_share_per_member_aud)} per member
                  {(overview.personal_budget_per_member_aud ?? 0) > 0 && (
                    <span className="ml-2 text-purple-300/60">· {fmt(overview.personal_budget_per_member_aud ?? 0)} personal per member</span>
                  )}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-brand-black">
                    <tr>
                      <SortTh label="Member" colKey="name" sortKey={memberContribSortKey} sortDir={memberContribSortDir} onSort={handleMemberContribSort} className="px-5" />
                      <SortTh label="Kitty Target" colKey="kitty" sortKey={memberContribSortKey} sortDir={memberContribSortDir} onSort={handleMemberContribSort} className="px-5" />
                      <SortTh label="Personal" colKey="personal" sortKey={memberContribSortKey} sortDir={memberContribSortDir} onSort={handleMemberContribSort} className="px-5" />
                      <SortTh label="Paid" colKey="paid" sortKey={memberContribSortKey} sortDir={memberContribSortDir} onSort={handleMemberContribSort} className="px-5" />
                      <SortTh label="Remaining" colKey="remaining" sortKey={memberContribSortKey} sortDir={memberContribSortDir} onSort={handleMemberContribSort} className="px-5" />
                      <th className="px-5 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-tan/10">
                    {sortedMemberContrib.map((m) => {
                      const kittyTarget = m.kitty_share_aud ?? m.cost_share_aud;
                      const personalBudget = m.personal_budget_aud ?? 0;
                      return (
                        <tr key={m.user_id} className="hover:bg-brand-tan/5">
                          <td className="px-5 py-3 font-medium text-brand-cream">{m.nickname || m.full_name || '—'}</td>
                          <td className="px-5 py-3 text-brand-cream/70">{fmt(kittyTarget)}</td>
                          <td className="px-5 py-3">{personalBudget > 0 ? <span className="text-purple-300">{fmt(personalBudget)}</span> : <span className="text-brand-cream/20">—</span>}</td>
                          <td className="px-5 py-3 text-brand-tan font-semibold">{fmt(m.total_paid_aud)}</td>
                          <td className="px-5 py-3"><span className={m.remaining_aud <= 0 ? 'text-green-400' : 'text-amber-400'}>{fmt(m.remaining_aud)}</span></td>
                          <td className="px-5 py-3">{m.remaining_aud <= 0 ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-900/30 text-green-400 border border-green-600/30">Paid</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-amber-900/30 text-amber-400 border border-amber-600/30">Outstanding</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Monthly Income vs Expenses Chart */}
          {ledger.length > 0 && (() => {
            // Group ledger rows by month (YYYY-MM)
            const monthMap = new Map<string, { income: number; expenses: number }>();
            ledger.forEach((row) => {
              const month = row.date.slice(0, 7); // YYYY-MM
              if (!monthMap.has(month)) monthMap.set(month, { income: 0, expenses: 0 });
              const m = monthMap.get(month)!;
              if (row.type === 'income') m.income += Number(row.amount_aud || 0);
              else m.expenses += Math.abs(Number(row.amount_aud || 0));
            });
            const chartData = Array.from(monthMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, vals]) => ({
                month: new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
                Income: Math.round(vals.income),
                Expenses: Math.round(vals.expenses),
              }));
            if (chartData.length === 0) return null;
            return (
              <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-5">
                <h3 className="font-semibold text-brand-cream mb-4">Monthly Income vs Expenses</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                    <XAxis dataKey="month" tick={{ fill: '#C9B98A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: '#C9B98A60', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val) => [`$${Number(val).toLocaleString('en-AU', { minimumFractionDigits: 0 })}`]}
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #C9B98A30', borderRadius: 8, color: '#C9B98A' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#C9B98A80' }} />
                    <Bar dataKey="Income" fill="#4ade80" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCOUNTS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-cream">Account Balances</h2>
              <p className="text-sm text-brand-cream/50 mt-0.5">Track actual cash held across Westpac and PayPal accounts. PayPal balance is entered manually.</p>
            </div>
            {!editingBalances && (
              <button onClick={() => { setEditingBalances(true); setBalanceForm({ ...accountBalances }); }} className="flex items-center gap-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black px-4 py-2 rounded-lg text-sm font-semibold">
                <Edit2 className="w-4 h-4" /> Update Balances
              </button>
            )}
          </div>

          {/* Balance edit form */}
          {editingBalances && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-brand-cream">Update Account Balances</h3>
                <button onClick={() => setEditingBalances(false)} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-brand-cream/50">Enter the current balances from your bank statements and PayPal account. These are display-only — they don't affect income/expense calculations.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Westpac Choice Basic (524337)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={balanceForm.westpac_choice || ''} onChange={(e) => setBalanceForm((p) => ({ ...p, westpac_choice: parseFloat(e.target.value) || 0 }))} className="w-full pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Westpac Life (253840)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={balanceForm.westpac_life || ''} onChange={(e) => setBalanceForm((p) => ({ ...p, westpac_life: parseFloat(e.target.value) || 0 }))} className="w-full pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-amber-400" /> PayPal Balance (AUD equivalent)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={balanceForm.paypal || ''} onChange={(e) => setBalanceForm((p) => ({ ...p, paypal: parseFloat(e.target.value) || 0 }))} className="w-full pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="0.00" />
                  </div>
                  <p className="text-xs text-brand-cream/30 mt-1">Log in to PayPal to get current AUD equivalent balance</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Balance Date</label>
                  <input type="date" value={balanceForm.balance_date} onChange={(e) => setBalanceForm((p) => ({ ...p, balance_date: e.target.value }))} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditingBalances(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSaveAccountBalances} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save Balances'}</button>
              </div>
            </div>
          )}

          {/* Balance cards */}
          {!editingBalances && (() => {
            const wcNet = accountFlowSummary.find((r) => r.id === 'westpac_choice')?.net ?? 0;
            const wlNet = accountFlowSummary.find((r) => r.id === 'westpac_life')?.net ?? 0;
            const ppNet = accountFlowSummary.find((r) => r.id === 'paypal')?.net ?? 0;
            const cards = [
              { label: 'Westpac Choice 524337', ledger: wcNet, snapshot: accountBalances.westpac_choice, icon: Building2, color: 'border-brand-tan/20', textColor: 'text-brand-cream' },
              { label: 'Westpac Life 253840',   ledger: wlNet, snapshot: accountBalances.westpac_life,   icon: Building2, color: 'border-brand-tan/20', textColor: 'text-brand-cream' },
              { label: 'PayPal',                ledger: ppNet, snapshot: accountBalances.paypal,          icon: Wallet,    color: 'border-amber-600/20', textColor: 'text-amber-300'  },
              { label: 'Total Funds',           ledger: wcNet + wlNet + ppNet, snapshot: null,           icon: DollarSign, color: 'border-green-600/30', textColor: 'text-green-400' },
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {cards.map(({ label, ledger, snapshot, icon: Icon, color, textColor }) => {
                  const variance = snapshot !== null && snapshot > 0 ? snapshot - ledger : null;
                  return (
                    <div key={label} className={`rounded-xl border ${color} bg-brand-dark-grey px-5 py-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-brand-cream/40" />
                        <p className="text-xs uppercase tracking-wide text-brand-cream/45">{label}</p>
                      </div>
                      <p className={`text-2xl font-bold ${textColor}`}>{fmt(ledger)}</p>
                      {variance !== null && (
                        <p className={`text-[10px] mt-1 ${Math.abs(variance) < 1 ? 'text-green-400/60' : Math.abs(variance) < 100 ? 'text-amber-400/60' : 'text-red-400/60'}`}>
                          Bank: {fmt(snapshot!)} · {variance >= 0 ? '+' : ''}{fmt(variance)} vs ledger
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Transfers section */}
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-tan/20">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-brand-cream/60" />
                <h3 className="font-semibold text-brand-cream">Inter-Account Transfers</h3>
              </div>
              <p className="text-xs text-brand-cream/40 mt-0.5">Transfers between accounts — recorded as expense (outflow) and income (inflow) to keep the ledger balanced.</p>
              {hasTransferIntegrityIssue && (
                <p className="text-xs text-amber-400 mt-2">
                  Transfer integrity warning: inflow {fmt(transferInflowTotal)} vs outflow {fmt(transferOutflowTotal)} (net {fmtSigned(transferNetImbalance)}).
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-brand-black">
                  <tr>
                    <SortTh label="Date" colKey="date" sortKey={transferSortKey} sortDir={transferSortDir} onSort={handleTransferSort} />
                    <SortTh label="Description" colKey="description" sortKey={transferSortKey} sortDir={transferSortDir} onSort={handleTransferSort} />
                    <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Direction</th>
                    <SortTh label="Amount" colKey="amount" sortKey={transferSortKey} sortDir={transferSortDir} onSort={handleTransferSort} />
                    <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {sortedTransfers.map((r) => (
                    <tr key={r.key} className="hover:bg-brand-tan/5">
                      <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-brand-cream">{r.description}</td>
                      <td className="px-4 py-3">
                        {r.direction === 'out'
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-600/20">Outflow</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/20 text-green-400 border border-green-600/20">Inflow</span>}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${r.direction === 'out' ? 'text-red-400' : 'text-green-400'}`}>{r.displayAmount}</td>
                      <td className="px-4 py-3 text-brand-cream/40 text-xs">{r.notes ? String(r.notes).substring(0, 60) : '—'}</td>
                    </tr>
                  ))}
                  {sortedTransfers.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-brand-cream/30 text-sm">No transfers recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interest income projection */}
          {interestRatePa > 0 && (
            <div className="bg-brand-dark-grey border border-amber-600/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-brand-cream">Interest Income Projection</h3>
                <span className="text-xs text-amber-400/60">at {interestRatePa}% p.a. on Westpac Life</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Monthly', months: 1 },
                  { label: '3 Months', months: 3 },
                  { label: '6 Months', months: 6 },
                  { label: '12 Months', months: 12 },
                ].map(({ label, months }) => (
                  <div key={label} className="rounded-lg bg-amber-900/10 border border-amber-600/20 px-4 py-3 text-center">
                    <p className="text-xs text-brand-cream/40 mb-1">{label}</p>
                    <p className="font-bold text-amber-300">{fmt(accountBalances.westpac_life * (interestRatePa / 100) / 12 * months)}</p>
                  </div>
                ))}
              </div>
              {(() => {
                const totalInterestEarned = incomeEntries.filter((e) => e.category === 'interest').reduce((s, e) => s + e.amount_aud, 0);
                const tripStart = new Date('2025-07-01');
                const todayDate = new Date();
                const monthsElapsed = Math.max(0, (todayDate.getFullYear() - tripStart.getFullYear()) * 12 + todayDate.getMonth() - tripStart.getMonth());
                const projected = accountBalances.westpac_life * (interestRatePa / 100) / 12 * monthsElapsed;
                const variance = totalInterestEarned - projected;
                return totalInterestEarned > 0 ? (
                  <div className="mt-3 pt-3 border-t border-amber-600/20 flex items-center gap-4 text-xs text-brand-cream/50">
                    <span>Earned to date: <span className="text-amber-300 font-medium">{fmt(totalInterestEarned)}</span></span>
                    <span>Expected ({monthsElapsed}mo): <span className="text-amber-300/70 font-medium">{fmt(projected)}</span></span>
                    <span className={`font-medium ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{variance >= 0 ? '+' : ''}{fmt(variance)} vs expected</span>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* Interest income section */}
          {incomeEntries.filter((e) => e.category === 'interest').length > 0 && (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-tan/20 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-brand-cream">Interest Income</h3>
                  <p className="text-xs text-brand-cream/40 mt-0.5">Westpac Life savings interest</p>
                </div>
                <span className="font-semibold text-amber-300">{fmt(incomeEntries.filter((e) => e.category === 'interest').reduce((s, e) => s + e.amount_aud, 0))}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-brand-black"><tr>{['Date', 'Description', 'Amount'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-brand-tan/10">
                    {incomeEntries.filter((e) => e.category === 'interest').sort((a, b) => a.income_date.localeCompare(b.income_date)).map((e) => (
                      <tr key={e.id} className="hover:bg-brand-tan/5">
                        <td className="px-4 py-3 text-brand-cream/60">{fmtDate(e.income_date)}</td>
                        <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                        <td className="px-4 py-3 font-semibold text-amber-300">{fmt(e.amount_aud)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          LEDGER TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-brand-cream/50">
              <Info className="w-4 h-4" />
              Master ledger — all income &amp; expenses with running balance
            </div>
            <button
              onClick={() => { setShowLedgerAddForm((v) => !v); setLedgerAddForm(emptyLedgerAddForm()); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black text-sm font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" /> Add Transaction
            </button>
          </div>

          {/* ── Master add-transaction form ─────────────────────────────────── */}
          {showLedgerAddForm && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-brand-cream">New Transaction</h3>
                <button onClick={() => setShowLedgerAddForm(false)} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
              </div>

              {/* Type toggle */}
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setLedgerAddForm((prev) => ({ ...prev, txType: t, currency: t === 'income' ? 'AUD' : prev.currency }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${ledgerAddForm.txType === t ? (t === 'expense' ? 'bg-red-700/40 border-red-500/60 text-red-200' : 'bg-green-800/40 border-green-500/60 text-green-200') : 'border-brand-tan/20 text-brand-cream/50 hover:bg-brand-tan/5'}`}
                  >
                    {t === 'expense' ? '↑ Expense' : '↓ Income'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Description *</label>
                  <input
                    value={ledgerAddForm.description}
                    onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder={ledgerAddForm.txType === 'expense' ? 'e.g. Riad accommodation deposit' : 'e.g. Andreas — payment'}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Date *</label>
                  <input
                    type="date"
                    value={ledgerAddForm.date}
                    onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>

                {/* Amount + Currency */}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount *</label>
                  <div className="flex gap-2">
                    <input
                      type="number" min="0" step="0.01"
                      value={ledgerAddForm.amount}
                      onChange={(e) => {
                        const a = parseFloat(e.target.value) || 0;
                        const r = parseFloat(ledgerAddForm.exchange_rate) || settings.exchange_rate_mad_aud;
                        setLedgerAddForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                          amount_aud: prev.amount_aud_overridden ? prev.amount_aud : (prev.currency === 'AUD' ? e.target.value : String((a * r).toFixed(2))),
                        }));
                      }}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    />
                    {ledgerAddForm.txType === 'expense' && (
                      <select
                        value={ledgerAddForm.currency}
                        onChange={(e) => {
                          const c = e.target.value;
                          const a = parseFloat(ledgerAddForm.amount) || 0;
                          const r = parseFloat(ledgerAddForm.exchange_rate) || settings.exchange_rate_mad_aud;
                          setLedgerAddForm((prev) => ({
                            ...prev,
                            currency: c,
                            amount_aud_overridden: c === 'AUD' ? false : prev.amount_aud_overridden,
                            amount_aud: c === 'AUD' ? ledgerAddForm.amount : String((a * r).toFixed(2)),
                          }));
                        }}
                        className="w-24 px-2 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                      >
                        {(settings.enabled_currencies?.length ? settings.enabled_currencies : CURRENCIES).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* AUD override for non-AUD expenses */}
                {ledgerAddForm.txType === 'expense' && ledgerAddForm.currency !== 'AUD' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-brand-cream/60 mb-1">Exchange Rate ({ledgerAddForm.currency} → AUD)</label>
                      <input
                        type="number" min="0" step="0.000001"
                        value={ledgerAddForm.exchange_rate}
                        onChange={(e) => {
                          const r = parseFloat(e.target.value) || 0;
                          const a = parseFloat(ledgerAddForm.amount) || 0;
                          setLedgerAddForm((prev) => ({
                            ...prev,
                            exchange_rate: e.target.value,
                            amount_aud: prev.amount_aud_overridden ? prev.amount_aud : String((a * r).toFixed(2)),
                          }));
                        }}
                        placeholder={String(settings.exchange_rate_mad_aud)}
                        className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-brand-cream/60 mb-1">
                        AUD Amount <span className="text-brand-cream/30">(click to override)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={ledgerAddForm.amount_aud}
                          onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, amount_aud: e.target.value, amount_aud_overridden: true }))}
                          className={`w-full pl-7 pr-3 py-2 bg-brand-black border rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan ${ledgerAddForm.amount_aud_overridden ? 'border-amber-500/50' : 'border-brand-tan/30'}`}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Category</label>
                  {ledgerAddForm.txType === 'expense' ? (
                    <select
                      value={ledgerAddForm.category_id}
                      onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, category_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="">— Uncategorised —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <select
                      value={ledgerAddForm.income_category}
                      onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, income_category: e.target.value }))}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="other">Other</option>
                      <option value="interest">Interest</option>
                      <option value="sponsorship">Sponsorship</option>
                      <option value="refund">Refund</option>
                      <option value="fx">FX / Currency</option>
                    </select>
                  )}
                </div>

                {/* Account */}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Account</label>
                  <select
                    value={ledgerAddForm.account_source_id}
                    onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, account_source_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="">— Unassigned —</option>
                    {accountOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>

                {/* Paid by (expenses only) */}
                {ledgerAddForm.txType === 'expense' && (
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Paid By</label>
                    <select
                      value={ledgerAddForm.paid_by_type}
                      onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, paid_by_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="group_kitty">Group Kitty</option>
                      <option value="member">Member</option>
                      <option value="external">External</option>
                    </select>
                  </div>
                )}
                {ledgerAddForm.txType === 'expense' && ledgerAddForm.paid_by_type === 'member' && (
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Member</label>
                    <select
                      value={ledgerAddForm.paid_by_member}
                      onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, paid_by_member: e.target.value }))}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="">— Select member —</option>
                      {tripMembers.map((m) => <option key={m.id} value={m.id}>{m.nickname || m.full_name}</option>)}
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={ledgerAddForm.notes}
                    onChange={(e) => setLedgerAddForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes…"
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowLedgerAddForm(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button
                  onClick={handleSaveLedgerAdd}
                  disabled={saving}
                  className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${ledgerAddForm.txType === 'expense' ? 'bg-red-700/50 hover:bg-red-700/70 border border-red-500/50 text-red-100' : 'bg-green-800/50 hover:bg-green-800/70 border border-green-500/50 text-green-100'}`}
                >
                  {saving ? 'Saving…' : ledgerAddForm.txType === 'expense' ? 'Record Expense' : 'Record Income'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Row 1: quick actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => toggleLedgerActionMode('transfer')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ledgerActionMode === 'transfer' ? 'bg-brand-tan text-brand-black border-brand-tan' : 'border-brand-tan/40 text-brand-cream hover:bg-brand-tan/10'}`}>Transfer</button>
                <button onClick={() => toggleLedgerActionMode('interest')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ledgerActionMode === 'interest' ? 'bg-brand-tan text-brand-black border-brand-tan' : 'border-brand-tan/40 text-brand-cream hover:bg-brand-tan/10'}`}>Interest</button>
                <button onClick={() => toggleLedgerActionMode('fx')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ledgerActionMode === 'fx' ? 'bg-brand-tan text-brand-black border-brand-tan' : 'border-brand-tan/40 text-brand-cream hover:bg-brand-tan/10'}`}>Currency Change</button>
              </div>
              <button
                onClick={() => {
                  const filtered = ledger.filter((row) => {
                    if (ledgerDateFrom && row.date < ledgerDateFrom) return false;
                    if (ledgerDateTo && row.date > ledgerDateTo) return false;
                    if (ledgerAccountFilter) {
                      const acctId = getTransactionAccountId(row.notes, row.sub_type === 'member_payment' ? memberPortalAccountId : null);
                      if (acctId !== ledgerAccountFilter) return false;
                    }
                    return true;
                  });
                  downloadCsv('whiskey-riders-ledger.csv', [
                    ['Date','Description','Type','Sub-type','Account','Amount AUD','Running Balance','Reconciled'],
                    ...filtered.map((r) => [
                      r.date, r.description, r.type, r.sub_type,
                      getAccountDisplayName(getTransactionAccountId(r.notes, r.sub_type === 'member_payment' ? memberPortalAccountId : null)),
                      String(r.amount_aud), String(r.running_balance), r.reconciled ? 'Yes' : 'No',
                    ]),
                  ]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-tan/30 rounded-lg text-xs text-brand-cream/70 hover:text-brand-cream hover:border-brand-tan/60"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            {/* Row 2: filters */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-brand-black/30 rounded-lg border border-brand-tan/10">
              <span className="text-xs text-brand-cream/40 font-medium">Filter:</span>
              <input type="date" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)} className="px-2 py-1 bg-brand-black border border-brand-tan/20 rounded text-xs text-brand-cream focus:outline-none focus:ring-1 focus:ring-brand-tan" />
              <span className="text-xs text-brand-cream/30">to</span>
              <input type="date" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)} className="px-2 py-1 bg-brand-black border border-brand-tan/20 rounded text-xs text-brand-cream focus:outline-none focus:ring-1 focus:ring-brand-tan" />
              <select value={ledgerAccountFilter} onChange={(e) => setLedgerAccountFilter(e.target.value)} className="px-2 py-1 bg-brand-black border border-brand-tan/20 rounded text-xs text-brand-cream focus:outline-none focus:ring-1 focus:ring-brand-tan">
                <option value="">All accounts</option>
                {accountOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {(ledgerDateFrom || ledgerDateTo || ledgerAccountFilter) && (
                <button onClick={() => { setLedgerDateFrom(''); setLedgerDateTo(''); setLedgerAccountFilter(''); }} className="text-xs text-brand-tan hover:underline">Clear filters</button>
              )}
            </div>
          </div>

          {showLedgerEditForm && editingLedgerRow && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-brand-cream">Edit Ledger Transaction</h3>
                  <p className="text-xs text-brand-cream/40 mt-0.5">{editingLedgerRow.type === 'income' ? 'Income' : 'Expense'} · {editingLedgerRow.sub_type === 'member_payment' ? 'Member payment' : editingLedgerRow.sub_type}</p>
                </div>
                <button onClick={resetLedgerEditor} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Description</label>
                  <input
                    value={ledgerEditForm.description}
                    onChange={(e) => setLedgerEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Date</label>
                  <input
                    type="date"
                    value={ledgerEditForm.date}
                    onChange={(e) => setLedgerEditForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ledgerEditForm.amount_aud}
                    onChange={(e) => setLedgerEditForm((prev) => ({ ...prev, amount_aud: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                {editingLedgerRow.sub_type === 'member_payment' && (
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Payment Method</label>
                    <select
                      value={ledgerEditForm.payment_method}
                      onChange={(e) => setLedgerEditForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="payid">PayID</option>
                      <option value="cash">Cash</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Account</label>
                  <select
                    value={ledgerEditForm.account_source_id}
                    onChange={(e) => setLedgerEditForm((prev) => ({ ...prev, account_source_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="">— Unassigned —</option>
                    {accountOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={ledgerEditForm.notes}
                    onChange={(e) => setLedgerEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => editingLedgerRow && handleDeleteLedgerRow(editingLedgerRow)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-600/40 text-red-400 hover:bg-red-900/20 rounded-lg text-sm font-semibold disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <div className="flex gap-3">
                  <button onClick={resetLedgerEditor} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                  <button onClick={handleSaveLedgerEdit} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          )}

          {ledgerActionMode === 'transfer' && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-5 space-y-4">
              <h3 className="font-semibold text-brand-cream">Transfer Between Accounts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Date</label>
                  <input
                    type="date"
                    value={transferForm.transfer_date}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, transfer_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transferForm.amount_aud}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, amount_aud: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">From Account</label>
                  <select
                    value={transferForm.from_account_id}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, from_account_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="">— Select account —</option>
                    {accountOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">To Account</label>
                  <select
                    value={transferForm.to_account_id}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, to_account_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="">— Select account —</option>
                    {accountOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setLedgerActionMode('none')} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSaveTransfer} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Record Transfer'}</button>
              </div>
            </div>
          )}

          {ledgerActionMode === 'interest' && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-5 space-y-4">
              <h3 className="font-semibold text-brand-cream">Record Interest Income</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Date</label>
                  <input
                    type="date"
                    value={interestForm.income_date}
                    onChange={(e) => setInterestForm((prev) => ({ ...prev, income_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={interestForm.amount_aud}
                    onChange={(e) => setInterestForm((prev) => ({ ...prev, amount_aud: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Account</label>
                  <select
                    value={interestForm.account_id}
                    onChange={(e) => setInterestForm((prev) => ({ ...prev, account_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="">— Select account —</option>
                    {accountOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Description</label>
                  <input
                    value={interestForm.description}
                    onChange={(e) => setInterestForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={interestForm.notes}
                    onChange={(e) => setInterestForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setLedgerActionMode('none')} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSaveInterest} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Record Interest'}</button>
              </div>
            </div>
          )}

          {ledgerActionMode === 'fx' && (
            <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-5 space-y-4">
              <h3 className="font-semibold text-brand-cream">Record Currency Change / FX Fluctuation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Date</label>
                  <input
                    type="date"
                    value={fxForm.income_date}
                    onChange={(e) => setFxForm((prev) => ({ ...prev, income_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fxForm.amount_aud}
                    onChange={(e) => setFxForm((prev) => ({ ...prev, amount_aud: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    placeholder="Use negative for loss, positive for gain"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Account</label>
                  <select
                    value={fxForm.account_id}
                    onChange={(e) => setFxForm((prev) => ({ ...prev, account_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  >
                    <option value="">— Select account —</option>
                    {accountOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Description</label>
                  <input
                    value={fxForm.description}
                    onChange={(e) => setFxForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={fxForm.notes}
                    onChange={(e) => setFxForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setLedgerActionMode('none')} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSaveFxAdjustment} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Record FX Change'}</button>
              </div>
            </div>
          )}

          {ledger.length === 0 ? (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg py-12 text-center text-brand-cream/40">No transactions yet</div>
          ) : (
            <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
              {/* Bulk action toolbar */}
              {selectedLedgerIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-brand-black/60 border-b border-brand-tan/20">
                  <span className="text-xs text-brand-cream/50">{selectedLedgerIds.size} selected</span>
                  <button
                    onClick={handleBulkDeleteLedgerRows}
                    disabled={bulkDeletingLedger}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-900/30 border border-red-600/40 text-red-400 hover:bg-red-900/50 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {bulkDeletingLedger ? 'Deleting…' : `Delete ${selectedLedgerIds.size}`}
                  </button>
                  <button
                    onClick={() => setSelectedLedgerIds(new Set())}
                    className="text-xs text-brand-cream/40 hover:text-brand-cream/70"
                  >
                    Clear selection
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-brand-black">
                    <tr>
                      {(() => {
                        const filteredIds = ledger
                          .filter((row) => {
                            if (ledgerDateFrom && row.date < ledgerDateFrom) return false;
                            if (ledgerDateTo && row.date > ledgerDateTo) return false;
                            if (ledgerAccountFilter) {
                              const acctId = getTransactionAccountId(row.notes, row.sub_type === 'member_payment' ? memberPortalAccountId : null);
                              if (acctId !== ledgerAccountFilter) return false;
                            }
                            return true;
                          })
                          .map((r) => r.id);
                        const allChecked = filteredIds.length > 0 && filteredIds.every((id) => selectedLedgerIds.has(id));
                        const someChecked = filteredIds.some((id) => selectedLedgerIds.has(id)) && !allChecked;
                        return (
                          <th className="px-4 py-3 w-8">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => { if (el) el.indeterminate = someChecked; }}
                              onChange={(e) => {
                                setSelectedLedgerIds((prev) => {
                                  const next = new Set(prev);
                                  filteredIds.forEach((id) => e.target.checked ? next.add(id) : next.delete(id));
                                  return next;
                                });
                              }}
                              className="accent-brand-tan cursor-pointer"
                            />
                          </th>
                        );
                      })()}
                      <SortTh label="Date" colKey="date" sortKey={ledgerSortKey} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="px-4 py-3" />
                      <SortTh label="Description" colKey="description" sortKey={ledgerSortKey} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="px-4 py-3" />
                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">Account</th>
                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">Currency</th>
                      <SortTh label="Amount" colKey="amount" sortKey={ledgerSortKey} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="px-4 py-3" />
                      <SortTh label="Balance" colKey="balance" sortKey={ledgerSortKey} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="px-4 py-3" />
                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">Reconciled</th>
                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-tan/10">
                    {(() => {
                      const filteredLedger = ledger.filter((row) => {
                        if (ledgerDateFrom && row.date < ledgerDateFrom) return false;
                        if (ledgerDateTo && row.date > ledgerDateTo) return false;
                        if (ledgerAccountFilter) {
                          const acctId = getTransactionAccountId(row.notes, row.sub_type === 'member_payment' ? memberPortalAccountId : null);
                          if (acctId !== ledgerAccountFilter) return false;
                        }
                        return true;
                      });
                      const sortedFilteredLedger = sortBy(filteredLedger, (row) => {
                        if (ledgerSortKey === 'description') return row.description;
                        if (ledgerSortKey === 'amount') return row.amount_aud;
                        if (ledgerSortKey === 'balance') return row.running_balance;
                        return row.date;
                      }, ledgerSortDir);
                      return sortedFilteredLedger.map((row, i) => {
                        const fallbackAccountId = row.sub_type === 'member_payment' ? memberPortalAccountId : null;
                        const accountId = getTransactionAccountId(row.notes, fallbackAccountId);
                        const reconcileType: ReconcileType = row.type === 'income' ? 'income' : 'expense';
                        const reconcileKey = getReconcileChangeKey(reconcileType, row.id);
                        const pendingReconcile = pendingReconcileChanges[reconcileKey];
                        const reconciledDisplay = pendingReconcile ? pendingReconcile.reconciled : row.reconciled;
                        const isChecked = selectedLedgerIds.has(row.id);
                        const rowNote = parseTransactionNote(row.notes ?? null);
                        const isTransfer = Boolean(rowNote.transfer_link_id);
                        return (
                          <tr key={`${row.id}-${i}`} className={`hover:bg-brand-tan/5 ${isChecked ? 'bg-brand-tan/5' : ''} ${!row.reconciled && row.source === 'manual' ? 'border-l-2 border-amber-500/50' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setSelectedLedgerIds((prev) => {
                                    const next = new Set(prev);
                                    e.target.checked ? next.add(row.id) : next.delete(row.id);
                                    return next;
                                  });
                                }}
                                className="accent-brand-tan cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtShort(row.date)}</td>
                            <td className="px-4 py-3 text-brand-cream max-w-[220px]">
                              <p className="truncate">{row.description}</p>
                              {row.notes && <p className="text-xs text-brand-cream/40 truncate">{getTransactionNoteText(row.notes)}</p>}
                            </td>
                            <td className="px-4 py-3">
                              {isTransfer ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-brand-tan/10 text-brand-tan border-brand-tan/30">
                                  ↔ transfer {rowNote.transfer_direction === 'out' ? '(out)' : rowNote.transfer_direction === 'in' ? '(in)' : ''}
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${row.type === 'income' ? 'bg-green-900/20 text-green-400 border-green-600/30' : 'bg-red-900/20 text-red-400 border-red-600/30'}`}>
                                  {row.type === 'income' ? '↓' : '↑'} {row.type}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-brand-cream/60 text-xs whitespace-nowrap">{getAccountDisplayName(accountId)}</td>
                            <td className="px-4 py-3 text-brand-cream/60 text-xs whitespace-nowrap">
                              {row.currency && row.currency !== 'AUD' ? (
                                <span className="px-1.5 py-0.5 bg-brand-black/50 border border-brand-tan/20 rounded text-brand-tan font-mono">
                                  {row.currency}
                                  {row.amount_original !== undefined && <span className="ml-1 text-brand-cream/40">{Math.abs(row.amount_original).toFixed(2)}</span>}
                                </span>
                              ) : (
                                <span className="text-brand-cream/30">AUD</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold whitespace-nowrap">
                              <span className={row.amount_aud >= 0 ? 'text-green-400' : 'text-red-400'}>{fmtSigned(row.amount_aud)}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold whitespace-nowrap">
                              <span className={row.running_balance >= 0 ? 'text-brand-cream' : 'text-red-400'}>{fmt(row.running_balance)}</span>
                            </td>
                            <td className="px-4 py-3">
                              {pendingReconcile ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-amber-400">
                                    Queued: {pendingReconcile.reconciled ? 'Reconcile' : 'Unreconcile'}
                                  </span>
                                  <button
                                    onClick={() => discardQueuedReconcile(reconcileType, row.id)}
                                    className="text-[11px] text-brand-cream/50 hover:text-brand-cream underline text-left"
                                  >
                                    Undo
                                  </button>
                                </div>
                              ) : reconciledDisplay ? (
                                <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" />Reconciled</span>
                              ) : row.source === 'manual' ? (
                                <button
                                  onClick={() => queueReconcileChange(reconcileType, row.id, true, row.reconciled)}
                                  className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />Queue reconcile
                                </button>
                              ) : (
                                <span className="text-xs text-brand-cream/30">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openLedgerEditor(row)} className="p-1 text-brand-cream/30 hover:text-brand-tan rounded" title="Edit transaction">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteLedgerRow(row)} className="p-1 text-brand-cream/30 hover:text-red-400 rounded" title="Delete transaction">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="bg-brand-black/40 border-t border-brand-tan/20">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-xs text-brand-cream/40">{(() => {
                        const filteredLedger = ledger.filter((row) => {
                          if (ledgerDateFrom && row.date < ledgerDateFrom) return false;
                          if (ledgerDateTo && row.date > ledgerDateTo) return false;
                          if (ledgerAccountFilter) {
                            const acctId = getTransactionAccountId(row.notes, row.sub_type === 'member_payment' ? memberPortalAccountId : null);
                            if (acctId !== ledgerAccountFilter) return false;
                          }
                          return true;
                        });
                        return `${filteredLedger.length} rows${(ledgerDateFrom || ledgerDateTo || ledgerAccountFilter) ? ' (filtered)' : ''}`;
                      })()}</td>
                      <td className="px-4 py-2 text-xs text-brand-cream/30">Total income:</td>
                      <td className="px-4 py-2 font-bold text-green-400 text-sm">{fmt(ledger.filter((row) => {
                        if (ledgerDateFrom && row.date < ledgerDateFrom) return false;
                        if (ledgerDateTo && row.date > ledgerDateTo) return false;
                        if (ledgerAccountFilter) {
                          const acctId = getTransactionAccountId(row.notes, row.sub_type === 'member_payment' ? memberPortalAccountId : null);
                          if (acctId !== ledgerAccountFilter) return false;
                        }
                        return row.type === 'income';
                      }).reduce((s, r) => s + r.amount_aud, 0))}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
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
                  if (!showPaymentForm) resetPaymentForm();
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
                  resetPaymentForm();
                  setShowPaymentForm(false);
                  setShowIncomeForm(false);
                }}
                className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10"
              >
                <Upload className="w-4 h-4" /> Import Payments
              </button>
              <button
                onClick={() => {
                  setShowRecurringForm(!showRecurringForm);
                  setShowPlannerIncomeSection(true);
                  setShowIncomeForm(false);
                  resetPaymentForm();
                  setShowPaymentForm(false);
                  setShowPaymentImport(false);
                }}
                className="flex items-center gap-2 border border-amber-600/40 hover:border-amber-400 text-amber-400 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-900/20"
              >
                <Repeat className="w-4 h-4" /> Recurring
              </button>
              <button
                onClick={() => {
                  setShowIncomeForm(!showIncomeForm);
                  if (!showIncomeForm) {
                    setIncomeForm((prev) => ({
                      ...prev,
                      account_source_id: prev.account_source_id || getDefaultInternalAccountId(),
                    }));
                  }
                  setShowPlannerIncomeSection(true);
                  setShowRecurringForm(false);
                  resetPaymentForm();
                  setShowPaymentForm(false);
                  setShowPaymentImport(false);
                }}
                className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10"
              >
                <Plus className="w-4 h-4" /> Add Other Income
              </button>
            </div>
          </div>

          {/* ── Record Member Payment form ─────────────────────────────── */}
          {showPaymentForm && (() => {
            const selSummary = memberPaymentSummary.find((m) => m.member_id === paymentForm.member_id);
            const selBreakdown = memberBreakdown.find((b) => b.user_id === paymentForm.member_id);
            const selPaid = selSummary?.total_paid ?? 0;
            const selShare = selBreakdown?.kitty_share_aud ?? selBreakdown?.cost_share_aud ?? 0;
            const selRemaining = selShare > 0 ? selShare - selPaid : null;
            return (
              <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-brand-cream">{editingPayment ? 'Edit Member Payment' : 'Record Member Payment'}</h3>
                  <button onClick={() => { setShowPaymentForm(false); resetPaymentForm(); }} className="text-brand-cream/40 hover:text-brand-cream">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Member balance info */}
                {paymentForm.member_id && selSummary && (
                  <div className="mb-4 flex items-center gap-4 px-4 py-3 rounded-lg bg-brand-black/40 border border-brand-tan/20 text-sm">
                    <div>
                      <p className="text-brand-cream/40 text-xs uppercase tracking-wide">Paid so far</p>
                      <p className="text-brand-tan font-bold">{fmt(selPaid)}</p>
                    </div>
                    {selShare > 0 && (
                      <>
                        <div className="h-8 w-px bg-brand-tan/20" />
                        <div>
                          <p className="text-brand-cream/40 text-xs uppercase tracking-wide">Target</p>
                          <p className="text-brand-cream font-semibold">{fmt(selShare)}</p>
                        </div>
                        <div className="h-8 w-px bg-brand-tan/20" />
                        <div>
                          <p className="text-brand-cream/40 text-xs uppercase tracking-wide">Remaining</p>
                          <p className={`font-semibold ${selRemaining !== null && selRemaining <= 0 ? 'text-green-400' : 'text-amber-400'}`}>
                            {selRemaining !== null && selRemaining <= 0 ? 'Fully paid ✓' : selRemaining !== null ? fmt(selRemaining) : '—'}
                          </p>
                        </div>
                        <div className="flex-1">
                          <div className="w-full h-1.5 bg-brand-black rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${selRemaining !== null && selRemaining <= 0 ? 'bg-green-500' : 'bg-brand-tan'}`}
                              style={{ width: `${Math.min(100, selShare > 0 ? (selPaid / selShare) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Member <span className="text-red-400">*</span></label>
                    <select
                      value={paymentForm.member_id}
                      onChange={(e) => setPaymentForm({ ...paymentForm, member_id: e.target.value })}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="">— Select member —</option>
                      {memberPaymentSummary.length > 0
                        ? memberPaymentSummary.map((m) => (
                            <option key={m.member_id} value={m.member_id}>
                              {getMemberListName(m)}
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
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Payment Type</label>
                    <select
                      value={paymentForm.payment_type}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="instalment">Regular Instalment</option>
                      <option value="deposit">Initial Deposit</option>
                      <option value="final">Final Payment</option>
                      <option value="catchup">Catch-up Payment</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD) <span className="text-red-400">*</span></label>
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
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Payment Date <span className="text-red-400">*</span></label>
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
                  <div>
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Payment Account</label>
                    <select
                      value={paymentForm.account_source_id}
                      onChange={(e) => setPaymentForm({ ...paymentForm, account_source_id: e.target.value })}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    >
                      <option value="">— Unassigned —</option>
                      {accountOptions
                        .filter((option) => option.accountType === 'bank_account')
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label>
                    <input
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                      placeholder="Optional note about this payment…"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => { setShowPaymentForm(false); resetPaymentForm(); }} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                  <button onClick={handleSavePayment} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : editingPayment ? 'Save Changes' : 'Record Payment'}</button>
                </div>
              </div>
            );
          })()}

          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLegacyPaymentSection((prev) => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-brand-tan/5 transition-colors"
            >
              <div className="text-left">
                <h3 className="font-semibold text-brand-cream">Member Collections</h3>
                <p className="text-xs text-brand-cream/40 mt-0.5">Payment history, import, and per-member status</p>
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

          {/* Member Collections Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold text-brand-cream">Member Payment Status</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-brand-cream/40 mr-1">Sort:</span>
                {(['name', 'paid', 'remaining'] as const).map((key) => {
                  const labels = { name: 'Name', paid: 'Amount Paid', remaining: 'Amount Owing' };
                  const active = memberSortKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleMemberSort(key)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-brand-tan/20 border-brand-tan/50 text-brand-tan'
                          : 'bg-transparent border-brand-tan/20 text-brand-cream/50 hover:text-brand-cream/80 hover:border-brand-tan/30'
                      }`}
                    >
                      {labels[key]}
                      {active ? (memberSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  );
                })}
                <span className="text-xs text-brand-cream/25 ml-1">{memberPaymentSummary.length} tracked</span>
              </div>
            </div>

            {/* Member payment summary cards */}
            {sortedMemberPaymentSummary.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                {sortedMemberPaymentSummary.map((m) => {
                  const breakdown = memberBreakdown.find((b) => b.user_id === m.member_id);
                  const share = breakdown?.kitty_share_aud ?? breakdown?.cost_share_aud ?? 0;
                  const paid = m.total_paid;
                  const remaining = share > 0 ? share - paid : 0;
                  const pct = share > 0 ? Math.min(100, (paid / share) * 100) : 0;
                  const isPaid = remaining <= 0;
                  return (
                    <div key={m.member_id} className={`rounded-lg border p-3 ${isPaid ? 'border-green-600/30 bg-green-900/10' : 'border-brand-tan/20 bg-brand-dark-grey'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-semibold text-brand-cream text-sm">{m.nickname || m.full_name}</p>
                        {isPaid
                          ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-600/30 whitespace-nowrap">Paid ✓</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-600/30 whitespace-nowrap">{m.payment_count} payment{m.payment_count === 1 ? '' : 's'}</span>}
                      </div>
                      <p className="text-lg font-bold text-brand-tan">{fmt(paid)}</p>
                      {share > 0 && <p className="text-xs text-brand-cream/40 mb-2">of {fmt(share)} target{remaining > 0 ? ` · ${fmt(remaining)} remaining` : ''}</p>}
                      {share > 0 && (
                        <div className="w-full h-1.5 bg-brand-black rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isPaid ? 'bg-green-500' : 'bg-brand-tan'}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      {m.last_payment_date && <p className="text-[10px] text-brand-cream/25 mt-1.5">Last: {fmtShort(m.last_payment_date)}</p>}
                    </div>
                  );
                })}
              </div>
            )}

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
	                <table className="w-full min-w-[980px]">
                  <thead className="bg-brand-black border-b border-brand-tan/20">
                    <tr>
                      {([
                        { key: 'name', label: 'Member' },
                        { key: 'paid', label: 'Total Paid' },
                        { key: 'remaining', label: 'Remaining' },
                      ] as { key: 'name' | 'paid' | 'remaining'; label: string }[]).map(({ key, label }) => (
                        <th key={key} className="px-6 py-4 text-left">
                          <button
                            type="button"
                            onClick={() => handleMemberSort(key)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-cream hover:text-brand-tan transition-colors group"
                          >
                            {label}
                            <span className={`text-xs transition-opacity ${memberSortKey === key ? 'opacity-100 text-brand-tan' : 'opacity-0 group-hover:opacity-40'}`}>
                              {memberSortKey === key ? (memberSortDir === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          </button>
                        </th>
                      ))}
                      <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">Payments</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">Last Payment</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-brand-cream">Milestone Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMemberPaymentSummary.map((member) => {
                      const hasSchedule = targetAmount > 0;
                      const memberTransactions = [...(paymentsByMember[member.member_id] ?? [])]
                        .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
                      const isExpanded = expandedMemberPayments[member.member_id] === true;
                      const remaining = Math.max(0, targetAmount - member.total_paid);
                      const percentPaid = targetAmount > 0 ? (member.total_paid / targetAmount) * 100 : 0;
                      const isFullyPaid = hasSchedule && member.total_paid >= targetAmount;
                      const isAhead = hasSchedule && !isFullyPaid && member.total_paid > expectedByMilestone;
                      const isOnTrack = hasSchedule && !isFullyPaid && member.total_paid >= expectedByMilestone;

                      return (
                        <Fragment key={member.member_id}>
                          <tr className="border-b border-brand-tan/10 hover:bg-brand-dark-grey/50">
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedMemberPayments((prev) => ({ ...prev, [member.member_id]: !prev[member.member_id] }))}
                                  className="inline-flex items-center gap-2 text-left text-brand-cream hover:text-brand-tan transition-colors"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  <span className="font-medium">{getMemberDisplayName(member)}</span>
                                </button>
                                <p className="text-xs text-brand-cream/40">{memberTransactions.length} transactions</p>
                              </div>
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
	                                  ? parseLocalDate(member.last_payment_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
	                                  : '-'}
	                              </p>
                            </td>
                            <td className="px-6 py-4">
                              {!hasSchedule ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-black/40 text-brand-cream/60 rounded-full text-sm font-medium border border-brand-tan/20">
                                  No milestones set
                                </span>
                              ) : isFullyPaid ? (
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
                                      Next due {fmtShort(nextMilestone.milestone_date)}: ${nextMilestone.accumulated_amount.toLocaleString()}
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
                                      Next due {fmtShort(nextMilestone.milestone_date)}: ${nextMilestone.accumulated_amount.toLocaleString()}
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
                                      Next due {fmtShort(nextMilestone.milestone_date)}: ${nextMilestone.accumulated_amount.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="border-b border-brand-tan/10 bg-brand-black/40">
                              <td colSpan={6} className="px-6 py-4">
                                {memberTransactions.length === 0 ? (
                                  <p className="text-sm text-brand-cream/40">No transactions recorded for this member.</p>
                                ) : (() => {
                                  const memberSelectedIds = memberTransactions.map((p) => p.id).filter((id) => selectedPaymentIds.has(id));
                                  const allChecked = memberTransactions.length > 0 && memberSelectedIds.length === memberTransactions.length;
                                  const someChecked = memberSelectedIds.length > 0 && !allChecked;
                                  return (
                                    <div>
                                      {/* Bulk toolbar */}
                                      {memberSelectedIds.length > 0 && (
                                        <div className="flex items-center gap-3 mb-2 px-1">
                                          <span className="text-xs text-brand-cream/50">{memberSelectedIds.length} selected</span>
                                          <button
                                            onClick={handleBulkDeletePayments}
                                            disabled={bulkDeleting}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-red-900/30 border border-red-600/40 text-red-400 hover:bg-red-900/50 rounded-lg text-xs font-semibold disabled:opacity-50"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            {bulkDeleting ? 'Deleting…' : `Delete ${memberSelectedIds.length}`}
                                          </button>
                                          <button
                                            onClick={() => setSelectedPaymentIds((prev) => { const next = new Set(prev); memberTransactions.forEach((p) => next.delete(p.id)); return next; })}
                                            className="text-xs text-brand-cream/40 hover:text-brand-cream/70"
                                          >
                                            Clear
                                          </button>
                                        </div>
                                      )}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="text-brand-cream/40 uppercase text-xs">
                                              <th className="px-3 py-2 w-8">
                                                <input
                                                  type="checkbox"
                                                  checked={allChecked}
                                                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                                                  onChange={(e) => {
                                                    setSelectedPaymentIds((prev) => {
                                                      const next = new Set(prev);
                                                      memberTransactions.forEach((p) => e.target.checked ? next.add(p.id) : next.delete(p.id));
                                                      return next;
                                                    });
                                                  }}
                                                  className="accent-brand-tan cursor-pointer"
                                                />
                                              </th>
                                              <th className="px-3 py-2 text-left font-semibold">Date</th>
                                              <th className="px-3 py-2 text-left font-semibold">Amount</th>
                                              <th className="px-3 py-2 text-left font-semibold">Type</th>
                                              <th className="px-3 py-2 text-left font-semibold">Method</th>
                                              <th className="px-3 py-2 text-left font-semibold">Notes</th>
                                              <th className="px-3 py-2 text-left font-semibold">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-brand-tan/10">
                                            {memberTransactions.map((payment) => {
                                              const isChecked = selectedPaymentIds.has(payment.id);
                                              const typeLabel = getPaymentTypeLabel(payment.notes);
                                              return (
                                                <tr key={payment.id} className={isChecked ? 'bg-brand-tan/5' : ''}>
                                                  <td className="px-3 py-2">
                                                    <input
                                                      type="checkbox"
                                                      checked={isChecked}
                                                      onChange={(e) => {
                                                        setSelectedPaymentIds((prev) => {
                                                          const next = new Set(prev);
                                                          e.target.checked ? next.add(payment.id) : next.delete(payment.id);
                                                          return next;
                                                        });
                                                      }}
                                                      className="accent-brand-tan cursor-pointer"
                                                    />
                                                  </td>
                                                  <td className="px-3 py-2 text-brand-cream/70">{fmtShort(payment.payment_date)}</td>
                                                  <td className="px-3 py-2 font-semibold text-green-400">{fmt(payment.amount)}</td>
                                                  <td className="px-3 py-2">
                                                    {typeLabel ? (
                                                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-tan/10 text-brand-tan border border-brand-tan/20">
                                                        {typeLabel}
                                                      </span>
                                                    ) : (
                                                      <span className="text-brand-cream/30">—</span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-brand-cream/50 capitalize">{(payment.payment_method ?? '—').replace('_', ' ')}</td>
                                                  <td className="px-3 py-2 text-brand-cream/50">{getTransactionNoteText(payment.notes) || '—'}</td>
                                                  <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                      <button onClick={() => handleEditPayment(payment)} className="p-1 text-brand-cream/40 hover:text-brand-tan" title="Edit payment">
                                                        <Edit2 className="w-4 h-4" />
                                                      </button>
                                                      <button onClick={() => handleDeletePayment(payment.id)} className="p-1 text-brand-cream/40 hover:text-red-400" title="Delete payment">
                                                        <Trash2 className="w-4 h-4" />
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </Fragment>
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
                <h3 className="font-semibold text-brand-cream">Other Income &amp; Transfers</h3>
                <p className="text-xs text-brand-cream/40 mt-0.5">Interest, refunds, inter-account transfers, and other non-member income</p>
              </div>
              <div className="flex items-center gap-3">
                {incomeEntries.length > 0 && <span className="text-green-400 font-semibold text-sm">{fmt(incomeEntries.reduce((s, e) => s + e.amount_aud, 0))}</span>}
                {showPlannerIncomeSection ? <ChevronUp className="w-5 h-5 text-brand-cream/50" /> : <ChevronDown className="w-5 h-5 text-brand-cream/50" />}
              </div>
            </button>

            {showPlannerIncomeSection && (
              <div className="p-4 border-t border-brand-tan/20 space-y-4">
                {/* Income entry form */}
                {showIncomeForm && (
                  <div className="bg-brand-black/30 border border-brand-tan/30 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-brand-cream">New Income Entry</h3>
                      <button onClick={() => setShowIncomeForm(false)} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2"><label className="block text-xs font-medium text-brand-cream/60 mb-1">Description</label>
                        <input value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="e.g. Westpac Life Interest" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Amount (AUD)</label>
                        <input type="number" min="0" step="0.01" value={incomeForm.amount_aud} onChange={(e) => setIncomeForm({ ...incomeForm, amount_aud: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Date</label>
                        <input type="date" value={incomeForm.income_date} onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Category</label>
                        <select value={incomeForm.category} onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                          <option value="interest">Interest</option>
                          <option value="transfer" disabled>Transfer (use Ledger → Transfer)</option>
                          <option value="refund">Refund</option>
                          <option value="sponsorship">Sponsorship</option>
                          <option value="other">Other</option>
                        </select></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Account</label>
                        <select value={incomeForm.account_source_id} onChange={(e) => setIncomeForm({ ...incomeForm, account_source_id: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                          <option value="">— Unassigned —</option>
                          {accountOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.name}</option>
                          ))}
                        </select></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes (optional)</label>
                        <input value={incomeForm.notes} onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                      <button onClick={() => setShowIncomeForm(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                      <button onClick={handleSaveIncome} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Add Entry'}</button>
                    </div>
                  </div>
                )}

                {/* Recurring income generator */}
                {showRecurringForm && (
                  <div className="bg-brand-black/30 border border-amber-600/20 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2"><Repeat className="w-4 h-4 text-amber-400" /><h3 className="font-semibold text-brand-cream">Generate Recurring Income</h3></div>
                      <button onClick={() => setShowRecurringForm(false)} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
                    </div>
                    <p className="text-xs text-brand-cream/50 mb-4">Creates monthly income entries (e.g. interest) for the specified number of months starting from the given date.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3"><label className="block text-xs font-medium text-brand-cream/60 mb-1">Description</label>
                        <input value={recurringForm.description} onChange={(e) => setRecurringForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Monthly Amount (AUD)</label>
                        <input type="number" min="0" step="0.01" value={recurringForm.amount_aud} onChange={(e) => setRecurringForm((p) => ({ ...p, amount_aud: e.target.value }))} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="0.00" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Start Date</label>
                        <input type="date" value={recurringForm.start_date} onChange={(e) => setRecurringForm((p) => ({ ...p, start_date: e.target.value }))} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                      <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Number of Months</label>
                        <input type="number" min="1" max="24" value={recurringForm.months} onChange={(e) => setRecurringForm((p) => ({ ...p, months: e.target.value }))} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                      <button onClick={() => setShowRecurringForm(false)} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                      <button onClick={handleGenerateRecurring} disabled={saving} className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-500 disabled:opacity-50">{saving ? 'Generating…' : `Generate ${recurringForm.months} Entries`}</button>
                    </div>
                  </div>
                )}

                {/* Income entries list */}
                {incomeEntries.length > 0 ? (
                  <div className="bg-brand-black/30 border border-brand-tan/20 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-brand-tan/20 flex items-center justify-between">
                      <h3 className="font-semibold text-brand-cream">All Entries</h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setShowRecurringForm(true); setShowIncomeForm(false); }}
                          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-600/30 rounded px-2 py-1 hover:bg-amber-900/20"
                        >
                          <Repeat className="w-3.5 h-3.5" /> Recurring
                        </button>
                        {unreconciledIncome.length > 0 && (
                          <button
                            onClick={() => {
                              let queued = 0;
                              setPendingReconcileChanges((prev) => {
                                const next = { ...prev };
                                for (const e of unreconciledIncome) {
                                  const key = getReconcileChangeKey('income', e.id);
                                  if (next[key]?.reconciled === true) continue;
                                  next[key] = { type: 'income', id: e.id, reconciled: true };
                                  queued++;
                                }
                                return next;
                              });
                              if (queued > 0) {
                                showToast('success', `${queued} income entr${queued === 1 ? 'y' : 'ies'} queued`);
                              }
                            }}
                            className="text-xs text-green-400 hover:text-green-300 border border-green-600/30 rounded px-2 py-1 hover:bg-green-900/20"
                          >
                            Queue all reconciled ({unreconciledIncome.length})
                          </button>
                        )}
                        <span className="text-green-400 font-semibold text-sm">{fmt(incomeEntries.reduce((s, e) => s + e.amount_aud, 0))}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead className="bg-brand-black">
                          <tr>
                            <SortTh label="Date" colKey="date" sortKey={incomeSortKey} sortDir={incomeSortDir} onSort={handleIncomeSort} />
                            <SortTh label="Description" colKey="description" sortKey={incomeSortKey} sortDir={incomeSortDir} onSort={handleIncomeSort} />
                            <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Category</th>
                            <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Account</th>
                            <SortTh label="Amount" colKey="amount" sortKey={incomeSortKey} sortDir={incomeSortDir} onSort={handleIncomeSort} />
                            <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Reconciled</th>
                            <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-tan/10">
                          {sortBy(incomeEntries, (e) => {
                            if (incomeSortKey === 'description') return e.description;
                            if (incomeSortKey === 'amount') return e.amount_aud;
                            return e.income_date;
                          }, incomeSortDir).map((e) => {
                            const catConfig: Record<string, { label: string; className: string }> = {
                              interest: { label: 'Interest', className: 'bg-amber-900/20 text-amber-300 border-amber-600/20' },
                              transfer: { label: 'Transfer', className: 'bg-blue-900/20 text-blue-400 border-blue-600/20' },
                              refund: { label: 'Refund', className: 'bg-purple-900/20 text-purple-400 border-purple-600/20' },
                              sponsorship: { label: 'Sponsorship', className: 'bg-green-900/20 text-green-400 border-green-600/20' },
                            };
                            const catDisplay = catConfig[e.category || ''] || { label: e.category?.replace('_', ' ') || '—', className: 'bg-brand-black/30 text-brand-cream/50 border-brand-tan/10' };
                            return (
                              <tr key={e.id} className="hover:bg-brand-tan/5">
                                <td className="px-4 py-3 text-brand-cream/60">{fmtShort(e.income_date)}</td>
                                <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${catDisplay.className}`}>{catDisplay.label}</span>
                                </td>
                                <td className="px-4 py-3 text-brand-cream/50">
                                  {(() => {
                                    const incomeNote = parseTransactionNote(e.notes);
                                    return incomeNote.account_source_id ? (accountNameById.get(incomeNote.account_source_id) || 'Unknown') : 'Unassigned';
                                  })()}
                                </td>
                                <td className="px-4 py-3 font-semibold text-green-400">{fmt(e.amount_aud)}</td>
                                <td className="px-4 py-3">
                                  {(() => {
                                    const key = getReconcileChangeKey('income', e.id);
                                    const pending = pendingReconcileChanges[key];
                                    const reconciledDisplay = pending ? pending.reconciled : e.reconciled;

                                    if (pending) {
                                      return (
                                        <div className="flex flex-col gap-1">
                                          <span className="text-xs text-amber-400">
                                            Queued: {pending.reconciled ? 'Reconcile' : 'Unreconcile'}
                                          </span>
                                          <button onClick={() => discardQueuedReconcile('income', e.id)} className="text-[11px] text-brand-cream/50 hover:text-brand-cream underline text-left">
                                            Undo
                                          </button>
                                        </div>
                                      );
                                    }

                                    if (reconciledDisplay) {
                                      return <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Yes</span>;
                                    }

                                    return (
                                      <button
                                        onClick={() => queueReconcileChange('income', e.id, true, e.reconciled)}
                                        className="text-xs text-amber-400 hover:underline"
                                      >
                                        Queue reconcile
                                      </button>
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-3"><button onClick={() => handleDeleteIncome(e.id)} className="p-1 text-brand-cream/30 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-brand-black/30 border border-brand-tan/20 rounded-lg py-8 text-center text-brand-cream/40 text-sm">
                    No income entries yet — use <strong className="text-brand-cream/60">Add Other Income</strong> above to record interest or refunds. Use <strong className="text-brand-cream/60">Ledger → Transfer</strong> for inter-account transfers.
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-brand-cream/60 text-sm">Log and manage all trip expenses</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  downloadCsv('whiskey-riders-expenses.csv', [
                    ['Date','Description','Category','Paid By','Account','Amount','Currency','AUD','Source','Reconciled'],
                    ...expenses.map((e) => [
                      e.expense_date, e.description, e.category?.name || '',
                      e.paid_by_type === 'group_kitty' ? 'Group Kitty' : e.paid_by_type === 'member' ? (e.payer?.nickname || e.payer?.full_name || 'Member') : (e.paid_by_label || 'External'),
                      getAccountDisplayName(parseTransactionNote(e.notes).account_source_id),
                      String(-Math.abs(e.amount)), e.currency, String(-Math.abs(e.amount_aud)),
                      e.source, e.reconciled ? 'Yes' : 'No',
                    ]),
                  ]);
                }}
                className="flex items-center gap-2 border border-brand-tan/20 text-brand-cream/50 hover:text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              <button onClick={() => { setShowBankImport(!showBankImport); setShowExpImport(false); setShowExpForm(false); setBankCsvRows([]); setBankCsvText(''); setBankImportClosingBalance(''); }} className="flex items-center gap-2 border border-blue-600/40 hover:border-blue-400 text-blue-400 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-900/20">
                <Landmark className="w-4 h-4" /> Import Bank CSV
              </button>
              <button onClick={() => { setShowExpImport(!showExpImport); setShowExpForm(false); setShowBankImport(false); }} className="flex items-center gap-2 border border-brand-tan/40 hover:border-brand-tan text-brand-cream px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-tan/10">
                <Upload className="w-4 h-4" /> Import Excel
              </button>
              <button onClick={() => openExpForm()} className="flex items-center gap-2 bg-brand-tan hover:bg-brand-tan/90 text-brand-black px-4 py-2 rounded-lg text-sm font-semibold">
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
          </div>

          {/* Bank CSV import panel */}
          {showBankImport && (
            <div className="bg-brand-dark-grey border border-blue-600/30 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Landmark className="w-5 h-5 text-blue-400" /><h3 className="font-semibold text-brand-cream">Import Bank Statement (CSV)</h3></div>
                <button onClick={() => { setShowBankImport(false); setBankCsvText(''); setBankCsvRows([]); setBankImportClosingBalance(''); }} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-brand-cream/50">Paste your CSV export below (Westpac format: Date, Amount, Balance, Description). Credits become income entries; debits become expenses. Select the account this statement belongs to, then paste and parse.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Account (this statement is from)</label>
                  <select
                    value={bankImportAccount}
                    onChange={(e) => setBankImportAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BUDGET_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Closing Balance from Statement (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={bankImportClosingBalance}
                      onChange={(e) => setBankImportClosingBalance(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 8481.28 — updates account balance on import"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-cream/60 mb-1">CSV Data</label>
                <textarea
                  rows={6}
                  value={bankCsvText}
                  onChange={(e) => setBankCsvText(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={'01/04/2026,-80.04,8481.28,"BPAY AMERICAN E WR DOMAIN"\n28/03/2026,500.00,8561.32,"FASTPAY Andrew Knight"'}
                />
              </div>
              {bankCsvText.trim() && (
                <button onClick={() => parseBankCsv(bankCsvText)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  Parse CSV
                </button>
              )}
              {bankCsvRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-brand-cream">{bankCsvRows.filter((r) => r.selected).length} of {bankCsvRows.length} rows selected</p>
                    <div className="flex gap-2">
                      <button onClick={() => setBankCsvRows((prev) => prev.map((r) => ({ ...r, selected: true })))} className="text-xs text-brand-tan hover:underline">Select all</button>
                      <button onClick={() => setBankCsvRows((prev) => prev.map((r) => ({ ...r, selected: false })))} className="text-xs text-brand-cream/50 hover:underline">Deselect all</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-brand-black/30 rounded-lg border border-brand-tan/10">
                    <span className="text-xs text-brand-cream/50 flex-shrink-0">Assign category to all selected:</span>
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setBankCsvRows((prev) => prev.map((r) => r.selected ? { ...r, category_id: e.target.value } : r));
                      }}
                      className="flex-1 px-2 py-1 bg-brand-black border border-brand-tan/20 rounded text-xs text-brand-cream focus:outline-none"
                      defaultValue=""
                    >
                      <option value="">— Select to bulk-assign —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-brand-tan/20">
                    <table className="w-full text-xs">
                      <thead className="bg-brand-black"><tr>{['Import', 'Date', 'Description', 'Debit', 'Credit', 'Type', 'Category'].map((h) => <th key={h} className="px-3 py-2 text-left text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-brand-tan/10">
                        {bankCsvRows.map((row, i) => (
                          <tr key={i} className={`hover:bg-brand-tan/5 ${!row.selected ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-2"><input type="checkbox" checked={row.selected} onChange={(e) => setBankCsvRows((prev) => prev.map((r, j) => j === i ? { ...r, selected: e.target.checked } : r))} className="accent-brand-tan" /></td>
                            <td className="px-3 py-2 text-brand-cream/60 whitespace-nowrap">{row.date}</td>
                            <td className="px-3 py-2 text-brand-cream max-w-[200px] truncate">{row.description}</td>
                            <td className="px-3 py-2 text-red-400 font-medium">{row.debit > 0 ? fmt(row.debit) : '—'}</td>
                            <td className="px-3 py-2 text-green-400 font-medium">{row.credit > 0 ? fmt(row.credit) : '—'}</td>
                            <td className="px-3 py-2">
                              <select value={row.type} onChange={(e) => setBankCsvRows((prev) => prev.map((r, j) => j === i ? { ...r, type: e.target.value as 'income' | 'expense' | 'skip' } : r))} className="bg-brand-black border border-brand-tan/20 rounded px-1 py-0.5 text-brand-cream/80">
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                                <option value="skip">Skip</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select value={row.category_id} onChange={(e) => setBankCsvRows((prev) => prev.map((r, j) => j === i ? { ...r, category_id: e.target.value } : r))} className="bg-brand-black border border-brand-tan/20 rounded px-1 py-0.5 text-brand-cream/80">
                                <option value="">—</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setBankCsvRows([]); setBankCsvText(''); setBankImportClosingBalance(''); }} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Clear</button>
                    <button onClick={handleImportBankRows} disabled={saving || bankCsvRows.filter((r) => r.selected && r.type !== 'skip').length === 0} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">{saving ? 'Importing…' : `Import ${bankCsvRows.filter((r) => r.selected && r.type !== 'skip').length} rows`}</button>
                  </div>
                </div>
              )}
            </div>
          )}

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
                      {(settings.enabled_currencies?.length ? settings.enabled_currencies : CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
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
                  {/* Running balance for selected category */}
                  {expForm.category_id && (() => {
                    const cat = categories.find((c) => c.id === expForm.category_id);
                    if (!cat) return null;
                    const spent = Number(cat.spent_aud || 0);
                    const planned = Number(cat.planned_aud || 0);
                    const thisExpense = parseFloat(expForm.amount_aud) || 0;
                    const remaining = planned - spent - thisExpense;
                    const isOver = remaining < 0;
                    return (
                      <div className={`mt-2 px-3 py-2 rounded-lg text-xs flex gap-4 ${isOver ? 'bg-red-900/20 border border-red-600/20' : 'bg-brand-black/40 border border-brand-tan/10'}`}>
                        <span className="text-brand-cream/50">Budget: <span className="text-brand-cream font-medium">{fmt(planned)}</span></span>
                        <span className="text-brand-cream/50">Spent: <span className="text-red-400 font-medium">{fmt(spent)}</span></span>
                        <span className="text-brand-cream/50">Remaining: <span className={`font-medium ${isOver ? 'text-red-400' : 'text-green-400'}`}>{fmt(remaining)}</span></span>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Account</label>
                  <select value={expForm.account_source_id} onChange={(e) => handleExpFormChange('account_source_id', e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan">
                    <option value="">— Unassigned —</option>
                    {accountOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
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
          ) : expenses.length > 0 && (() => {
            const filteredExpenses = expenseSearch.trim()
              ? expenses.filter((e) => {
                  const q = expenseSearch.toLowerCase();
                  return (
                    e.description?.toLowerCase().includes(q) ||
                    e.category?.name?.toLowerCase().includes(q) ||
                    e.paid_by_label?.toLowerCase().includes(q) ||
                    getAccountDisplayName(parseTransactionNote(e.notes).account_source_id).toLowerCase().includes(q)
                  );
                })
              : expenses;
            const expTotal = filteredExpenses.reduce((s, e) => s + Math.abs(Number(e.amount_aud || 0)), 0);
            return (
              <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-brand-tan/10 flex items-center gap-3">
                  <Search className="w-4 h-4 text-brand-cream/30 flex-shrink-0" />
                  <input
                    type="text"
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    placeholder="Filter by description, category, account…"
                    className="flex-1 bg-transparent text-sm text-brand-cream placeholder:text-brand-cream/30 focus:outline-none"
                  />
                  {expenseSearch && (
                    <button onClick={() => setExpenseSearch('')} className="text-brand-cream/40 hover:text-brand-cream text-xs">Clear</button>
                  )}
                  <span className="text-xs text-brand-cream/30 whitespace-nowrap">{filteredExpenses.length} of {expenses.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-sm">
                    <thead className="bg-brand-black">
                      <tr>
                        <SortTh label="Date" colKey="date" sortKey={expenseSortKey} sortDir={expenseSortDir} onSort={handleExpenseSort} className="px-3 py-3" />
                        <SortTh label="Description" colKey="description" sortKey={expenseSortKey} sortDir={expenseSortDir} onSort={handleExpenseSort} className="px-3 py-3" />
                        <th className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase">Category</th>
                        <th className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase">Paid by</th>
                        <th className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase">Account</th>
                        <th className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase">Amount</th>
                        <SortTh label="AUD" colKey="amount_aud" sortKey={expenseSortKey} sortDir={expenseSortDir} onSort={handleExpenseSort} className="px-3 py-3" />
                        <th className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase">Source</th>
                        <th className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-tan/10">
                      {sortBy(filteredExpenses, (exp) => {
                        if (expenseSortKey === 'description') return exp.description;
                        if (expenseSortKey === 'amount_aud') return exp.amount_aud;
                        return exp.expense_date;
                      }, expenseSortDir).map((exp) => (
                        <tr key={exp.id} className={`hover:bg-brand-tan/5 ${!exp.reconciled && exp.source === 'manual' ? 'border-l-2 border-amber-500/40' : ''}`}>
                          <td className="px-3 py-3 text-brand-cream/60 whitespace-nowrap">{fmtShort(exp.expense_date)}</td>
                          <td className="px-3 py-3 text-brand-cream max-w-[160px]">
                            <p className="truncate font-medium">{exp.description}</p>
                            {exp.notes && <p className="text-xs text-brand-cream/40 truncate">{getTransactionNoteText(exp.notes)}</p>}
                          </td>
                          <td className="px-3 py-3">
                            {exp.category ? <span className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: exp.category.color }} />{exp.category.name}</span> : <span className="text-brand-cream/30 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 text-xs text-brand-cream/60 capitalize">
                            {exp.paid_by_type === 'group_kitty' ? '🏦 Kitty' : exp.paid_by_type === 'member' ? (exp.payer?.nickname || exp.payer?.full_name || 'Member') : (exp.paid_by_label || 'External')}
                          </td>
                          <td className="px-3 py-3 text-brand-cream/50 text-xs">
                            {getAccountDisplayName(parseTransactionNote(exp.notes).account_source_id)}
                          </td>
                          <td className="px-3 py-3 text-red-400 text-xs whitespace-nowrap">-{Math.abs(exp.amount).toLocaleString()} {exp.currency}</td>
                          <td className="px-3 py-3 font-semibold text-red-400 whitespace-nowrap">-{fmt(Math.abs(exp.amount_aud))}</td>
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
                    <tfoot className="bg-brand-black/40 border-t border-brand-tan/20">
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-xs text-brand-cream/40">
                          {filteredExpenses.length} expense{filteredExpenses.length === 1 ? '' : 's'}{expenseSearch ? ' (filtered)' : ''}
                        </td>
                        <td className="px-3 py-3 font-bold text-red-400 whitespace-nowrap">-{fmt(expTotal)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
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
                Transactions without an account assigned cannot be reconciled. Manual entries are flagged until confirmed against your bank statement. Imported rows are auto-reconciled once an account is set.
              </p>
            </div>
          </div>

          {/* ── Bank balance reconciliation check ───────────────────────────── */}
          {(() => {
            const accounts = accountOptions.filter((a) => a.accountType !== 'paypal_wallet');
            if (accounts.length === 0 || Object.values(accountBalances).every((v, i, arr) => i === arr.length - 1 || v === 0)) return null;
            const reconciledByAccount: Record<string, number> = {};
            ledger
              .filter((row) => row.reconciled)
              .forEach((row) => {
                const acctId = getTransactionAccountId(row.notes, row.sub_type === 'member_payment' ? memberPortalAccountId : null);
                if (acctId) {
                  reconciledByAccount[acctId] = (reconciledByAccount[acctId] ?? 0) + row.amount_aud;
                }
              });
            const knownBalances: Record<string, number> = {
              westpac_choice: accountBalances.westpac_choice,
              westpac_life: accountBalances.westpac_life,
              paypal: accountBalances.paypal,
            };
            const hasAnyBalance = Object.values(knownBalances).some((v) => v > 0);
            if (!hasAnyBalance) return null;
            const discrepancies = BUDGET_ACCOUNTS.map((acct) => {
              const bookBalance = reconciledByAccount[acct.id] ?? 0;
              const bankBalance = knownBalances[acct.id] ?? 0;
              const diff = bankBalance - bookBalance;
              return { acct, bookBalance, bankBalance, diff };
            }).filter((d) => d.bankBalance > 0 || d.bookBalance !== 0);
            if (discrepancies.length === 0) return null;
            const allMatch = discrepancies.every((d) => Math.abs(d.diff) < 0.01);
            return (
              <div className={`border rounded-xl p-5 space-y-3 ${allMatch ? 'bg-green-950/30 border-green-600/30' : 'bg-amber-950/30 border-amber-600/30'}`}>
                <div className="flex items-center gap-2">
                  {allMatch ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  <h3 className={`font-semibold text-sm ${allMatch ? 'text-green-300' : 'text-amber-300'}`}>
                    Bank Balance Reconciliation {allMatch ? '— All match ✓' : '— Discrepancies found'}
                  </h3>
                  <button onClick={() => setTab('accounts')} className="ml-auto text-xs text-brand-cream/40 hover:text-brand-cream underline">Update balances →</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {discrepancies.map(({ acct, bookBalance, bankBalance, diff }) => {
                    const matches = Math.abs(diff) < 0.01;
                    return (
                      <div key={acct.id} className={`p-3 rounded-lg border ${matches ? 'bg-green-950/20 border-green-600/20' : 'bg-amber-950/20 border-amber-500/30'}`}>
                        <p className="text-xs text-brand-cream/50 font-medium mb-2">{acct.name}</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-brand-cream/40">Bank balance:</span><span className="font-semibold text-brand-cream">{fmt(bankBalance)}</span></div>
                          <div className="flex justify-between"><span className="text-brand-cream/40">Book balance:</span><span className="font-semibold text-brand-cream">{fmt(bookBalance)}</span></div>
                          <div className={`flex justify-between pt-1 border-t border-brand-tan/10 ${matches ? 'text-green-400' : 'text-amber-400'}`}>
                            <span>Difference:</span>
                            <span className="font-bold">{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
                          </div>
                        </div>
                        {!matches && (
                          <p className="text-[11px] text-amber-400/60 mt-1">
                            {Math.abs(diff) < 1 ? 'Minor rounding — check FX or fees' : diff > 0 ? 'Bank higher — unrecorded income?' : 'Bank lower — unrecorded expense?'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-brand-cream/30">Book balance = sum of all reconciled transactions per account. Set bank balances in the Accounts tab.</p>
              </div>
            );
          })()}

          {totalUnreconciled === 0 ? (
            <div className="bg-brand-dark-grey border border-green-600/30 rounded-lg py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-green-400">All transactions reconciled</p>
              <p className="text-sm text-brand-cream/40 mt-1">Every entry has an account assigned and has been confirmed</p>
            </div>
          ) : (
            <>
              {/* ── Unassigned Transactions (no account) ── */}
              {(unassignedExpenses.length > 0 || unassignedIncome.length > 0) && (
                <div className="bg-brand-dark-grey border border-red-600/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-red-600/20 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <h3 className="font-semibold text-red-400">No Account Assigned <span className="ml-2">{unassignedExpenses.length + unassignedIncome.length}</span></h3>
                    <span className="text-xs text-brand-cream/40 ml-auto">These cannot be reconciled until an account is selected</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-sm">
                      <thead className="bg-brand-black">
                        <tr>
                          <SortTh label="Date" colKey="date" sortKey={unassignedSortKey} sortDir={unassignedSortDir} onSort={handleUnassignedSort} />
                          <SortTh label="Description" colKey="description" sortKey={unassignedSortKey} sortDir={unassignedSortDir} onSort={handleUnassignedSort} />
                          <SortTh label="Amount" colKey="amount" sortKey={unassignedSortKey} sortDir={unassignedSortDir} onSort={handleUnassignedSort} />
                          <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Type</th>
                          <th className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">Assign Account</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-tan/10">
                        {sortBy(unassignedExpenses, (e) => {
                          if (unassignedSortKey === 'description') return e.description;
                          if (unassignedSortKey === 'amount') return e.amount_aud;
                          return e.expense_date;
                        }, unassignedSortDir).map((e) => (
                          <tr key={`ue-${e.id}`} className="hover:bg-red-900/10">
                            <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                            <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                            <td className="px-4 py-3 font-semibold text-red-400">−{fmt(e.amount_aud)}</td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400">Expense</span></td>
                            <td className="px-4 py-3">
                              {(() => {
                                const key = getAccountAssignmentKey('expense', e.id);
                                const pending = pendingAccountAssignments[key];
                                return (
                                  <>
                              <select
                                value={pending?.accountId ?? ''}
                                onChange={(ev) => handleAssignAccount('expense', e.id, ev.target.value)}
                                className="bg-brand-black border border-brand-tan/30 rounded px-2 py-1 text-xs text-brand-cream focus:outline-none focus:ring-1 focus:ring-brand-tan"
                              >
                                <option value="">— Select account —</option>
                                {BUDGET_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                              {pending && (
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-[11px] text-brand-tan">Queued</span>
                                  <button
                                    type="button"
                                    onClick={() => discardQueuedAccountAssignment('expense', e.id)}
                                    className="text-[11px] text-brand-cream/60 hover:text-brand-cream/90 underline"
                                  >
                                    Undo
                                  </button>
                                </div>
                              )}
                                  </>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                        {sortBy(unassignedIncome, (e) => {
                          if (unassignedSortKey === 'description') return e.description;
                          if (unassignedSortKey === 'amount') return e.amount_aud;
                          return e.income_date;
                        }, unassignedSortDir).map((e) => (
                          <tr key={`ui-${e.id}`} className="hover:bg-red-900/10">
                            <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtDate(e.income_date)}</td>
                            <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                            <td className="px-4 py-3 font-semibold text-green-400">+{fmt(e.amount_aud)}</td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400">Income</span></td>
                            <td className="px-4 py-3">
                              {(() => {
                                const key = getAccountAssignmentKey('income', e.id);
                                const pending = pendingAccountAssignments[key];
                                return (
                                  <>
                              <select
                                value={pending?.accountId ?? ''}
                                onChange={(ev) => handleAssignAccount('income', e.id, ev.target.value)}
                                className="bg-brand-black border border-brand-tan/30 rounded px-2 py-1 text-xs text-brand-cream focus:outline-none focus:ring-1 focus:ring-brand-tan"
                              >
                                <option value="">— Select account —</option>
                                {BUDGET_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                              {pending && (
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-[11px] text-brand-tan">Queued</span>
                                  <button
                                    type="button"
                                    onClick={() => discardQueuedAccountAssignment('income', e.id)}
                                    className="text-[11px] text-brand-cream/60 hover:text-brand-cream/90 underline"
                                  >
                                    Undo
                                  </button>
                                </div>
                              )}
                                  </>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {unreconciledExpenses.length > 0 && (
                <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-brand-tan/20 flex items-center justify-between">
                    <h3 className="font-semibold text-brand-cream">Unreconciled Expenses <span className="text-amber-400 ml-2">{unreconciledExpenses.length}</span></h3>
                    <button
                      onClick={() => {
                        let queued = 0;
                        setPendingReconcileChanges((prev) => {
                          const next = { ...prev };
                          for (const e of unreconciledExpenses) {
                            const key = getReconcileChangeKey('expense', e.id);
                            if (next[key]?.reconciled === true) continue;
                            next[key] = { type: 'expense', id: e.id, reconciled: true };
                            queued++;
                          }
                          return next;
                        });
                        if (queued > 0) {
                          showToast('success', `${queued} expense${queued === 1 ? '' : 's'} queued`);
                        }
                      }}
                      className="text-xs text-brand-tan hover:underline"
                    >
	                      Queue all reconciled
	                    </button>
	                  </div>
	                  <div className="overflow-x-auto">
	                    <table className="w-full min-w-[760px] text-sm">
	                      <thead className="bg-brand-black"><tr>{['Date','Description','Amount AUD','Category','Action'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
	                      <tbody className="divide-y divide-brand-tan/10">
	                        {unreconciledExpenses.map((e) => (
	                          <tr key={e.id} className="hover:bg-brand-tan/5">
	                            <td className="px-4 py-3 text-brand-cream/60">{fmtDate(e.expense_date)}</td>
	                            <td className="px-4 py-3 text-brand-cream">{e.description}</td>
	                            <td className="px-4 py-3 font-semibold text-red-400">-{fmt(Math.abs(e.amount_aud))}</td>
	                            <td className="px-4 py-3 text-brand-cream/50">{e.category?.name || '—'}</td>
	                            <td className="px-4 py-3">
                                {(() => {
                                  const key = getReconcileChangeKey('expense', e.id);
                                  const pending = pendingReconcileChanges[key];
                                  if (pending) {
                                    return (
                                      <button onClick={() => discardQueuedReconcile('expense', e.id)} className="flex items-center gap-1 text-xs text-brand-cream/70 hover:text-brand-cream border border-brand-tan/30 rounded px-2 py-1 hover:bg-brand-tan/10">
                                        <X className="w-3.5 h-3.5" /> Undo queued
                                      </button>
                                    );
                                  }
                                  return (
	                                <button onClick={() => queueReconcileChange('expense', e.id, true, e.reconciled)} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-600/30 rounded px-2 py-1 hover:bg-green-900/20">
	                                  <CheckCircle2 className="w-3.5 h-3.5" /> Queue reconcile
	                                </button>
                                  );
                                })()}
	                            </td>
	                          </tr>
	                        ))}
	                      </tbody>
	                    </table>
	                  </div>
	                </div>
	              )}

	              {unreconciledIncome.length > 0 && (
	                <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-brand-tan/20 flex items-center justify-between">
                    <h3 className="font-semibold text-brand-cream">Unreconciled Income <span className="text-amber-400 ml-2">{unreconciledIncome.length}</span></h3>
                    <button
                      onClick={() => {
                        let queued = 0;
                        setPendingReconcileChanges((prev) => {
                          const next = { ...prev };
                          for (const e of unreconciledIncome) {
                            const key = getReconcileChangeKey('income', e.id);
                            if (next[key]?.reconciled === true) continue;
                            next[key] = { type: 'income', id: e.id, reconciled: true };
                            queued++;
                          }
                          return next;
                        });
                        if (queued > 0) {
                          showToast('success', `${queued} income entr${queued === 1 ? 'y' : 'ies'} queued`);
                        }
                      }}
                      className="text-xs text-brand-tan hover:underline"
                    >
                      Queue all reconciled
                    </button>
                  </div>
	                  <div className="overflow-x-auto">
	                    <table className="w-full min-w-[700px] text-sm">
	                      <thead className="bg-brand-black"><tr>{['Date','Description','Amount','Action'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
	                      <tbody className="divide-y divide-brand-tan/10">
	                        {unreconciledIncome.map((e) => (
	                          <tr key={e.id} className="hover:bg-brand-tan/5">
	                            <td className="px-4 py-3 text-brand-cream/60">{fmtDate(e.income_date)}</td>
	                            <td className="px-4 py-3 text-brand-cream">{e.description}</td>
	                            <td className="px-4 py-3 font-semibold text-green-400">{fmt(e.amount_aud)}</td>
	                            <td className="px-4 py-3">
                                {(() => {
                                  const key = getReconcileChangeKey('income', e.id);
                                  const pending = pendingReconcileChanges[key];
                                  if (pending) {
                                    return (
                                      <button onClick={() => discardQueuedReconcile('income', e.id)} className="flex items-center gap-1 text-xs text-brand-cream/70 hover:text-brand-cream border border-brand-tan/30 rounded px-2 py-1 hover:bg-brand-tan/10">
                                        <X className="w-3.5 h-3.5" /> Undo queued
                                      </button>
                                    );
                                  }
                                  return (
	                                <button onClick={() => queueReconcileChange('income', e.id, true, e.reconciled)} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-600/30 rounded px-2 py-1 hover:bg-green-900/20">
	                                  <CheckCircle2 className="w-3.5 h-3.5" /> Queue reconcile
	                                </button>
                                  );
                                })()}
	                            </td>
	                          </tr>
	                        ))}
	                      </tbody>
	                    </table>
	                  </div>
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
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-brand-cream/60 mb-1">Committed / Forecast (AUD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-brand-cream/40 text-sm">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={catForm.committed_aud}
                        onChange={(e) => setCatForm({ ...catForm, committed_aud: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                        placeholder="Booked but not yet paid (deposits, confirmed bookings)"
                      />
                    </div>
                    <p className="text-xs text-brand-cream/30 mt-1">Booked / confirmed commitments not yet paid — shown alongside actual spend</p>
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
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
                            <label className="block text-xs font-medium text-brand-cream/60 mb-1">Who Pays?</label>
                            <select
                              value={part.payment_type ?? 'group'}
                              onChange={(e) => updateCatPart(part.id, { payment_type: e.target.value as BudgetPaymentType })}
                              className={`w-full px-3 py-2 bg-brand-black border rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan text-sm font-medium ${part.payment_type === 'personal' ? 'border-purple-500/50 text-purple-300' : 'border-brand-tan/30'}`}
                            >
                              <option value="group">Group Kitty</option>
                              <option value="personal">Personal</option>
                            </select>
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
                          <div className="flex items-center gap-3">
                            <p className="text-brand-cream/50">Part total: <span className="text-brand-tan font-semibold">{fmt(getBudgetPartTotal(part))}</span></p>
                            {part.payment_type === 'personal'
                              ? <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-300">Personal expense</span>
                              : <span className="text-xs px-2 py-0.5 rounded-full bg-brand-tan/10 border border-brand-tan/20 text-brand-tan/70">Group kitty</span>
                            }
                          </div>
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
	              <div className="overflow-x-auto">
	                <table className="w-full min-w-[900px] text-sm">
	                  <thead className="bg-brand-black">
	                    <tr>
	                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase w-6" />
	                      <SortTh label="Category" colKey="name" sortKey={catSortKey} sortDir={catSortDir} onSort={handleCatSort} className="px-4 py-3" />
	                      <SortTh label="Group Kitty" colKey="group" sortKey={catSortKey} sortDir={catSortDir} onSort={handleCatSort} className="px-4 py-3" />
	                      <SortTh label="Personal" colKey="personal" sortKey={catSortKey} sortDir={catSortDir} onSort={handleCatSort} className="px-4 py-3" />
	                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">Budget (Per Person)</th>
	                      <SortTh label="Spent" colKey="spent" sortKey={catSortKey} sortDir={catSortDir} onSort={handleCatSort} className="px-4 py-3" />
	                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">Committed</th>
	                      <SortTh label="Remaining" colKey="remaining" sortKey={catSortKey} sortDir={catSortDir} onSort={handleCatSort} className="px-4 py-3" />
	                      <th className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase" />
	                    </tr>
	                  </thead>
	                  <tbody className="divide-y divide-brand-tan/10">
	                    {sortBy(categories, (cat) => {
	                      const _parsedForSort = parseCategoryNotes(cat.notes, cat.planned_aud, defaultParticipantCount);
	                      if (catSortKey === 'group') return getCategoryGroupTotal(_parsedForSort.parts);
	                      if (catSortKey === 'personal') return getCategoryPersonalTotal(_parsedForSort.parts);
	                      if (catSortKey === 'spent') return cat.spent_aud ?? 0;
	                      if (catSortKey === 'remaining') return cat.remaining_aud ?? 0;
	                      return cat.name.toLowerCase();
	                    }, catSortDir).map((cat) => {
	                      const parsed = parseCategoryNotes(cat.notes, cat.planned_aud, defaultParticipantCount);
	                      const groupTotal = getCategoryGroupTotal(parsed.parts);
	                      const personalTotal = getCategoryPersonalTotal(parsed.parts);
	                      return (
	                        <tr key={cat.id} className="hover:bg-brand-tan/5">
	                          <td className="px-4 py-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} /></td>
	                          <td className="px-4 py-3">
	                            <p className="font-medium text-brand-cream">{cat.name}</p>
	                            <p className="text-xs text-brand-cream/40">{parsed.parts.length} part{parsed.parts.length === 1 ? '' : 's'}{personalTotal > 0 && groupTotal > 0 ? ' · mixed' : personalTotal > 0 ? ' · personal' : ''}</p>
	                          </td>
	                          <td className="px-4 py-3 text-brand-cream/70">{groupTotal > 0 ? fmt(groupTotal) : <span className="text-brand-cream/20">—</span>}</td>
	                          <td className="px-4 py-3">{personalTotal > 0 ? <span className="text-purple-300 font-medium">{fmt(personalTotal)}</span> : <span className="text-brand-cream/20">—</span>}</td>
	                          <td className="px-4 py-3 text-brand-cream/60">{fmt(cat.planned_aud / participantCount)}</td>
	                          <td className="px-4 py-3"><span className={cat.over_budget ? 'text-red-400' : 'text-brand-cream/70'}>{fmt(cat.spent_aud ?? 0)}</span></td>
	                          <td className="px-4 py-3 text-amber-300/70">
	                            {(() => {
	                              const committed = parseCategoryNotes(cat.notes, cat.planned_aud, defaultParticipantCount).committed_aud;
	                              return committed > 0 ? fmt(committed) : <span className="text-brand-cream/20">—</span>;
	                            })()}
	                          </td>
	                          <td className="px-4 py-3"><span className={cat.over_budget ? 'text-red-400 font-semibold' : 'text-green-400'}>{fmt(Math.abs(cat.remaining_aud ?? 0))}{cat.over_budget ? ' over' : ''}</span></td>
	                          <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => openCatForm(cat)} className="p-1 text-brand-cream/30 hover:text-brand-cream"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteCat(cat.id)} className="p-1 text-brand-cream/30 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div></td>
	                        </tr>
	                      );
	                    })}
	                  </tbody>
	                  <tfoot className="bg-brand-black/40 border-t border-brand-tan/20">
	                    <tr>
	                      <td className="px-4 py-3" />
	                      <td className="px-4 py-3 font-semibold text-brand-cream">Totals</td>
	                      <td className="px-4 py-3 font-semibold text-brand-tan">{fmt(categories.reduce((s, c) => s + getCategoryGroupTotal(parseCategoryNotes(c.notes, c.planned_aud, defaultParticipantCount).parts), 0))}</td>
	                      <td className="px-4 py-3 font-semibold text-purple-300">{fmt(categories.reduce((s, c) => s + getCategoryPersonalTotal(parseCategoryNotes(c.notes, c.planned_aud, defaultParticipantCount).parts), 0))}</td>
	                      <td className="px-4 py-3 font-semibold text-brand-tan">{fmt(categoriesBudgetTotal / participantCount)}</td>
	                      <td className="px-4 py-3 font-semibold text-brand-cream">{fmt(categoriesSpentTotal)}</td>
	                      <td className="px-4 py-3 font-semibold text-amber-300/70">{fmt(categories.reduce((s, c) => s + parseCategoryNotes(c.notes, c.planned_aud, defaultParticipantCount).committed_aud, 0))}</td>
	                      <td className="px-4 py-3 font-semibold">
	                        <span className={categoriesRemainingTotal < 0 ? 'text-red-400' : 'text-green-400'}>
	                          {fmt(categoriesRemainingTotal)}
	                        </span>
	                      </td>
	                      <td className="px-4 py-3" />
	                    </tr>
	                  </tfoot>
	                </table>
	              </div>
	            </div>
	          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SETTINGS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'settings' && (
        <div className="max-w-5xl space-y-5">
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-6 space-y-5">
            <h3 className="font-semibold text-brand-cream">Budget Configuration</h3>

            {/* Budget fields — both independent, with auto-sync helpers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-brand-cream/60 mb-1">Per-Person Budget (AUD)</label>
                <input
                  type="number" min="0" step="100"
                  value={settings.per_person_budget_aud || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const pp = parseFloat(e.target.value) || 0;
                    setSettings((prev) => ({
                      ...prev,
                      per_person_budget_aud: pp,
                      ...(budgetSyncMode === 'per_person_drives' ? { total_budget_aud: pp * participantCount } : {}),
                    }));
                  }}
                  className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                />
                <p className="text-xs text-brand-cream/30 mt-1">Cost each member is expected to contribute</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-cream/60 mb-1">Group Total Budget (AUD)</label>
                <input
                  type="number" min="0" step="100"
                  value={settings.total_budget_aud || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const grp = parseFloat(e.target.value) || 0;
                    setSettings((prev) => ({
                      ...prev,
                      total_budget_aud: grp,
                      ...(budgetSyncMode === 'group_drives' ? { per_person_budget_aud: participantCount > 0 ? grp / participantCount : 0 } : {}),
                    }));
                  }}
                  className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                />
                <p className="text-xs text-brand-cream/30 mt-1">Total group budget across all {participantCount} members</p>
              </div>
            </div>

            {/* Sync mode toggle */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-brand-black/30 rounded-lg border border-brand-tan/10">
              <span className="text-xs text-brand-cream/50 font-medium">Auto-calculate:</span>
              <label className="flex items-center gap-1.5 text-xs text-brand-cream/70 cursor-pointer">
                <input
                  type="radio"
                  name="budgetSyncMode"
                  checked={budgetSyncMode === 'per_person_drives'}
                  onChange={() => {
                    setBudgetSyncMode('per_person_drives');
                    setSettings((prev) => ({ ...prev, total_budget_aud: prev.per_person_budget_aud * participantCount }));
                  }}
                  className="text-brand-tan"
                />
                Per-person → Group total
              </label>
              <label className="flex items-center gap-1.5 text-xs text-brand-cream/70 cursor-pointer">
                <input
                  type="radio"
                  name="budgetSyncMode"
                  checked={budgetSyncMode === 'group_drives'}
                  onChange={() => {
                    setBudgetSyncMode('group_drives');
                    setSettings((prev) => ({ ...prev, per_person_budget_aud: participantCount > 0 ? prev.total_budget_aud / participantCount : 0 }));
                  }}
                  className="text-brand-tan"
                />
                Group total → Per-person
              </label>
              <label className="flex items-center gap-1.5 text-xs text-brand-cream/70 cursor-pointer">
                <input
                  type="radio"
                  name="budgetSyncMode"
                  checked={budgetSyncMode !== 'per_person_drives' && budgetSyncMode !== 'group_drives'}
                  onChange={() => setBudgetSyncMode('per_person_drives')}
                  className="text-brand-tan"
                />
                Independent (no auto-calc)
              </label>
            </div>

            {/* Quick-split helper */}
            {settings.total_budget_aud > 0 && (
              <div className="p-3 bg-brand-black/20 border border-brand-tan/15 rounded-lg">
                <p className="text-xs font-medium text-brand-cream/60 mb-2">Group → Per-person split ({participantCount} members)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[participantCount, participantCount - 1, participantCount + 1, participantCount + 2].filter((n) => n > 0).map((n) => (
                    <button
                      key={n}
                      onClick={() => setSettings((prev) => ({ ...prev, per_person_budget_aud: prev.total_budget_aud / n }))}
                      className="px-2 py-1.5 bg-brand-black/40 border border-brand-tan/20 rounded text-xs text-brand-cream/70 hover:border-brand-tan/50 hover:text-brand-cream transition-colors"
                    >
                      ÷ {n} = {fmt(settings.total_budget_aud / n)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Enabled currencies */}
            <div>
              <label className="block text-xs font-medium text-brand-cream/60 mb-2">Enabled Currencies for This Trip</label>
              <div className="flex flex-wrap gap-2">
                {['AUD', 'MAD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD', 'JPY', 'CHF', 'SGD'].map((cur) => {
                  const enabled = (settings.enabled_currencies ?? ['AUD']).includes(cur);
                  return (
                    <button
                      key={cur}
                      type="button"
                      disabled={cur === 'AUD'} // AUD is always enabled
                      onClick={() => {
                        setSettings((prev) => {
                          const current = prev.enabled_currencies ?? ['AUD'];
                          if (cur === 'AUD') return prev;
                          return {
                            ...prev,
                            enabled_currencies: enabled
                              ? current.filter((c) => c !== cur)
                              : [...current, cur],
                          };
                        });
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        enabled
                          ? 'bg-brand-tan/20 border-brand-tan text-brand-tan'
                          : 'border-brand-tan/20 text-brand-cream/40 hover:border-brand-tan/40 hover:text-brand-cream/60'
                      } ${cur === 'AUD' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {cur}
                      {cur === 'AUD' && <span className="ml-1 text-brand-cream/30">(default)</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-brand-cream/30 mt-2">AUD is always included. Selected currencies appear in transaction forms.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-cream/60 mb-1">Westpac Life Savings Rate (% per year)</label>
              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-[200px]">
                  <input
                    type="number" min="0" max="20" step="0.01"
                    value={interestRatePa || ''}
                    onChange={(e) => setInterestRatePa(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                    placeholder="e.g. 4.50"
                  />
                  <span className="absolute right-3 top-2 text-brand-cream/40 text-sm">%</span>
                </div>
                <button onClick={() => handleSaveInterestRate(interestRatePa)} className="px-3 py-2 bg-brand-tan/20 border border-brand-tan/30 rounded-lg text-brand-tan text-sm font-semibold hover:bg-brand-tan/30">Save</button>
              </div>
              {interestRatePa > 0 && accountBalances.westpac_life > 0 && (
                <p className="text-xs text-amber-400/70 mt-1">
                  Projected monthly interest: ~{fmt(accountBalances.westpac_life * (interestRatePa / 100) / 12)} at current balance
                </p>
              )}
            </div>
            <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label><textarea rows={3} value={settingsNotesText} onChange={(e) => setSettingsNotesText(e.target.value)} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" placeholder="Any general notes about this trip's budget…" /></div>
          </div>

          <div className="bg-brand-black/30 border border-brand-tan/20 rounded-lg p-5 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-brand-cream">Trip Payment Settings</h3>
                <p className="text-xs text-brand-cream/40 mt-1">Configure payment options, flights surcharge and bank details per trip.</p>
              </div>
              <button onClick={handleSavePaymentSettings} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-brand-cream">
                  <input
                    type="checkbox"
                    checked={paymentSettings.show_payment_options}
                    onChange={(e) => setPaymentSettings((prev) => ({ ...prev, show_payment_options: e.target.checked }))}
                    className="h-4 w-4 rounded border-brand-tan/30 bg-brand-black text-brand-tan focus:ring-brand-tan/40"
                  />
                  Show payment option cards on member pages
                </label>
                <div>
                  <label className="block text-xs font-medium text-brand-cream/60 mb-1">Flights Cost Add-on (AUD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentSettings.flights_cost_aud}
                    onChange={(e) => setPaymentSettings((prev) => ({ ...prev, flights_cost_aud: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={paymentSettings.monthly_option_title}
                    onChange={(e) => setPaymentSettings((prev) => ({ ...prev, monthly_option_title: e.target.value }))}
                    placeholder="Monthly Option Title"
                    className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                  <input
                    value={paymentSettings.monthly_option_amount_label}
                    onChange={(e) => setPaymentSettings((prev) => ({ ...prev, monthly_option_amount_label: e.target.value }))}
                    placeholder="Monthly Amount Label"
                    className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <input
                  value={paymentSettings.monthly_option_description}
                  onChange={(e) => setPaymentSettings((prev) => ({ ...prev, monthly_option_description: e.target.value }))}
                  placeholder="Monthly Description"
                  className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={paymentSettings.quarterly_option_title}
                    onChange={(e) => setPaymentSettings((prev) => ({ ...prev, quarterly_option_title: e.target.value }))}
                    placeholder="Quarterly Option Title"
                    className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                  <input
                    value={paymentSettings.quarterly_option_amount_label}
                    onChange={(e) => setPaymentSettings((prev) => ({ ...prev, quarterly_option_amount_label: e.target.value }))}
                    placeholder="Quarterly Amount Label"
                    className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <input
                  value={paymentSettings.quarterly_option_description}
                  onChange={(e) => setPaymentSettings((prev) => ({ ...prev, quarterly_option_description: e.target.value }))}
                  placeholder="Quarterly Description"
                  className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-brand-cream">
                  <input
                    type="checkbox"
                    checked={paymentSettings.show_bank_details}
                    onChange={(e) => setPaymentSettings((prev) => ({ ...prev, show_bank_details: e.target.checked }))}
                    className="h-4 w-4 rounded border-brand-tan/30 bg-brand-black text-brand-tan focus:ring-brand-tan/40"
                  />
                  Show bank details on member pages
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addPaymentSource('bank_account')}
                    className="px-3 py-1.5 text-xs border border-brand-tan/40 text-brand-cream rounded-lg hover:bg-brand-tan/10"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Add Bank Account
                  </button>
                  <button
                    type="button"
                    onClick={() => addPaymentSource('paypal')}
                    className="px-3 py-1.5 text-xs border border-brand-tan/40 text-brand-cream rounded-lg hover:bg-brand-tan/10"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Add PayPal
                  </button>
                </div>

                <div className="space-y-3">
                  {paymentSettings.payment_sources.map((source) => (
                    <div key={source.id} className="bg-brand-dark-grey border border-brand-tan/20 rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2 items-center">
                        <input
                          value={source.name}
                          onChange={(e) => updatePaymentSource(source.id, { name: e.target.value })}
                          placeholder={source.type === 'paypal' ? 'PayPal' : 'Bank Account'}
                          className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                        />
                        <select
                          value={source.type}
                          onChange={(e) => updatePaymentSource(source.id, { type: e.target.value as PaymentSourceType })}
                          className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                        >
                          <option value="bank_account">Bank Account</option>
                          <option value="paypal">PayPal</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removePaymentSource(source.id)}
                          className="px-2 py-2 text-xs border border-red-500/40 text-red-300 rounded-lg hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                          Remove
                        </button>
                      </div>

                      {source.type === 'bank_account' ? (
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-xs text-brand-cream/70">
                            <input
                              type="checkbox"
                              checked={source.member_portal_enabled}
                              onChange={() => selectMemberPortalBankSource(source.id)}
                              className="h-4 w-4 rounded border-brand-tan/30 bg-brand-black text-brand-tan focus:ring-brand-tan/40"
                            />
                            Use this account for member payments (shown on member portal)
                          </label>
                          <input
                            value={source.account_name}
                            onChange={(e) => updatePaymentSource(source.id, { account_name: e.target.value })}
                            placeholder="Account Name"
                            className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              value={source.bsb}
                              onChange={(e) => updatePaymentSource(source.id, { bsb: e.target.value })}
                              placeholder="BSB"
                              className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                            />
                            <input
                              value={source.account_number}
                              onChange={(e) => updatePaymentSource(source.id, { account_number: e.target.value })}
                              placeholder="Account Number"
                              className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                            />
                          </div>
                          <input
                            value={source.payid}
                            onChange={(e) => updatePaymentSource(source.id, { payid: e.target.value })}
                            placeholder="PayID (optional)"
                            className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                          />
                          <input
                            value={source.notes}
                            onChange={(e) => updatePaymentSource(source.id, { notes: e.target.value })}
                            placeholder="Source notes (optional)"
                            className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-brand-cream/50 uppercase tracking-wide">PayPal Wallets</p>
                            <button
                              type="button"
                              onClick={() => addPayPalWallet(source.id)}
                              className="text-xs px-2 py-1 border border-brand-tan/40 text-brand-cream rounded hover:bg-brand-tan/10"
                            >
                              <Plus className="w-3.5 h-3.5 inline mr-1" />
                              Add Wallet
                            </button>
                          </div>
                          {source.wallets.map((wallet) => (
                            <div key={wallet.id} className="border border-brand-tan/20 rounded p-2 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                  value={wallet.label}
                                  onChange={(e) => updatePayPalWallet(source.id, wallet.id, { label: e.target.value })}
                                  placeholder="Wallet Name"
                                  className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                                />
                                <input
                                  value={wallet.currency}
                                  onChange={(e) => updatePayPalWallet(source.id, wallet.id, { currency: e.target.value.toUpperCase() })}
                                  placeholder="Currency (e.g. USD)"
                                  className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                                />
                                <div className="flex items-center gap-2">
                                  <input
                                    value={wallet.email}
                                    onChange={(e) => updatePayPalWallet(source.id, wallet.id, { email: e.target.value })}
                                    placeholder="PayPal Email / ID"
                                    className="flex-1 px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePayPalWallet(source.id, wallet.id)}
                                    className="px-2 py-2 border border-red-500/40 text-red-300 rounded-lg hover:bg-red-900/20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <input
                                value={wallet.notes}
                                onChange={(e) => updatePayPalWallet(source.id, wallet.id, { notes: e.target.value })}
                                placeholder="Wallet notes (optional)"
                                className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={paymentSettings.bank_notes}
                  onChange={(e) => setPaymentSettings((prev) => ({ ...prev, bank_notes: e.target.value }))}
                  placeholder="General payment notes (optional)"
                  className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                />
              </div>
            </div>
          </div>

          <div className="bg-brand-black/30 border border-brand-tan/20 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-brand-cream">Payment Schedule Milestones</h3>
                <p className="text-xs text-brand-cream/40 mt-1">Create and maintain the accumulated target milestones for this trip.</p>
              </div>
              <button
                onClick={() => {
                  if (showMilestoneForm) {
                    setShowMilestoneForm(false);
                    resetMilestoneForm();
                  } else {
                    openMilestoneEditor();
                  }
                }}
                className="px-3 py-1.5 border border-brand-tan/40 text-brand-cream rounded-lg text-sm hover:bg-brand-tan/10"
              >
                {showMilestoneForm ? 'Cancel' : 'Add Milestone'}
              </button>
            </div>

            {showMilestoneForm && (
              <div className="bg-brand-dark-grey border border-brand-tan/30 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="date"
                    value={milestoneForm.milestone_date}
                    onChange={(e) => setMilestoneForm((prev) => ({ ...prev, milestone_date: e.target.value }))}
                    className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={milestoneForm.accumulated_amount}
                    onChange={(e) => setMilestoneForm((prev) => ({ ...prev, accumulated_amount: e.target.value }))}
                    placeholder="Accumulated Amount (AUD)"
                    className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                  <input
                    value={milestoneForm.description}
                    onChange={(e) => setMilestoneForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Description"
                    className="px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan"
                  />
                </div>
                <div className="flex justify-end mt-3">
                  <button onClick={handleSaveMilestone} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">
                    {saving ? 'Saving…' : editingMilestone ? 'Save Milestone' : 'Add Milestone'}
                  </button>
                </div>
              </div>
            )}

            {paymentSchedule.length === 0 ? (
              <p className="text-sm text-brand-cream/40">No milestones yet.</p>
            ) : (
              <div className="space-y-2">
                {paymentSchedule.map((milestone) => (
                  <div key={milestone.id} className="flex items-center justify-between bg-brand-dark-grey border border-brand-tan/20 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-cream">{fmtDate(milestone.milestone_date)} · {fmt(milestone.accumulated_amount)}</p>
                      {milestone.description && <p className="text-xs text-brand-cream/50">{milestone.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openMilestoneEditor(milestone)} className="p-1 text-brand-cream/40 hover:text-brand-tan" title="Edit milestone">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteMilestone(milestone.id)} className="p-1 text-brand-cream/40 hover:text-red-400" title="Delete milestone">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

          {/* ── Danger Zone ───────────────────────────────────────────────── */}
          <div className="bg-red-950/30 border border-red-600/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="font-semibold text-red-300 text-sm">Danger Zone</h3>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-brand-cream">Delete All Financial Data</p>
                <p className="text-xs text-brand-cream/40 mt-0.5">
                  Permanently removes ALL expenses and income entries. Member payment records are kept. Start fresh.
                </p>
              </div>
              <button
                onClick={handleDeleteAllData}
                disabled={deletingAll}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-700/30 border border-red-600/50 text-red-300 rounded-lg text-sm font-semibold hover:bg-red-700/50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deletingAll ? 'Deleting…' : 'Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
