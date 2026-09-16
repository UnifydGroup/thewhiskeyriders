import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

const FIELD_KEYS = ['first_name', 'surname', 'email', 'phone'] as const;

// PATCH /api/trips/[id]/bible/settings
// Controls which profile fields show for trip members in the Trip Bible's Key Contacts section.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const fields = body.bible_member_fields;

    if (!fields || typeof fields !== 'object') {
      return errorResponse(ApiErrors.BAD_REQUEST, 'bible_member_fields object is required');
    }

    const sanitized: Record<string, boolean> = {};
    for (const key of FIELD_KEYS) {
      sanitized[key] = fields[key] === true;
    }

    const { data, error } = await supabase
      .from('trips')
      .update({ bible_member_fields: sanitized, updated_at: new Date().toISOString() })
      .eq('id', tripId)
      .select('id, bible_member_fields')
      .single();

    if (error) throw error;

    return successResponse({ bible_member_fields: data.bible_member_fields });
  } catch (err) {
    console.error('PATCH bible settings error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
