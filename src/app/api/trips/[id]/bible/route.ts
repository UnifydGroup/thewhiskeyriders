import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, isUserTripMember } from '@/lib/api/helpers';
import { getTripBibleData } from '@/lib/api/tripBible';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/bible
// Aggregates everything the Trip Bible surfaces: itinerary, key contacts,
// documents, and (admin only) expense receipts.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, user, profile } = await verifyRole(request, [
      'member',
      'trip_admin',
      'admin',
      'super_admin',
    ]);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

    const isAdmin = ['admin', 'super_admin', 'trip_admin'].includes(profile?.role ?? '');

    if (!isAdmin) {
      const isMember = await isUserTripMember(user!.id, tripId);
      if (!isMember) return errorResponse(ApiErrors.FORBIDDEN);
    }

    const data = await getTripBibleData(tripId, isAdmin, user!.id);

    return successResponse({
      trip: data.trip,
      is_admin: data.isAdmin,
      itinerary: data.itinerary,
      contacts: data.contacts,
      documents: data.documents,
      expense_receipts: data.expenseReceipts,
      members: data.members,
      member_fields: data.memberFields,
    });
  } catch (err) {
    console.error('GET trip bible error:', err);
    if (err instanceof Error && err.message === 'Trip not found') {
      return errorResponse(ApiErrors.NOT_FOUND, 'Trip not found');
    }
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
