import { NextRequest } from 'next/server';
import {
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  getIpAddress,
  supabase,
} from '@/lib/api/helpers';

// POST /api/forms/submit/[token] — public/member form submission
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Resolve form by token
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('id, status, allow_multiple_submissions, submission_deadline, form_fields(*)')
    .eq('token', token)
    .single();

  if (formError || !form) return errorResponse(ApiErrors.NOT_FOUND, 'Form not found');
  if (form.status !== 'active') return errorResponse(ApiErrors.FORBIDDEN, 'This form is not currently accepting submissions');
  if (form.submission_deadline && new Date(form.submission_deadline) < new Date()) {
    return errorResponse(ApiErrors.FORBIDDEN, 'The submission deadline has passed');
  }

  // Identify member if authenticated
  const { authenticated, profile } = await verifyAuth(request);
  const memberId = authenticated && profile ? profile.id : null;

  // Check for existing submission if duplicates not allowed
  if (!form.allow_multiple_submissions && memberId) {
    const { data: existing } = await supabase
      .from('form_responses')
      .select('id')
      .eq('form_id', form.id)
      .eq('member_id', memberId)
      .maybeSingle();
    if (existing) {
      return errorResponse(ApiErrors.CONFLICT, 'You have already submitted this form');
    }
  }

  const body = await getJsonBody(request);
  // values: { [fieldId]: string | string[] | null }
  const { values } = body;
  if (!values || typeof values !== 'object') {
    return errorResponse(ApiErrors.BAD_REQUEST, 'values object is required');
  }

  // Validate required fields
  const fields: Array<{ id: string; is_required: boolean; field_type: string }> = form.form_fields || [];
  const layoutOnlyTypes = ['section_header'];
  for (const field of fields) {
    if (field.is_required && !layoutOnlyTypes.includes(field.field_type)) {
      const val = values[field.id];
      const isEmpty = val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        return errorResponse(ApiErrors.BAD_REQUEST, `Required field missing: ${field.id}`);
      }
    }
  }

  // Insert response
  const { data: response, error: respError } = await supabase
    .from('form_responses')
    .insert({
      form_id: form.id,
      member_id: memberId,
      is_public: false,
      ip_address: getIpAddress(request),
    })
    .select()
    .single();

  if (respError) return errorResponse(ApiErrors.INTERNAL_ERROR, respError.message);

  // Insert values
  const valueRows = Object.entries(values).map(([fieldId, val]) => {
    const isJson = Array.isArray(val) || (typeof val === 'object' && val !== null);
    return {
      response_id: response.id,
      field_id: fieldId,
      value_text: isJson ? null : String(val ?? ''),
      value_json: isJson ? val : null,
    };
  });

  if (valueRows.length > 0) {
    const { error: valError } = await supabase.from('form_response_values').insert(valueRows);
    if (valError) return errorResponse(ApiErrors.INTERNAL_ERROR, valError.message);
  }

  return successResponse({ response_id: response.id }, 201);
}
