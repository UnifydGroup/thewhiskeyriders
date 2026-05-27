import { NextRequest } from 'next/server';
import { supabase, errorResponse, successResponse, ApiErrors } from '@/lib/api/helpers';

// GET /api/forms/[token]/public
// Resolves a form by its public token (no auth required).
// Returns form metadata + fields — but NOT responses.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: token } = await params;

  const { data: form, error } = await supabase
    .from('forms')
    .select(`
      id, title, description, token, status,
      submission_deadline, allow_multiple_submissions,
      trips(id, name, slug),
      form_fields(
        id, field_type, label, placeholder, helper_text,
        is_required, sort_order, options, settings
      )
    `)
    .eq('token', token)
    .single();

  if (error || !form) return errorResponse(ApiErrors.NOT_FOUND, 'Form not found');
  if (form.status !== 'active') return errorResponse(ApiErrors.FORBIDDEN, 'This form is not accepting submissions');
  if (form.submission_deadline && new Date(form.submission_deadline) < new Date()) {
    return errorResponse(ApiErrors.FORBIDDEN, 'The submission deadline has passed');
  }

  // Sort fields
  if (form.form_fields) {
    form.form_fields.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
  }

  return successResponse(form);
}
