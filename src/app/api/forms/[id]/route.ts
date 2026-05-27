import { NextRequest } from 'next/server';
import {
  verifyRole,
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
} from '@/lib/api/helpers';

// GET /api/forms/[id] — get form with fields
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

  const isAdminUser = ['super_admin', 'admin', 'trip_admin'].includes(profile.role);

  // Admins can read any form; members only active assigned forms
  const { data: form, error } = await supabase
    .from('forms')
    .select(`*, trips(id, name, slug), form_fields(*)`)
    .eq('id', id)
    .single();

  if (error || !form) return errorResponse(ApiErrors.NOT_FOUND);

  if (!isAdminUser) {
    if (form.status !== 'active') return errorResponse(ApiErrors.FORBIDDEN);
    // Check assignment
    const { data: assignment } = await supabase
      .from('form_assignments')
      .select('id')
      .eq('form_id', id)
      .eq('member_id', profile.id)
      .maybeSingle();
    if (!assignment) return errorResponse(ApiErrors.FORBIDDEN);
  }

  // Sort fields by sort_order
  if (form.form_fields) {
    form.form_fields.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
  }

  return successResponse(form);
}

// PUT /api/forms/[id] — update form (admin only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  const { title, description, status, trip_id, allow_multiple_submissions, submission_deadline, notify_on_submission } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (status !== undefined) updates.status = status;
  if (trip_id !== undefined) updates.trip_id = trip_id || null;
  if (allow_multiple_submissions !== undefined) updates.allow_multiple_submissions = allow_multiple_submissions;
  if (submission_deadline !== undefined) updates.submission_deadline = submission_deadline || null;
  if (notify_on_submission !== undefined) updates.notify_on_submission = notify_on_submission;

  const { data, error } = await supabase
    .from('forms')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  if (!data) return errorResponse(ApiErrors.NOT_FOUND);
  return successResponse(data);
}

// DELETE /api/forms/[id] — delete form (admin only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized } = await verifyRole(request, ['super_admin', 'admin']);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const { error } = await supabase.from('forms').delete().eq('id', id);
  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ id });
}
