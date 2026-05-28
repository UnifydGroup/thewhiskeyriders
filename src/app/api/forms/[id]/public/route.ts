import { NextRequest } from 'next/server';
import { supabase, errorResponse, successResponse, ApiErrors } from '@/lib/api/helpers';

// GET /api/forms/[token]/public
// Resolves a form by its public token (no auth required).
// Returns form metadata + fields — but NOT responses.
// Each field includes profiles_column (from library settings) so the member
// form page can pre-fill existing profile data and detect changes.
// Respects goes_live_at: if set and in the future, returns a special "scheduled"
// payload so the member-facing page can show a countdown rather than a 403.
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
      allow_multiple_submissions, require_email_verification,
      trips(id, name, slug),
      form_fields(
        id, field_type, label, placeholder, helper_text,
        is_required, sort_order, options, settings,
        library_field:form_field_library(settings)
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

  // Accept: status=active, OR scheduled form where goes_live_at has passed
  const isScheduledAndLive = form.goes_live_at && new Date(form.goes_live_at) <= now;
  if (form.status !== 'active' && !isScheduledAndLive) {
    return errorResponse(ApiErrors.FORBIDDEN, 'This form is not currently accepting submissions');
  }

  // Sort fields and attach profiles_column from library settings
  type RawField = {
    sort_order: number;
    library_field?: { settings?: Record<string, unknown> | null } | null;
    [key: string]: unknown;
  };

  const fields: RawField[] = ((form.form_fields || []) as RawField[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => {
      const { library_field, ...rest } = f;
      const profiles_column =
        (library_field?.settings as Record<string, unknown> | null)?.profiles_column ?? null;
      return { ...rest, profiles_column };
    });

  return successResponse({ ...form, form_fields: fields });
}
