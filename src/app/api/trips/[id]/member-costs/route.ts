import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/member-costs
// Returns all assignments for this trip: { assignments: [...] }
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { id: tripId } = await params;

  const { data, error } = await supabase
    .from('member_cost_assignments')
    .select('id, member_id, cost_item_id, is_self_funded, notes, updated_at')
    .eq('trip_id', tripId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data ?? [] });
}

// POST /api/trips/[id]/member-costs
// Upsert a single assignment: { member_id, cost_item_id, is_self_funded, notes? }
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { id: tripId } = await params;
  const body = await req.json();

  const { member_id, cost_item_id, is_self_funded, notes } = body as {
    member_id: string;
    cost_item_id: string;
    is_self_funded: boolean;
    notes?: string;
  };

  if (!member_id || !cost_item_id) {
    return NextResponse.json({ error: 'member_id and cost_item_id are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('member_cost_assignments')
    .upsert(
      {
        trip_id: tripId,
        member_id,
        cost_item_id,
        is_self_funded: is_self_funded ?? false,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'trip_id,member_id,cost_item_id' }
    )
    .select('id, member_id, cost_item_id, is_self_funded, notes, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}
