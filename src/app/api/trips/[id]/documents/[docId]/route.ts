import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  logActivity,
  getIpAddress,
  supabase,
  getCurrentUser,
  getUserProfile,
  isUserTripMember,
} from '@/lib/api/helpers';

type Params = Promise<{ id: string; docId: string }>;

// PUT /api/trips/[id]/documents/[docId] - Update document
export async function PUT(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const { id: tripId, docId } = params;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { data: doc } = await supabase
      .from('trip_documents')
      .select('*')
      .eq('id', docId)
      .eq('trip_id', tripId)
      .single();

    if (!doc) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Document not found');
    }

    // Only admin or document uploader can update
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
    const isUploader = doc.uploaded_by === user.id;

    if (!isAdmin && !isUploader) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name;

    const { data: updated, error } = await supabase
      .from('trip_documents')
      .update(updateData)
      .eq('id', docId)
      .select()
      .single();

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'update',
      'document',
      docId,
      updated.name,
      updateData,
      getIpAddress(request)
    );

    return successResponse(updated);
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}

// DELETE /api/trips/[id]/documents/[docId] - Delete document
export async function DELETE(request: NextRequest, props: { params: Params }) {
  try {
    const params = await props.params;
    const { id: tripId, docId } = params;

    const user = await getCurrentUser(request);
    if (!user) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    const { data: doc } = await supabase
      .from('trip_documents')
      .select('*')
      .eq('id', docId)
      .eq('trip_id', tripId)
      .single();

    if (!doc) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Document not found');
    }

    // Only admin or document uploader can delete
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
    const isUploader = doc.uploaded_by === user.id;

    if (!isAdmin && !isUploader) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const { error } = await supabase.from('trip_documents').delete().eq('id', docId);

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    // Log activity
    await logActivity(
      user.id,
      'delete',
      'document',
      docId,
      doc.name,
      null,
      getIpAddress(request)
    );

    return successResponse({ message: 'Document deleted successfully' });
  } catch (error: any) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  }
}
