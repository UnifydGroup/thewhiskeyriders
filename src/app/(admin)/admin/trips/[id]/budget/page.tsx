'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DollarSign, Plus, Trash2, Edit2, X, CheckCircle2, AlertCircle,
  TrendingUp, Settings, LayoutGrid, Eye, EyeOff,
  RefreshCw, Upload, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  BookOpen, ChevronDown, ChevronUp, Info, Wallet, Repeat, ArrowLeftRight,
  Building2, Landmark, Search,
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
interface LedgerRow { id: string; type: 'income' | 'expense'; sub_type: string; date: string; description: string; amount_aud: number; running_balance: number; reconciled: boolean; source: string; category?: unknown; notes?: string | null; }
interface MemberPayment { id: string; member_id: string; payment_date: string; amount: number; payment_method: string | null; notes: string | null; profiles?: { full_name: string | null; nickname: string | null }; }
interface PaymentMilestone { id: string; trip_id: string; milestone_date: string; accumulated_amount: number; description: string | null; }
interface MemberPaymentSummary { member_id: string; full_name: string; nickname?: string | null; total_paid: number; payment_count: number; last_payment_date: string | null; }
interface IncomeEntry { id: string; description: string; amount_aud: number; income_date: string; category: string | null; notes: string | null; source: string; reconciled: boolean; }
interface MemberBreakdown { user_id: string; full_name: string | null; nickname: string | null; total_paid_aud: number; cost_share_aud: number; remaining_aud: number; }
interface Overview { total_budget_aud: number; total_income_aud: number; total_collected_from_members_aud: number; total_manual_income_aud: number; total_spent_aud: number; net_position_aud: number; budget_remaining_aud: number; collection_gap_aud: number; member_count: number; cost_share_per_member_aud: number; unreconciled_count: number; }
interface BudgetSettings { total_budget_aud: number; exchange_rate_mad_aud: number; show_group_budget_to_members: boolean; show_individual_breakdown_to_members: boolean; notes: string | null; }
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
  if (!rawNotes) return { text: '', account_source_id: null };
  try {
    const parsed = JSON.parse(rawNotes) as {
      text?: unknown;
      account_source_id?: unknown;
    };
    if (parsed && typeof parsed === 'object' && ('text' in parsed || 'account_source_id' in parsed)) {
      return {
        text: typeof parsed.text === 'string' ? parsed.text : '',
        account_source_id: typeof parsed.account_source_id === 'string' ? parsed.account_source_id : null,
      };
    }
  } catch {
    // Backwards compatibility for plain text notes.
  }
  return { text: rawNotes, account_source_id: null };
}

function encodeTransactionNote(text: string, accountSourceId: string | null): string | null {
  const noteText = text.trim();
  if (!noteText && !accountSourceId) return null;
  return JSON.stringify({
    text: noteText || '',
    account_source_id: accountSourceId || null,
  });
}

