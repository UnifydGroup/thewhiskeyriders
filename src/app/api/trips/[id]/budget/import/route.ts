import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyRole, ApiErrors, errorResponse } from '@/lib/api/helpers';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

type Params = { params: Promise<{ id: string }> };

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  currency?: string;
  amount_aud?: number;
  exchange_rate?: number;
  category?: string;
  paid_by?: string;
  notes?: string;
}

/**
 * PUT  — preview rows (no DB write)
 * POST — confirm and insert
 */

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { rows } = await request.json() as { rows: ParsedRow[] };
    if (!rows?.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

    // Return preview with validation
    const preview = rows.map((row, i) => {
      const issues: string[] = [];
      if (!row.description) issues.push('Missing description');
      if (!row.amount || isNaN(Number(row.amount))) issues.push('Invalid amount');
      if (!row.date) issues.push('Missing date');

      const currency = (row.currency || 'AUD').toUpperCase();
      const exchange_rate = row.exchange_rate || (currency === 'MAD' ? 0.14 : 1);
      const amount_aud = row.amount_aud ?? (currency === 'AUD' ? Number(row.amount) : Number(row.amount) * exchange_rate);

      return {
        ...row,
        index: i,
        currency,
        exchange_rate,
        amount_aud,
        status: issues.length === 0 ? 'valid' : 'invalid',
        issues,
      };
    });

    return NextResponse.json({
      success: true,
      preview,
      summary: {
        valid: preview.filter((r) => r.status === 'valid').length,
        invalid: preview.filter((r) => r.status === 'invalid').length,
        total_aud: preview.filter((r) => r.status === 'valid').reduce((s, r) => s + r.amount_aud, 0),
      },
    });
  } catch (err) {
    console.error('Expense import preview error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized, profile } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { rows } = await request.json() as { rows: ParsedRow[] };
    if (!rows?.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

    const supabase = getSupabase();

    // Fetch categories to match by name
    const { data: categories } = await supabase
      .from('trip_budget_categories')
      .select('id, name')
      .eq('trip_id', tripId);

    const categoryMap = new Map((categories ?? []).map((c: any) => [c.name.toLowerCase().trim(), c.id]));

    const toInsert = rows
      .filter((row) => row.description && row.amount && row.date)
      .map((row) => {
        const currency = (row.currency || 'AUD').toUpperCase();
        const exchange_rate = Number(row.exchange_rate) || (currency === 'MAD' ? 0.14 : 1);
        const amount = Number(row.amount);
        const amount_aud = row.amount_aud != null ? Number(row.amount_aud) : (currency === 'AUD' ? amount : amount * exchange_rate);

        // Try to match category
        const catKey = (row.category || '').toLowerCase().trim();
        const category_id = catKey ? (categoryMap.get(catKey) ?? null) : null;

        // paid_by type
        const paidByRaw = (row.paid_by || '').toLowerCase().trim();
        const paid_by_type = (!paidByRaw || paidByRaw === 'group kitty' || paidByRaw === 'kitty') ? 'group_kitty' : 'external';

        return {
          trip_id: tripId,
          category_id,
          description: row.description,
          amount,
          currency,
          amount_aud,
          exchange_rate,
          expense_date: row.date,
          paid_by: null,
          paid_by_type,
          paid_by_label: paid_by_type === 'external' ? row.paid_by : null,
          notes: row.notes ?? null,
          source: 'import' as const,
          reconciled: true,   // imported rows are considered reconciled by default
          created_by: profile?.id ?? null,
        };
      });

    if (!toInsert.length) {
      return NextResponse.json({ error: 'No valid rows to import' }, { status: 400 });
    }

    const { data, error } = await supabase.from('trip_expenses').insert(toInsert).select();
    if (error) throw error;

    return NextResponse.json({ success: true, inserted: data?.length ?? 0 });
  } catch (err) {
    console.error('Expense import error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
