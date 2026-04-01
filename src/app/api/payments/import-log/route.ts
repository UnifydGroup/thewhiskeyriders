'use server';

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

export async function GET(request: NextRequest) {
  const tripId = new URL(request.url).searchParams.get('trip_id');
  if (!tripId) return NextResponse.json({ error: 'trip_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('payment_import_log')
    .select('imported_at, row_count, replaced')
    .eq('trip_id', tripId)
    .order('imported_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data ?? null });
}
