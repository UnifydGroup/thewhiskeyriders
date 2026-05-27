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
// Returns form_fields joined with their library definition (if any).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('form_fields')
    .select('*, library_field:form_field_library(id, category, use_count, description)')
    .eq('form_id', id)
    .order('sort_order');
  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data);
}

// POST /api/forms/[id]/fields — add a field (admin only)
//
// Two modes:
//   A) Pick from library:  { library_field_id, is_required?, sort_order? }
//      → inherits type/label/placeholder/helper_text/options from library
//
//   B) Create new:         { field_type, label, ..., save_to_library?, category? }
//      → creates a standalone field; if save_to_library=true, also creates a
//        form_field_library entry and links back via library_field_id
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized)    return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);

  // Auto-assign sort_order if not provided
  async function nextSortOrder() {
    const { count } = await supabase
      .from('form_fields')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', id);
    return count ?? 0;
  }

  // ── Mode A: pick from library ────────────────────────────────
  if (body.library_field_id) {
    const { library_field_id, is_required, sort_order } = body;

    // Fetch library field to inherit its definition
    const { data: libField, error: libErr } = await supabase
      .from('form_field_library')
      .select('*')
      .eq('id', library_field_id)
      .single();

    if (libErr || !libField) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Library field not found');
    }

    // Check this library field isn't already on this form
    const { data: existing } = await supabase
      .from('form_fields')
      .select('id')
      .eq('form_id', id)
      .eq('library_field_id', library_field_id)
      .maybeSingle();

    if (existing) {
      return errorResponse(ApiErrors.CONFLICT, `"${libField.label}" is already on this form`);
    }

    const order = sort_order ?? await nextSortOrder();

    const { data, error } = await supabase
      .from('form_fields')
      .insert({
        form_id:          id,
        library_field_id: library_field_id,
        field_type:       libField.field_type,
        label:            libField.label,
        placeholder:      libField.placeholder,
        helper_text:      libField.helper_text,
        options:          libField.options,
        settings:         libField.settings,
        is_required:      is_required ?? false,
        sort_order:       order,
      })
      .select('*, library_field:form_field_library(id, category, use_count, description)')
      .single();

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    return successResponse(data, 201);
  }

  // ── Mode B: create new ───────────────────────────────────────
  const {
    field_type, label, placeholder, helper_text,
    is_required, sort_order, options, settings,
    save_to_library, category,
  } = body;

  if (!field_type || !label?.trim()) {
    return errorResponse(ApiErrors.BAD_REQUEST, 'field_type and label are required');
  }

  const order = sort_order ?? await nextSortOrder();
  let library_field_id: string | null = null;

  // Optionally save to library first
  if (save_to_library) {
    const { data: libField, error: libErr } = await supabase
      .from('form_field_library')
      .insert({
        field_type,
        label:       label.trim(),
        placeholder: placeholder?.trim() || null,
        helper_text: helper_text?.trim() || null,
        options:     options || null,
        settings:    settings || null,
        category:    category?.trim() || null,
        created_by:  profile.id,
      })
      .select()
      .single();

    if (libErr) return errorResponse(ApiErrors.INTERNAL_ERROR, `Library save failed: ${libErr.message}`);
    library_field_id = libField.id;
  }

  const { data, error } = await supabase
    .from('form_fields')
    .insert({
      form_id:          id,
      library_field_id: library_field_id,
      field_type,
      label:            label.trim(),
      placeholder:      placeholder?.trim() || null,
      helper_text:      helper_text?.trim() || null,
      is_required:      is_required ?? false,
      sort_order:       order,
      options:          options || null,
      settings:         settings || null,
    })
    .select('*, library_field:form_field_library(id, category, use_count, description)')
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
