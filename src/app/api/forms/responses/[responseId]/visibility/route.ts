import { NextRequest } from 'next/server';
import {
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
} from '@/lib/api/helpers';

// PATCH /api/forms/responses/[responseId]/visibility
// Lets a member toggle their own response's is_public flag.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const { responseId } = await params;
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

  const body = await getJsonBody(request);
  const { is_public } = body;
  if (typeof is_public !== 'boolean') {
    return errorResponse(ApiErrors.BAD_REQUEST, 'is_public (boolean) is required');
  }

  const isAdminUser = ['super_admin', 'admin', 'trip_admin'].includes(profile.role);

  // Verify ownership unless admin
  if (!isAdminUser) {
    const { data: existing } = await supabase
      .from('form_responses')
      .select('id, member_id')
      .eq('id', responseId)
      .single();

    if (!existing || existing.member_id !== profile.id) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }
  }

  const { data, error } = await supabase
    .from('form_responses')
    .update({ is_public })
    .eq('id', responseId)
    .select()
    .single();

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data);
}
