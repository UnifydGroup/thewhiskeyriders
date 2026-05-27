import { NextRequest } from 'next/server';
import { supabase, errorResponse, successResponse, ApiErrors } from '@/lib/api/helpers';

// GET /api/forms/[token]/public
// Resolves a form by its public token (no auth required).
// Returns form metadata + fields — but NOT responses.
// Respects goes_live_at: if set and in the future, returns a special "scheduled" error
// so the member-facing page can show a countdown rather than a generic 403.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: token } = await params;

  const { data: form, error } = await supabase
    .from('forms')
    .select(`
      id, title, description, token, status,
      submission_deadline, goes_live_at, show_countdown,
      allow_multiple_submissions,
      trips(id, name, slug),
      form_fields(
        id, field_type, label, placeholder, helper_text,
        is_required, sort_order, options, settings
      )
    `)
    .eq('token', token)
    .single();

  if (error || !form) return errorResponse(ApiErrors.NOT_FOUND, 'Form not found');

  const now = new Date();

  // Not yet open — return form metadata so the client can show a countdown
  if (form.goes_live_at && new Date(form.goes_live_at) > now) {
    return successResponse({
      id:             form.id,
      title:          form.title,
      description:    form.description,
      status:         'scheduled',
      goes_live_at:   form.goes_live_at,
      show_countdown: form.show_countdown,
      form_fields:    [],
    });
  }

  // Closed — status column or submission deadline passed
  if (form.status === 'closed') {
    return errorResponse(ApiErrors.FORBIDDEN, 'This form is no longer accepting submissions');
  }
  if (form.submission_deadline && new Date(form.submission_deadline) < now) {
    return errorResponse(ApiErrors.FORBIDDEN, 'The submission deadline has passed');
  }

  // Not active and no goes_live_at scheduling — simply not available
  if (form.status !== 'active') {
    return errorResponse(ApiErrors.FORBIDDEN, 'This form is not currently accepting submissions');
  }

  // Sort fields
  if (form.form_fields) {
    form.form_fields.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    );
  }

  return successResponse(form);
}
