import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  supabase,
} from '@/lib/api/helpers';

// GET /api/forms/[id]/responses — admin view of all responses with values
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const { data, error } = await supabase
    .from('form_responses')
    .select(`
      *,
      member:profiles!form_responses_member_id_fkey(id, full_name, first_name, surname, avatar_url, email),
      form_response_values(*, form_fields(id, label, field_type, sort_order))
    `)
    .eq('form_id', id)
    .order('submitted_at', { ascending: false });

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data);
}