function getTransactionNoteText(rawNotes: string | null): string {
  return parseTransactionNote(rawNotes).text;
}

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
      basis: (part.basis === 'group' ? 'group' : 'per_person') as BudgetPartBasis,
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
      const parsedNotes = parsed as ParsedCategoryNotes;
      const partsRaw = Array.isArray(parsedNotes.parts) ? parsedNotes.parts : [];
      const normalised = normaliseBudgetParts(partsRaw as BudgetPart[], defaultMemberCount);
      return {
        notesText: typeof parsedNotes.notes_text === 'string'
          ? parsedNotes.notes_text
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminBudgetPage() {
  const params = useParams();
  const tripId = params.id as string;
  const supabase = createClient();

  type Tab = 'pl' | 'accounts' | 'ledger' | 'income' | 'expenses' | 'reconcile' | 'categories' | 'settings';
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
    category_id: '', paid_by_type: 'group_kitty', paid_by_member: '', paid_by_label: '', account_source_id: '', notes: '',
  });

  // UI state — income form
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentImport, setShowPaymentImport] = useState(false);
  const [showLegacyPaymentSection, setShowLegacyPaymentSection] = useState(true);
  const [showPlannerIncomeSection, setShowPlannerIncomeSection] = useState(true);
  const [expandedMemberPayments, setExpandedMemberPayments] = useState<Record<string, boolean>>({});
  const [incomeForm, setIncomeForm] = useState({ description: '', amount_aud: '', income_date: new Date().toISOString().split('T')[0], category: 'other', account_source_id: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({
    member_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
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
  const [editingBalances, setEditingBalances] = useState(false);
  const [balanceForm, setBalanceForm] = useState<AccountBalances>({ westpac_choice: 0, westpac_life: 0, paypal: 0, balance_date: new Date().toISOString().split('T')[0] });

  // UI state — recurring income generator
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringForm, setRecurringForm] = useState({ description: 'Westpac Life Interest', amount_aud: '', start_date: new Date().toISOString().split('T')[0], months: '3', category: 'interest', account_source_id: '' });

  // UI state — expense search/filter
  const [expenseSearch, setExpenseSearch] = useState('');

  // UI state — bank CSV import
  const [showBankImport, setShowBankImport] = useState(false);
  const [bankCsvText, setBankCsvText] = useState('');
  const [bankCsvRows, setBankCsvRows] = useState<{ date: string; description: string; debit: number; credit: number; selected: boolean; type: 'income' | 'expense' | 'skip' }[]>([]);

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
  const resetPaymentForm = () => {
    setEditingPayment(null);
    setPaymentForm({
      member_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
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
        setSettings(d.settings);
        // Load account balances from settings.notes
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
          } catch { /* ignore */ }
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
    if (!confirm('Delete this expense?')) return;
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/trips/${tripId}/budget/expenses/${id}`, { method: 'DELETE', headers: h });
      if (!res.ok) throw new Error();
      showToast('success', 'Expense deleted'); fetchData();
    } catch { showToast('error', 'Failed to delete expense'); }
  };

  // ── Income CRUD ───────────────────────────────────────────────────────────

  const handleSaveIncome = async () => {
    if (!incomeForm.description || !incomeForm.amount_aud || !incomeForm.income_date) return showToast('error', 'All fields are required');
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/income`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          ...incomeForm,
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
    if (!confirm('Delete this income entry?')) return;
    try {
      const h = await getAuthHeader();
      const res = await fetch(`/api/trips/${tripId}/budget/income?entryId=${id}`, { method: 'DELETE', headers: h });
      if (!res.ok) throw new Error();
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
          notes: encodeTransactionNote(paymentForm.notes, paymentForm.account_source_id || null),
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
      fetchData();
    } catch {
      showToast('error', 'Failed to delete payment');
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
    if (!Number.isFinite(parsedAmount)) return showToast('error', 'Amount must be a number');

    const isMemberPayment = editingLedgerRow.type === 'income' && editingLedgerRow.sub_type === 'member_payment';
    if ((editingLedgerRow.type === 'expense' || isMemberPayment) && parsedAmount <= 0) {
      return showToast('error', 'Amount must be greater than zero');
    }

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
      const incomingRes = await fetch(`/api/trips/${tripId}/budget/income`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          description: `Transfer from ${fromName}`,
          amount_aud: amount,
          income_date: transferForm.transfer_date,
          category: 'transfer',
          notes: encodeTransactionNote(
            noteSeed ? `Transfer from ${fromName}: ${noteSeed}` : `Transfer from ${fromName}`,
            transferForm.to_account_id
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
            noteSeed ? `Transfer to ${toName}: ${noteSeed}` : `Transfer to ${toName}`,
            transferForm.from_account_id
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

  const handleReconcile = async (type: 'expense' | 'income', id: string, reconciled: boolean) => {
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/trips/${tripId}/budget/reconcile`, { method: 'POST', headers: h, body: JSON.stringify({ type, id, reconciled }) });
      if (!res.ok) throw new Error();
      fetchData();
      return true;
    } catch { showToast('error', 'Failed to update reconciliation'); }
    return false;
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

  const handleSaveAccountBalances = async () => {
    setSaving(true);
    try {
      const h = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
      // Merge into settings.notes preserving other data
      let existingNotes: Record<string, unknown> = {};
      if (settings.notes) { try { existingNotes = JSON.parse(settings.notes); } catch { /* ignore */ } }
      const updatedNotes = JSON.stringify({ ...existingNotes, account_balances: balanceForm });
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
      return { date, description, debit, credit, selected: true, type };
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
      for (const row of toImport) {
        if (row.type === 'income') {
          const body = JSON.stringify({ description: row.description, amount_aud: row.credit, income_date: row.date, category: 'other', notes: null });
          const res = await fetch(`/api/trips/${tripId}/budget/income`, { method: 'POST', headers: h, body });
          if (res.ok) created++;
        } else {
          const body = JSON.stringify({ description: row.description, amount: row.debit, currency: 'AUD', amount_aud: row.debit, exchange_rate: 1, amount_aud_overridden: false, expense_date: row.date, category_id: null, paid_by: null, paid_by_type: 'group_kitty', paid_by_label: null, notes: null, source: 'bank_import', reconciled: true });
          const res = await fetch(`/api/trips/${tripId}/budget/expenses`, { method: 'POST', headers: h, body });
          if (res.ok) created++;
        }
      }
      showToast('success', `Imported ${created} bank transactions`);
      setShowBankImport(false);
      setBankCsvText('');
      setBankCsvRows([]);
      fetchData();
    } catch { showToast('error', 'Failed to import bank rows'); }
    finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const unreconciledExpenses = expenses.filter((e) => !e.reconciled && e.source === 'manual');
  const unreconciledIncome = incomeEntries.filter((e) => !e.reconciled);
  const totalUnreconciled = unreconciledExpenses.length + unreconciledIncome.length;
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
    applyFlow(accountId, 'outflow', Number(entry.amount_aud || 0));
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
  const paymentsByMember = memberPayments.reduce<Record<string, MemberPayment[]>>((acc, payment) => {
    const memberId = payment.member_id || '__unknown__';
    if (!acc[memberId]) acc[memberId] = [];
    acc[memberId].push(payment);
    return acc;
  }, {});
  const today = new Date();
  const passedMilestones = paymentSchedule.filter((m) => new Date(m.milestone_date) <= today);
  const expectedByMilestone = passedMilestones.length > 0 ? passedMilestones[passedMilestones.length - 1].accumulated_amount : 0;
  const nextMilestone = paymentSchedule.find((m) => new Date(m.milestone_date) > today);
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
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-brand-tan" />
                <h3 className="font-semibold text-brand-cream">Cash Position</h3>
                {accountBalances.balance_date && <span className="text-xs text-brand-cream/40 ml-2">as at {fmtDate(accountBalances.balance_date)}</span>}
              </div>
              <button onClick={() => { setTab('accounts'); setEditingBalances(true); }} className="text-xs text-brand-tan hover:underline flex items-center gap-1">
                <Edit2 className="w-3 h-3" /> Update balances
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-brand-tan/20 bg-brand-black/30 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-brand-cream/40" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Westpac Choice</p></div>
                <p className="text-lg font-semibold text-brand-cream">{fmt(accountBalances.westpac_choice)}</p>
              </div>
              <div className="rounded-lg border border-brand-tan/20 bg-brand-black/30 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3.5 h-3.5 text-brand-cream/40" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Westpac Life</p></div>
                <p className="text-lg font-semibold text-brand-cream">{fmt(accountBalances.westpac_life)}</p>
              </div>
              <div className="rounded-lg border border-amber-600/20 bg-amber-900/10 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-amber-400/60" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">PayPal</p></div>
                <p className="text-lg font-semibold text-amber-300">{fmt(accountBalances.paypal)}</p>
                <p className="text-[10px] text-brand-cream/30 mt-0.5">Manually entered</p>
              </div>
              <div className="rounded-lg border border-green-600/30 bg-green-900/15 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1"><DollarSign className="w-3.5 h-3.5 text-green-400/60" /><p className="text-[11px] uppercase tracking-wide text-brand-cream/45">Total Funds</p></div>
                <p className="text-lg font-semibold text-green-400">{fmt(accountBalances.westpac_choice + accountBalances.westpac_life + accountBalances.paypal)}</p>
              </div>
            </div>
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
                  <tr>{['Account','Type','Inflow','Outflow','Net','Member Portal'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {accountFlowSummary.map((row) => (
                    <tr key={row.id} className="hover:bg-brand-tan/5">
                      <td className="px-4 py-3 font-medium text-brand-cream">{row.name}</td>
                      <td className="px-4 py-3 text-brand-cream/60">{row.typeLabel}</td>
                      <td className="px-4 py-3 text-green-400 font-semibold">{fmt(row.inflow)}</td>
                      <td className="px-4 py-3 text-red-400 font-semibold">{fmt(row.outflow)}</td>
                      <td className="px-4 py-3 font-semibold">
                        <span className={row.net >= 0 ? 'text-brand-tan' : 'text-red-400'}>{fmt(row.net)}</span>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
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
            </div>
          )}
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
          {!editingBalances && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: 'Westpac Choice 524337', value: accountBalances.westpac_choice, icon: Building2, color: 'border-brand-tan/20', textColor: 'text-brand-cream', type: 'bank' },
                { label: 'Westpac Life 253840', value: accountBalances.westpac_life, icon: Building2, color: 'border-brand-tan/20', textColor: 'text-brand-cream', type: 'bank' },
                { label: 'PayPal (manual)', value: accountBalances.paypal, icon: Wallet, color: 'border-amber-600/20', textColor: 'text-amber-300', type: 'paypal' },
                { label: 'Total Funds', value: accountBalances.westpac_choice + accountBalances.westpac_life + accountBalances.paypal, icon: DollarSign, color: 'border-green-600/30', textColor: 'text-green-400', type: 'total' },
              ].map(({ label, value, icon: Icon, color, textColor }) => (
                <div key={label} className={`rounded-xl border ${color} bg-brand-dark-grey px-5 py-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-brand-cream/40" />
                    <p className="text-xs uppercase tracking-wide text-brand-cream/45">{label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${textColor}`}>{fmt(value)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Transfers section */}
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-tan/20">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-brand-cream/60" />
                <h3 className="font-semibold text-brand-cream">Inter-Account Transfers</h3>
              </div>
              <p className="text-xs text-brand-cream/40 mt-0.5">Transfers between accounts — recorded as expense (outflow) and income (inflow) to keep the ledger balanced.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-brand-black">
                  <tr>{['Date', 'Description', 'Direction', 'Amount', 'Notes'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/10">
                  {/* Expenses flagged as transfers */}
                  {expenses.filter((e) => e.description?.toLowerCase().includes('transfer') || e.paid_by_label?.toLowerCase().includes('paypal')).map((e) => (
                    <tr key={`exp-${e.id}`} className="hover:bg-brand-tan/5">
                      <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                      <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-600/20">Outflow</span></td>
                      <td className="px-4 py-3 font-semibold text-red-400">{fmt(e.amount_aud)}</td>
                      <td className="px-4 py-3 text-brand-cream/40 text-xs">{e.notes ? String(e.notes).substring(0, 60) : '—'}</td>
                    </tr>
                  ))}
                  {/* Income entries flagged as transfers */}
                  {incomeEntries.filter((e) => e.category === 'transfer').map((e) => (
                    <tr key={`inc-${e.id}`} className="hover:bg-brand-tan/5">
                      <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtDate(e.income_date)}</td>
                      <td className="px-4 py-3 text-brand-cream">{e.description}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-900/20 text-green-400 border border-green-600/20">Inflow</span></td>
                      <td className="px-4 py-3 font-semibold text-green-400">{fmt(e.amount_aud)}</td>
                      <td className="px-4 py-3 text-brand-cream/40 text-xs">{e.notes?.substring(0, 60) || '—'}</td>
                    </tr>
                  ))}
                  {expenses.filter((e) => e.description?.toLowerCase().includes('transfer') || e.paid_by_label?.toLowerCase().includes('paypal')).length === 0 && incomeEntries.filter((e) => e.category === 'transfer').length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-brand-cream/30 text-sm">No transfers recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-brand-cream/50">
              <Info className="w-4 h-4" />
              Chronological view of all income and expenses with running balance
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => toggleLedgerActionMode('transfer')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ledgerActionMode === 'transfer' ? 'bg-brand-tan text-brand-black border-brand-tan' : 'border-brand-tan/40 text-brand-cream hover:bg-brand-tan/10'}`}
              >
                Transfer
              </button>
              <button
                onClick={() => toggleLedgerActionMode('interest')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ledgerActionMode === 'interest' ? 'bg-brand-tan text-brand-black border-brand-tan' : 'border-brand-tan/40 text-brand-cream hover:bg-brand-tan/10'}`}
              >
                Interest
              </button>
              <button
                onClick={() => toggleLedgerActionMode('fx')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ledgerActionMode === 'fx' ? 'bg-brand-tan text-brand-black border-brand-tan' : 'border-brand-tan/40 text-brand-cream hover:bg-brand-tan/10'}`}
              >
                Currency Change
              </button>
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
              <div className="flex justify-end gap-3">
                <button onClick={resetLedgerEditor} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSaveLedgerEdit} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="bg-brand-black">
                    <tr>{['Date','Description','Type','Account','Amount','Balance','Reconciled','Actions'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-brand-tan/10">
                    {ledger.map((row, i) => {
                      const fallbackAccountId = row.sub_type === 'member_payment' ? memberPortalAccountId : null;
                      const accountId = getTransactionAccountId(row.notes, fallbackAccountId);
                      return (
                        <tr key={`${row.id}-${i}`} className={`hover:bg-brand-tan/5 ${!row.reconciled && row.source === 'manual' ? 'border-l-2 border-amber-500/50' : ''}`}>
                          <td className="px-4 py-3 text-brand-cream/60 whitespace-nowrap">{fmtShort(row.date)}</td>
                          <td className="px-4 py-3 text-brand-cream max-w-[220px]">
                            <p className="truncate">{row.description}</p>
                            {row.notes && <p className="text-xs text-brand-cream/40 truncate">{getTransactionNoteText(row.notes)}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${row.type === 'income' ? 'bg-green-900/20 text-green-400 border-green-600/30' : 'bg-red-900/20 text-red-400 border-red-600/30'}`}>
                              {row.type === 'income' ? '↓' : '↑'} {row.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-brand-cream/60 text-xs whitespace-nowrap">{getAccountDisplayName(accountId)}</td>
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
                          <td className="px-4 py-3">
                            <button onClick={() => openLedgerEditor(row)} className="p-1 text-brand-cream/30 hover:text-brand-tan rounded" title="Edit transaction">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
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

          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLegacyPaymentSection((prev) => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-brand-tan/5 transition-colors"
            >
              <div className="text-left">
                <h3 className="font-semibold text-brand-cream">Legacy Payment Tracker</h3>
                <p className="text-xs text-brand-cream/40 mt-0.5">Existing tracker operations and member payment status</p>
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
                <h3 className="font-semibold text-brand-cream">{editingPayment ? 'Edit Member Payment' : 'Record Member Payment'}</h3>
                <button onClick={() => { setShowPaymentForm(false); resetPaymentForm(); }} className="text-brand-cream/40 hover:text-brand-cream">
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
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setShowPaymentForm(false); resetPaymentForm(); }} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Cancel</button>
                <button onClick={handleSavePayment} disabled={saving} className="px-4 py-2 bg-brand-tan text-brand-black text-sm font-semibold rounded-lg hover:bg-brand-tan/90 disabled:opacity-50">{saving ? 'Saving…' : editingPayment ? 'Save Changes' : 'Record Payment'}</button>
              </div>
            </div>
          )}

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
	                <table className="w-full min-w-[980px]">
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
	                                  ? new Date(member.last_payment_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
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
                          {isExpanded && (
                            <tr className="border-b border-brand-tan/10 bg-brand-black/40">
                              <td colSpan={6} className="px-6 py-4">
                                {memberTransactions.length === 0 ? (
                                  <p className="text-sm text-brand-cream/40">No transactions recorded for this member.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-brand-cream/40 uppercase text-xs">
                                          <th className="px-3 py-2 text-left font-semibold">Date</th>
                                          <th className="px-3 py-2 text-left font-semibold">Amount</th>
                                          <th className="px-3 py-2 text-left font-semibold">Method</th>
                                          <th className="px-3 py-2 text-left font-semibold">Notes</th>
                                          <th className="px-3 py-2 text-left font-semibold">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-brand-tan/10">
                                        {memberTransactions.map((payment) => (
                                          <tr key={payment.id}>
                                            <td className="px-3 py-2 text-brand-cream/70">{fmtShort(payment.payment_date)}</td>
                                            <td className="px-3 py-2 font-semibold text-green-400">{fmt(payment.amount)}</td>
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
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
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
                          <option value="transfer">Transfer (inter-account)</option>
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
                            onClick={async () => {
                              let count = 0;
                              for (const e of unreconciledIncome) { if (await handleReconcile('income', e.id, true)) count++; }
                              if (count > 0) showToast('success', `${count} income entries reconciled`);
                            }}
                            className="text-xs text-green-400 hover:text-green-300 border border-green-600/30 rounded px-2 py-1 hover:bg-green-900/20"
                          >
                            Mark all reconciled ({unreconciledIncome.length})
                          </button>
                        )}
                        <span className="text-green-400 font-semibold text-sm">{fmt(incomeEntries.reduce((s, e) => s + e.amount_aud, 0))}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead className="bg-brand-black"><tr>{['Date','Description','Category','Account','Amount','Reconciled',''].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-brand-tan/10">
                          {incomeEntries.sort((a, b) => a.income_date.localeCompare(b.income_date)).map((e) => {
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
                                <td className="px-4 py-3">{e.reconciled ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Yes</span> : <button onClick={() => handleReconcile('income', e.id, true)} className="text-xs text-amber-400 hover:underline">Mark reconciled</button>}</td>
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
                    No income entries yet — use <strong className="text-brand-cream/60">Add Other Income</strong> above to record interest, transfers, or refunds
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
              <button onClick={() => { setShowBankImport(!showBankImport); setShowExpImport(false); setShowExpForm(false); setBankCsvRows([]); setBankCsvText(''); }} className="flex items-center gap-2 border border-blue-600/40 hover:border-blue-400 text-blue-400 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-900/20">
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
                <button onClick={() => { setShowBankImport(false); setBankCsvText(''); setBankCsvRows([]); }} className="text-brand-cream/40 hover:text-brand-cream"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-brand-cream/50">Paste your Westpac CSV export below (Date, Amount, Balance, Description format). Credits become income entries; debits become expense entries. Review and deselect rows you don't want to import.</p>
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
                  <div className="overflow-x-auto rounded-lg border border-brand-tan/20">
                    <table className="w-full text-xs">
                      <thead className="bg-brand-black"><tr>{['Import', 'Date', 'Description', 'Debit', 'Credit', 'Type'].map((h) => <th key={h} className="px-3 py-2 text-left text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setBankCsvRows([]); setBankCsvText(''); }} className="px-4 py-2 border border-brand-tan/30 rounded-lg text-brand-cream text-sm font-semibold hover:bg-brand-tan/10">Clear</button>
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
            const expTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount_aud || 0), 0);
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
                      <tr>{['Date','Description','Category','Paid by','Account','Amount','AUD','Source',''].map((h) => <th key={h} className="px-3 py-3 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-brand-tan/10">
                      {filteredExpenses.map((exp) => (
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
                    <tfoot className="bg-brand-black/40 border-t border-brand-tan/20">
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-xs text-brand-cream/40">
                          {filteredExpenses.length} expense{filteredExpenses.length === 1 ? '' : 's'}{expenseSearch ? ' (filtered)' : ''}
                        </td>
                        <td className="px-3 py-3 font-bold text-brand-tan whitespace-nowrap">{fmt(expTotal)}</td>
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
                    <button
                      onClick={async () => {
                        let successCount = 0;
                        for (const e of unreconciledExpenses) {
                          if (await handleReconcile('expense', e.id, true)) successCount++;
                        }
                        if (successCount === unreconciledExpenses.length) {
                          showToast('success', 'All marked reconciled');
                        } else if (successCount > 0) {
                          showToast('success', `${successCount} of ${unreconciledExpenses.length} marked reconciled`);
                        }
                      }}
                      className="text-xs text-brand-tan hover:underline"
                    >
	                      Mark all reconciled
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
	                </div>
	              )}

	              {unreconciledIncome.length > 0 && (
	                <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-brand-tan/20 flex items-center justify-between">
                    <h3 className="font-semibold text-brand-cream">Unreconciled Income <span className="text-amber-400 ml-2">{unreconciledIncome.length}</span></h3>
                    <button
                      onClick={async () => {
                        let successCount = 0;
                        for (const e of unreconciledIncome) {
                          if (await handleReconcile('income', e.id, true)) successCount++;
                        }
                        if (successCount === unreconciledIncome.length) {
                          showToast('success', 'All income marked reconciled');
                        } else if (successCount > 0) {
                          showToast('success', `${successCount} of ${unreconciledIncome.length} marked reconciled`);
                        }
                      }}
                      className="text-xs text-brand-tan hover:underline"
                    >
                      Mark all reconciled
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
	                              <button onClick={() => handleReconcile('income', e.id, true)} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-600/30 rounded px-2 py-1 hover:bg-green-900/20">
	                                <CheckCircle2 className="w-3.5 h-3.5" /> Reconcile
	                              </button>
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
	              <div className="overflow-x-auto">
	                <table className="w-full min-w-[900px] text-sm">
	                  <thead className="bg-brand-black"><tr>{['','Category','Budget (Group)','Budget (Per Person)','Spent','Remaining',''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs text-brand-cream/40 uppercase">{h}</th>)}</tr></thead>
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
	                          <td className="px-4 py-3 text-brand-cream/60">{fmt(cat.planned_aud / participantCount)}</td>
	                          <td className="px-4 py-3"><span className={cat.over_budget ? 'text-red-400' : 'text-brand-cream/70'}>{fmt(cat.spent_aud ?? 0)}</span></td>
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
	                      <td className="px-4 py-3 font-semibold text-brand-tan">{fmt(categoriesBudgetTotal)}</td>
	                      <td className="px-4 py-3 font-semibold text-brand-tan">{fmt(categoriesBudgetTotal / participantCount)}</td>
	                      <td className="px-4 py-3 font-semibold text-brand-cream">{fmt(categoriesSpentTotal)}</td>
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
          <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-brand-cream">Budget Configuration</h3>
            <div>
              <label className="block text-xs font-medium text-brand-cream/60 mb-1">Total Budget (AUD)</label>
              <input type="number" min="0" step="100" value={settings.total_budget_aud} onChange={(e) => setSettings({ ...settings, total_budget_aud: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" />
              <p className="text-xs text-brand-cream/30 mt-1">Used for cost-share calculation per member</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                <div className="px-3 py-2 bg-brand-black/40 border border-brand-tan/20 rounded text-xs text-brand-cream/70">
                  Group budget: <span className="text-brand-tan font-semibold">{fmt(settings.total_budget_aud || 0)}</span>
                </div>
                <div className="px-3 py-2 bg-brand-black/40 border border-brand-tan/20 rounded text-xs text-brand-cream/70">
                  Per person ({participantCount} members): <span className="text-brand-tan font-semibold">{fmt((settings.total_budget_aud || 0) / participantCount)}</span>
                </div>
              </div>
            </div>
            <div><label className="block text-xs font-medium text-brand-cream/60 mb-1">Notes</label><textarea rows={3} value={settings.notes ?? ''} onChange={(e) => setSettings({ ...settings, notes: e.target.value || null })} className="w-full px-3 py-2 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan" /></div>
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
        </div>
      )}
    </div>
  );
}
