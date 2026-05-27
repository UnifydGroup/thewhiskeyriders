import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
} from '@/lib/api/helpers';

// PUT /api/forms/field-library/[libFieldId] — update a library field definition
// This propagates to ALL form_fields that reference it (label, placeholder, helper_text, options)
// so data stays consistent. field_type is intentionally NOT updatable once created.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ libFieldId: string }> }
) {
  const { libFieldId } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized)    return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  const { label, description, placeholder, helper_text, options, settings, category } = body;

  const libUpdates: Record<string, unknown> = {};
  if (label !== undefined)       libUpdates.label       = label.trim();
  if (description !== undefined) libUpdates.description = description?.trim() || null;
  if (placeholder !== undefined) libUpdates.placeholder = placeholder?.trim() || null;
  if (helper_text !== undefined) libUpdates.helper_text = helper_text?.trim() || null;
  if (options !== undefined)     libUpdates.options     = options;
  if (settings !== undefined)    libUpdates.settings    = settings;
  if (category !== undefined)    libUpdates.category    = category?.trim() || null;

  const { data: lib, error: libErr } = await supabase
    .from('form_field_library')
    .update(libUpdates)
    .eq('id', libFieldId)
    .select()
    .single();

  if (libErr) return errorResponse(ApiErrors.INTERNAL_ERROR, libErr.message);
  if (!lib)   return errorResponse(ApiErrors.NOT_FOUND);

  // Propagate label / placeholder / helper_text / options to all linked form_fields
  // (type is immutable; is_required and sort_order are per-form overrides — don't touch them)
  const fieldUpdates: Record<string, unknown> = {};
  if (label !== undefined)       fieldUpdates.label       = lib.label;
  if (placeholder !== undefined) fieldUpdates.placeholder = lib.placeholder;
  if (helper_text !== undefined) fieldUpdates.helper_text = lib.helper_text;
  if (options !== undefined)     fieldUpdates.options     = lib.options;

  if (Object.keys(fieldUpdates).length > 0) {
    await supabase
      .from('form_fields')
      .update(fieldUpdates)
      .eq('library_field_id', libFieldId);
  }

  return successResponse(lib);
}

// DELETE /api/forms/field-library/[libFieldId]
// Only allowed if use_count === 0 (no forms are using it).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ libFieldId: string }> }
) {
  const { libFieldId } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized)    return errorResponse(ApiErrors.FORBIDDEN);

  // Safety: don't delete if still in use
  const { data: lib } = await supabase
    .from('form_field_library')
    .select('id, use_count, label')
    .eq('id', libFieldId)
    .single();

  if (!lib) return errorResponse(ApiErrors.NOT_FOUND);
  if (lib.use_count > 0) {
    return errorResponse(
      ApiErrors.CONFLICT,
      `Cannot delete — "${lib.label}" is used in ${lib.use_count} form(s). Remove it from those forms first.`
    );
  }

  const { error } = await supabase.from('form_field_library').delete().eq('id', libFieldId);
  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ id: libFieldId });
}
