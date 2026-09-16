import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string; contactId: string }> };

// PUT /api/trips/[id]/contacts/[contactId]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, contactId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const { category, name, role, phone, email, notes, sort_order, member_visible } = body;

    const updateData: Record<string, unknown> = {};
    if (category !== undefined) updateData.category = category || 'general';
    if (name !== undefined) {
      if (!String(name).trim()) return errorResponse(ApiErrors.BAD_REQUEST, 'name cannot be empty');
      updateData.name = String(name).trim();
    }
    if (role !== undefined) updateData.role = role || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) updateData.email = email || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (member_visible !== undefined) updateData.member_visible = member_visible === true;

    if (Object.keys(updateData).length === 0) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'No update fields provided');
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('trip_contacts')
      .update(updateData)
      .eq('id', contactId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) throw error;

    return successResponse({ contact: data });
  } catch (err) {
    console.error('PUT trip contact error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// DELETE /api/trips/[id]/contacts/[contactId]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId, contactId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { error } = await supabase.from('trip_contacts').delete().eq('id', contactId).eq('trip_id', tripId);
    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (err) {
    console.error('DELETE trip contact error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
