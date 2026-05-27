import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
  findOrCreateLibraryField,
} from '@/lib/api/helpers';

// PUT /api/forms/[id]/fields/[fieldId] — update a field
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  const { id, fieldId } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  const { label, placeholder, helper_text, is_required, sort_order, options, settings } = body;

  const { data: field, error: fieldErr } = await supabase
    .from('form_fields')
    .select('*')
    .eq('id', fieldId)
    .eq('form_id', id)
    .single();

  if (fieldErr) return errorResponse(ApiErrors.INTERNAL_ERROR, fieldErr.message);
  if (!field) return errorResponse(ApiErrors.NOT_FOUND);

  const canonicalUpdates: Record<string, unknown> = {};
  if (label !== undefined) canonicalUpdates.label = label.trim();
  if (placeholder !== undefined) canonicalUpdates.placeholder = placeholder?.trim() || null;
  if (helper_text !== undefined) canonicalUpdates.helper_text = helper_text?.trim() || null;
  if (options !== undefined) canonicalUpdates.options = options;
  if (settings !== undefined) canonicalUpdates.settings = settings;

  const formUpdates: Record<string, unknown> = {};
  if (is_required !== undefined) formUpdates.is_required = is_required;
  if (sort_order !== undefined) formUpdates.sort_order = sort_order;

  if (field.library_field_id) {
    if (Object.keys(canonicalUpdates).length > 0) {
      const { error: libErr } = await supabase
        .from('form_field_library')
        .update(canonicalUpdates)
        .eq('id', field.library_field_id);

      if (libErr) return errorResponse(ApiErrors.INTERNAL_ERROR, libErr.message);

      await supabase
        .from('form_fields')
        .update(canonicalUpdates)
        .eq('library_field_id', field.library_field_id);
    }
  } else {
    const libraryData = {
      field_type: field.field_type,
      label:      canonicalUpdates.label !== undefined ? String(canonicalUpdates.label) : field.label,
      placeholder: canonicalUpdates.placeholder !== undefined
        ? canonicalUpdates.placeholder
        : field.placeholder,
      helper_text: canonicalUpdates.helper_text !== undefined
        ? canonicalUpdates.helper_text
        : field.helper_text,
      options: canonicalUpdates.options !== undefined ? canonicalUpdates.options : field.options,
      settings: canonicalUpdates.settings !== undefined ? canonicalUpdates.settings : field.settings,
      category: null,
      created_by: null,
    };

    try {
      const libraryFieldId = await findOrCreateLibraryField(libraryData);
      formUpdates.library_field_id = libraryFieldId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(ApiErrors.INTERNAL_ERROR, `Library migration failed: ${message}`);
    }

    Object.assign(formUpdates, canonicalUpdates);
  }

  if (Object.keys(formUpdates).length > 0) {
    const { data, error } = await supabase
      .from('form_fields')
      .update(formUpdates)
      .eq('id', fieldId)
      .eq('form_id', id)
      .select()
      .single();

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    return successResponse(data);
  }

  return successResponse(field);
}

// DELETE /api/forms/[id]/fields/[fieldId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  const { id, fieldId } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const { error } = await supabase
    .from('form_fields')
    .delete()
    .eq('id', fieldId)
    .eq('form_id', id);

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ id: fieldId });
}
