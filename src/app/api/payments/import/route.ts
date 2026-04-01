'use server';

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
let _supabaseInstance: ReturnType<typeof createClient> | null = null;
function _getSupabase() {
  if (!_supabaseInstance) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    _supabaseInstance = createClient(_supabaseUrl, key);
  }
  return _supabaseInstance;
}
const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (_t, prop) => (_getSupabase() as any)[prop],
});

interface ParsedRow {
  user_id?: string;   // WR-format internal ID (source of truth) or UUID fallback
  name?: string;      // human-readable backup
  date: string;
  amount: string | number;
  payment_method?: string;
  notes?: string;
}

interface Profile {
  id: string;
  member_id: string | null;
  full_name: string | null;
  nickname: string | null;
}

interface ResolvedProfile {
  id: string;          // Supabase UUID (used for DB writes)
  member_id: string;   // WR-format ID
  name: string;
}

function parseDate(raw: string): string {
  const s = String(raw).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function isWrId(val: string): boolean {
  return /^WR\d+$/i.test(val.trim());
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

function isKittyRow(name?: string): boolean {
  if (!name) return false;
  const l = name.toLowerCase().trim();
  return l.includes('westpac') || l.includes('interest') || l.includes('kitty') || l === 'group';
}

function buildNameMap(profiles: Profile[]): Map<string, ResolvedProfile> {
  const map = new Map<string, ResolvedProfile>();
  for (const p of profiles) {
    const resolved: ResolvedProfile = {
      id: p.id,
      member_id: p.member_id ?? p.id,
      name: p.full_name ?? '',
    };
    if (p.full_name) {
      map.set(p.full_name.toLowerCase().trim(), resolved);
      const first = p.full_name.split(' ')[0].toLowerCase();
      if (!map.has(first)) map.set(first, resolved);
    }
    if (p.nickname) map.set(p.nickname.toLowerCase().trim(), resolved);
  }
  return map;
}

function findByName(name: string, nameMap: Map<string, ResolvedProfile>): ResolvedProfile | null {
  const lower = name.toLowerCase().trim();
  if (nameMap.has(lower)) return nameMap.get(lower)!;
  for (const [key, val] of nameMap.entries()) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return null;
}

async function loadProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, member_id, full_name, nickname');
  if (error) throw error;
  return data as Profile[];
}

function resolveProfile(
  row: ParsedRow,
  profilesByMemberId: Map<string, ResolvedProfile>,
  profilesByUuid: Map<string, ResolvedProfile>,
  nameMap: Map<string, ResolvedProfile>
): { profile: ResolvedProfile | null; match_method: 'member_id' | 'uuid' | 'name' | null } {
  const uid = String(row.user_id || '').trim();

  // 1️⃣ Primary: WR-format member_id (source of truth)
  if (uid && isWrId(uid)) {
    const p = profilesByMemberId.get(uid.toUpperCase());
    if (p) return { profile: p, match_method: 'member_id' };
  }

  // 2️⃣ Secondary: raw UUID (legacy support)
  if (uid && isUuid(uid)) {
    const p = profilesByUuid.get(uid);
    if (p) return { profile: p, match_method: 'uuid' };
  }

  // 3️⃣ Fallback: name matching
  const name = String(row.name || '').trim();
  if (name) {
    const p = findByName(name, nameMap);
    if (p) return { profile: p, match_method: 'name' };
  }

  return { profile: null, match_method: null };
}

// PUT: preview — match rows without inserting
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows } = body as { rows: ParsedRow[] };

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Missing rows array' }, { status: 400 });
    }

    const profiles = await loadProfiles();

    const profilesByMemberId = new Map<string, ResolvedProfile>(
      profiles
        .filter((p) => p.member_id)
        .map((p) => [
          p.member_id!.toUpperCase(),
          { id: p.id, member_id: p.member_id!, name: p.full_name ?? '' },
        ])
    );
    const profilesByUuid = new Map<string, ResolvedProfile>(
      profiles.map((p) => [p.id, { id: p.id, member_id: p.member_id ?? p.id, name: p.full_name ?? '' }])
    );
    const nameMap = buildNameMap(profiles);

    const preview = rows.map((row, i) => {
      const name = String(row.name || '').trim();
      if (isKittyRow(name)) {
        return { ...row, index: i, status: 'kitty', matched_name: 'Group Kitty', member_id: null, match_method: null };
      }

      const { profile, match_method } = resolveProfile(row, profilesByMemberId, profilesByUuid, nameMap);
      return {
        ...row,
        index: i,
        status: profile ? 'matched' : 'unmatched',
        member_id: profile?.id ?? null,
        matched_name: profile?.name ?? null,
        matched_member_id: profile?.member_id ?? null,
        match_method,
      };
    });

    return NextResponse.json({
      success: true,
      preview,
      summary: {
        matched: preview.filter((r) => r.status === 'matched').length,
        unmatched: preview.filter((r) => r.status === 'unmatched').length,
        kitty: preview.filter((r) => r.status === 'kitty').length,
      },
    });
  } catch (err) {
    console.error('Payment preview error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: confirm and insert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trip_id, rows, replace_existing } = body as {
      trip_id: string;
      rows: ParsedRow[];
      replace_existing?: boolean;
    };

    if (!trip_id || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Missing required fields: trip_id, rows' }, { status: 400 });
    }

    const profiles = await loadProfiles();

    const profilesByMemberId = new Map<string, ResolvedProfile>(
      profiles
        .filter((p) => p.member_id)
        .map((p) => [
          p.member_id!.toUpperCase(),
          { id: p.id, member_id: p.member_id!, name: p.full_name ?? '' },
        ])
    );
    const profilesByUuid = new Map<string, ResolvedProfile>(
      profiles.map((p) => [p.id, { id: p.id, member_id: p.member_id ?? p.id, name: p.full_name ?? '' }])
    );
    const nameMap = buildNameMap(profiles);

    if (replace_existing) {
      const { error: deleteError } = await supabase
        .from('member_payments')
        .delete()
        .eq('trip_id', trip_id);
      if (deleteError) throw deleteError;
    }

    const toInsert: Array<{
      member_id: string;
      trip_id: string;
      payment_date: string;
      amount: number;
      payment_method: string | null;
      notes: string | null;
    }> = [];

    const unmatched: string[] = [];
    let kittyCount = 0;

    for (const row of rows) {
      const name = String(row.name || '').trim();
      if (isKittyRow(name)) { kittyCount++; continue; }

      const { profile } = resolveProfile(row, profilesByMemberId, profilesByUuid, nameMap);
      if (!profile) {
        unmatched.push(String(row.user_id || name || 'Unknown'));
        continue;
      }

      const amount = parseFloat(String(row.amount));
      if (isNaN(amount) || amount <= 0) continue;

      toInsert.push({
        member_id: profile.id,   // always write the Supabase UUID to the DB
        trip_id,
        payment_date: parseDate(String(row.date || '')),
        amount,
        payment_method: row.payment_method || 'bank_transfer',
        notes: row.notes || null,
      });
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      const { data, error: insertError } = await supabase
        .from('member_payments')
        .insert(toInsert)
        .select();
      if (insertError) throw insertError;
      inserted = data?.length ?? 0;
    }

    // Log the import
    await supabase.from('payment_import_log').insert({
      trip_id,
      row_count: inserted,
      replaced: replace_existing ?? false,
    });

    return NextResponse.json({ success: true, inserted, unmatched, kitty_skipped: kittyCount });
  } catch (err) {
    console.error('Payment import error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
