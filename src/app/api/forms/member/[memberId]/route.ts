import { NextRequest } from 'next/server';
import {
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  supabase,
} from '@/lib/api/helpers';

// GET /api/forms/member/[memberId]
// Returns all forms assigned to the member, including their submitted response (if any).
// Admin can view any member; a member can only view their own.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

  const isAdminUser = ['super_admin', 'admin', 'trip_admin'].includes(profile.role);
  const isSelf = profile.id === memberId;

  if (!isAdminUser && !isSelf) return errorResponse(ApiErrors.FORBIDDEN);

  // Get assignments + form details
  const { data: assignments, error: assignErr } = await supabase
    .from('form_assignments')
    .select(`
      id,
      assigned_at,
      email_sent_at,
      forms(
        id, title, description, slug, token, status,
        submission_deadline, allow_multiple_submissions,
        trip_id,
        trips(id, name, slug)
      )
    `)
    .eq('member_id', memberId);

  if (assignErr) return errorResponse(ApiErrors.INTERNAL_ERROR, assignErr.message);

  // Get member's responses (with values) for those forms
  const formIds = (assignments || [])
    .map((a: { forms: { id: string } | null }) => a.forms?.id)
    .filter(Boolean) as string[];

  let responses: unknown[] = [];
  if (formIds.length > 0) {
    const { data: respData, error: respErr } = await supabase
      .from('form_responses')
      .select(`
        id, form_id, submitted_at, is_public,
        form_response_values(
          id, field_id, value_text, value_json,
          form_fields(id, label, field_type, sort_order)
        )
      `)
      .eq('member_id', memberId)
      .in('form_id', formIds);

    if (respErr) return errorResponse(ApiErrors.INTERNAL_ERROR, respErr.message);
    responses = respData || [];
  }

  // Merge: attach response (if any) to each assignment
  const result = (assignments || []).map((assignment: Record<string, unknown>) => {
    const form = assignment.forms as { id: string } | null;
    const response = responses.find(
      (r: unknown) => (r as { form_id: string }).form_id === form?.id
    ) || null;
    return { ...assignment, response };
  });

  return successResponse(result);
}
