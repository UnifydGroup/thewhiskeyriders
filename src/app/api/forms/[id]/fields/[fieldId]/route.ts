import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
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

  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label.trim();
  if (placeholder !== undefined) updates.placeholder = placeholder?.trim() || null;
  if (helper_text !== undefined) updates.helper_text = helper_text?.trim() || null;
  if (is_required !== undefined) updates.is_required = is_required;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (options !== undefined) updates.options = options;
  if (settings !== undefined) updates.settings = settings;

  const { data, error } = await supabase
    .from('form_fields')
    .update(updates)
    .eq('id', fieldId)
    .eq('form_id', id)
    .select()
    .single();

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  if (!data) return errorResponse(ApiErrors.NOT_FOUND);
  return successResponse(data);
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
