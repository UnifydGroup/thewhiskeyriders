import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/cost-items
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { id: tripId } = await params;

  const { data, error } = await supabase
    .from('trip_cost_items')
    .select('id, name, description, sort_order, created_at')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// POST /api/trips/[id]/cost-items  — create a new cost item
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { id: tripId } = await params;
  const body = await req.json();
  const { name, description, sort_order } = body as {
    name: string;
    description?: string;
    sort_order?: number;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('trip_cost_items')
    .insert({ trip_id: tripId, name: name.trim(), description: description ?? null, sort_order: sort_order ?? 0 })
    .select('id, name, description, sort_order, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

// PATCH /api/trips/[id]/cost-items  — bulk update sort orders or rename
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { id: tripId } = await params;
  const body = await req.json();

  // Expect: { updates: [{ id, name?, description?, sort_order? }] }
  const updates = body.updates as { id: string; name?: string; description?: string; sort_order?: number }[];
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 });
  }

  const errors: string[] = [];
  for (const u of updates) {
    const patch: Record<string, unknown> = {};
    if (u.name !== undefined) patch.name = u.name;
    if (u.description !== undefined) patch.description = u.description;
    if (u.sort_order !== undefined) patch.sort_order = u.sort_order;
    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabase
      .from('trip_cost_items')
      .update(patch)
      .eq('id', u.id)
      .eq('trip_id', tripId);
    if (error) errors.push(error.message);
  }

  if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/trips/[id]/cost-items?item_id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { id: tripId } = await params;
  const itemId = new URL(req.url).searchParams.get('item_id');

  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  const { error } = await supabase
    .from('trip_cost_items')
    .delete()
    .eq('id', itemId)
    .eq('trip_id', tripId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
