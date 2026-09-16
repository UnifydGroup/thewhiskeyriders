import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { verifyRole, errorResponse, ApiErrors, isUserTripMember } from '@/lib/api/helpers';
import { getTripBibleData } from '@/lib/api/tripBible';
import TripBibleDocument from '@/lib/pdf/TripBibleDocument';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function slugifyFileName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'trip';
}

// GET /api/trips/[id]/bible/pdf
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
    const buffer = await renderToBuffer(TripBibleDocument({ data }));

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slugifyFileName(data.trip.name)}-trip-bible.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('GET trip bible pdf error:', err);
    if (err instanceof Error && err.message === 'Trip not found') {
      return errorResponse(ApiErrors.NOT_FOUND, 'Trip not found');
    }
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
