import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
} from '@/lib/api/helpers';

// GET /api/forms/[id]/assign — list assignments for a form
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const { data, error } = await supabase
    .from('form_assignments')
    .select(`
      *,
      member:profiles!form_assignments_member_id_fkey(id, full_name, first_name, surname, avatar_url, email),
      form_responses(id, submitted_at, is_public)
    `)
    .eq('form_id', id)
    .order('assigned_at', { ascending: false });

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data);
}

// POST /api/forms/[id]/assign — assign form to one or more members
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  // member_ids: string[] | 'all'
  const { member_ids } = body;

  let targetMemberIds: string[] = [];
  if (member_ids === 'all') {
    const { data: allMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('status', 'active');
    targetMemberIds = (allMembers || []).map((m: { id: string }) => m.id);
  } else if (Array.isArray(member_ids)) {
    targetMemberIds = member_ids;
  } else {
    return errorResponse(ApiErrors.BAD_REQUEST, 'member_ids must be an array or "all"');
  }

  if (!targetMemberIds.length) return successResponse({ assigned: 0 });

  const rows = targetMemberIds.map((memberId: string) => ({
    form_id: id,
    member_id: memberId,
    assigned_by: profile.id,
  }));

  // Upsert to avoid duplicate-key errors for already-assigned members
  const { data, error } = await supabase
    .from('form_assignments')
    .upsert(rows, { onConflict: 'form_id,member_id', ignoreDuplicates: true })
    .select();

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ assigned: data?.length ?? 0 }, 201);
}

// DELETE /api/forms/[id]/assign — remove assignment(s)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  const { member_ids } = body;
  if (!Array.isArray(member_ids) || !member_ids.length) {
    return errorResponse(ApiErrors.BAD_REQUEST, 'member_ids array required');
  }

  const { error } = await supabase
    .from('form_assignments')
    .delete()
    .eq('form_id', id)
    .in('member_id', member_ids);

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ removed: member_ids.length });
}
