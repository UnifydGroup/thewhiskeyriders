import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
} from '@/lib/api/helpers';

// GET /api/forms/[id]/fields
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('form_fields')
    .select('*')
    .eq('form_id', id)
    .order('sort_order');
  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data);
}

// POST /api/forms/[id]/fields — add a field (admin only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  const { field_type, label, placeholder, helper_text, is_required, sort_order, options, settings } = body;

  if (!field_type || !label?.trim()) {
    return errorResponse(ApiErrors.BAD_REQUEST, 'field_type and label are required');
  }

  // Auto-assign sort_order if not provided
  let order = sort_order;
  if (order === undefined || order === null) {
    const { count } = await supabase
      .from('form_fields')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', id);
    order = (count ?? 0);
  }

  const { data, error } = await supabase
    .from('form_fields')
    .insert({
      form_id: id,
      field_type,
      label: label.trim(),
      placeholder: placeholder?.trim() || null,
      helper_text: helper_text?.trim() || null,
      is_required: is_required ?? false,
      sort_order: order,
      options: options || null,
      settings: settings || null,
    })
    .select()
    .single();

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data, 201);
}

// PUT /api/forms/[id]/fields — bulk reorder fields
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  // Expect: { fields: [{ id, sort_order }] }
  const { fields } = body;
  if (!Array.isArray(fields)) return errorResponse(ApiErrors.BAD_REQUEST, 'fields array required');

  const updates = fields.map((f: { id: string; sort_order: number }) =>
    supabase.from('form_fields').update({ sort_order: f.sort_order }).eq('id', f.id).eq('form_id', id)
  );

  await Promise.all(updates);
  return successResponse({ reordered: fields.length });
}
