import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, profile } = await verifyRole(
      request,
      ['member', 'trip_admin', 'admin', 'super_admin']
    );
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

    const isAdmin = ['trip_admin', 'admin', 'super_admin'].includes(profile?.role ?? '');
    const toNumber = (value: unknown) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    if (!isAdmin) {
      const { data: membership, error: membershipError } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', profile?.id ?? '')
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) return errorResponse(ApiErrors.FORBIDDEN);
    }

    // ── Budget settings ──────────────────────────────────────────────────────
    const { data: settings, error: settingsError } = await supabase
      .from('trip_budget_settings')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const budgetSettings = settings ?? {
      total_budget_aud: 0,
      show_group_budget_to_members: false,
      show_individual_breakdown_to_members: false,
      exchange_rate_mad_aud: 0.14,
      notes: null,
    };

    const groupVisibleToMembers = budgetSettings.show_group_budget_to_members === true;
    const individualVisibleToMembers = budgetSettings.show_individual_breakdown_to_members === true;
    const showGroup = isAdmin ? true : groupVisibleToMembers;
    const showIndividual = isAdmin ? true : (groupVisibleToMembers && individualVisibleToMembers);

    // ── Categories ───────────────────────────────────────────────────────────
    let categories: any[] = [];
    if (showGroup) {
      const { data } = await supabase
        .from('trip_budget_categories')
        .select('*')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true });
      categories = data ?? [];
    }

    // ── Expenses ─────────────────────────────────────────────────────────────
    let expenseList: any[] = [];
    let expensesByCategory: Record<string, number> = {};
    let totalSpentAud = 0;
    let unreconciled_count = 0;

    if (showGroup) {
      const query = supabase
        .from('trip_expenses')
        .select(`
          *,
          category:trip_budget_categories(id, name, color),
          payer:profiles!trip_expenses_paid_by_fkey(id, full_name, nickname)
        `)
        .eq('trip_id', tripId)
        .order('expense_date', { ascending: false });

      const { data: expenses } = await query;
      expenseList = isAdmin ? (expenses ?? []) : [];

      for (const e of expenses ?? []) {
        const amountAud = toNumber(e.amount_aud);
        totalSpentAud += amountAud;
        const key = e.category_id ?? '__uncategorised__';
        expensesByCategory[key] = (expensesByCategory[key] ?? 0) + amountAud;
        if (!e.reconciled && e.source === 'manual') unreconciled_count++;
      }
    }

    // ── Member payments (from member_payments table) ──────────────────────────
    const { data: memberPaymentsRaw } = await supabase
      .from('member_payments')
      .select('id, member_id, payment_date, amount, payment_method, notes, profiles:member_id(full_name, nickname)')
      .eq('trip_id', tripId)
      .order('payment_date', { ascending: false });

    const memberPaymentsAll = memberPaymentsRaw ?? [];
    const totalCollectedFromMembers = memberPaymentsAll.reduce((s: number, p: any) => s + toNumber(p.amount), 0);

    // ── Manual income entries ─────────────────────────────────────────────────
    let manualIncomeEntries: any[] = [];
    let totalManualIncome = 0;
    if (isAdmin) {
      const { data: incomeData } = await supabase
        .from('trip_income_entries')
        .select('*')
        .eq('trip_id', tripId)
        .order('income_date', { ascending: false });
      manualIncomeEntries = incomeData ?? [];
      totalManualIncome = manualIncomeEntries.reduce((s: number, e: any) => s + toNumber(e.amount_aud), 0);
    }

    const totalIncomeAud = totalCollectedFromMembers + totalManualIncome;

    // ── Trip members for per-member cost share ────────────────────────────────
    const { data: tripMembers } = await supabase
      .from('trip_members')
      .select('user_id, profiles(id, full_name, nickname, avatar_url)')
      .eq('trip_id', tripId);

    const memberCount = (tripMembers ?? []).length;
    const totalBudgetAud = toNumber(budgetSettings.total_budget_aud);
    const costSharePerMember = memberCount > 0 ? totalBudgetAud / memberCount : 0;

    // Per-member payment totals
    const memberTotalsMap: Record<string, number> = {};
    memberPaymentsAll.forEach((p: any) => {
      memberTotalsMap[p.member_id] = (memberTotalsMap[p.member_id] ?? 0) + toNumber(p.amount);
    });

    // Per-member breakdown
    let memberBreakdown: any[] = [];
    if (showIndividual && tripMembers) {
      memberBreakdown = tripMembers.map((tm: any) => {
        const paid = memberTotalsMap[tm.user_id] ?? 0;
        const remaining = Math.max(0, costSharePerMember - paid);
        return {
          user_id: tm.user_id,
          full_name: tm.profiles?.full_name ?? null,
          nickname: tm.profiles?.nickname ?? null,
          avatar_url: tm.profiles?.avatar_url ?? null,
          total_paid_aud: paid,
          cost_share_aud: costSharePerMember,
          remaining_aud: remaining,
          is_current_user: tm.user_id === profile?.id,
        };
      });
      if (!isAdmin) {
        memberBreakdown = memberBreakdown.filter((m) => m.is_current_user);
      }
    }

    // ── Category breakdown with actuals ──────────────────────────────────────
    const categoriesWithActuals = categories.map((cat: any) => {
      const plannedAud = toNumber(cat.planned_aud);
      const spentAud = expensesByCategory[cat.id] ?? 0;
      return {
        ...cat,
        spent_aud: spentAud,
        remaining_aud: Math.max(0, plannedAud - spentAud),
        over_budget: spentAud > plannedAud,
      };
    });

    // ── Unified ledger (admin only) ───────────────────────────────────────────
    let ledger: any[] = [];
    if (isAdmin) {
      // Income rows from member payments
      const incomeRows = memberPaymentsAll.map((p: any) => ({
        id: p.id,
        type: 'income',
        sub_type: 'member_payment',
        date: p.payment_date,
        description: `${p.profiles?.nickname ?? p.profiles?.full_name ?? 'Member'} — payment`,
        amount_aud: toNumber(p.amount),
        notes: p.notes ?? null,
        reconciled: true,
        source: 'payment_tracker',
      }));

      // Income rows from manual entries
      const manualIncomeRows = manualIncomeEntries.map((e: any) => ({
        id: e.id,
        type: 'income',
        sub_type: 'manual',
        date: e.income_date,
        description: e.description,
        amount_aud: toNumber(e.amount_aud),
        category: e.category,
        notes: e.notes ?? null,
        reconciled: e.reconciled,
        source: e.source,
      }));

      // Expense rows
      const expenseRows = expenseList.map((e: any) => ({
        id: e.id,
        type: 'expense',
        sub_type: e.category?.name ?? 'Uncategorised',
        date: e.expense_date,
        description: e.description,
        amount_aud: -toNumber(e.amount_aud),
        currency: e.currency,
        amount_original: e.amount,
        category: e.category,
        paid_by_type: e.paid_by_type,
        paid_by_label: e.paid_by_label,
        payer: e.payer,
        notes: e.notes ?? null,
        reconciled: e.reconciled,
        source: e.source,
      }));

      // Sort all by date descending
      ledger = [...incomeRows, ...manualIncomeRows, ...expenseRows]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Running balance (applied in order, so reverse then accumulate)
      let balance = 0;
      const sorted_asc = [...ledger].reverse();
      const withBalance = sorted_asc.map((row) => {
        balance += row.amount_aud;
        return { ...row, running_balance: balance };
      });
      ledger = withBalance.reverse();
    }

    const exposeBudgetFigures = isAdmin || showGroup;

    return successResponse({
      settings: {
        total_budget_aud: exposeBudgetFigures ? totalBudgetAud : 0,
        exchange_rate_mad_aud: toNumber(budgetSettings.exchange_rate_mad_aud),
        show_group_budget_to_members: groupVisibleToMembers,
        show_individual_breakdown_to_members: individualVisibleToMembers,
        notes: exposeBudgetFigures ? budgetSettings.notes : null,
      },
      visibility: {
        show_group: showGroup,
        show_individual: showIndividual,
        is_admin: isAdmin,
      },
      overview: showGroup ? {
        total_budget_aud: totalBudgetAud,
        total_planned_aud: categories.reduce((s: number, c: any) => s + toNumber(c.planned_aud), 0),
        total_income_aud: totalIncomeAud,
        total_collected_from_members_aud: totalCollectedFromMembers,
        total_manual_income_aud: totalManualIncome,
        total_spent_aud: totalSpentAud,
        net_position_aud: totalIncomeAud - totalSpentAud,
        budget_remaining_aud: totalBudgetAud - totalSpentAud,
        collection_gap_aud: totalBudgetAud - totalCollectedFromMembers,
        member_count: memberCount,
        cost_share_per_member_aud: costSharePerMember,
        uncategorised_spend_aud: expensesByCategory['__uncategorised__'] ?? 0,
        unreconciled_count,
      } : null,
      categories: showGroup ? categoriesWithActuals : [],
      expenses: isAdmin ? expenseList : [],
      income_entries: isAdmin ? manualIncomeEntries : [],
      member_payments: showIndividual ? (isAdmin ? memberPaymentsAll : memberBreakdown) : [],
      member_breakdown: showIndividual ? memberBreakdown : [],
      ledger: isAdmin ? ledger : [],
    });
  } catch (err) {
    console.error('GET budget/summary error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
