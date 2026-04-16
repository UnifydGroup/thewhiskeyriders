import { NextRequest, NextResponse } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, getJsonBody, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/budget/settings
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated } = await verifyRole(request, ['member', 'trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

    const { data, error } = await supabase
      .from('trip_budget_settings')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (error) throw error;

    // Return defaults if no row exists yet
    const settings = data ?? {
      trip_id: tripId,
      total_budget_aud: 0,
      show_group_budget_to_members: true,
      show_individual_breakdown_to_members: true,
      exchange_rate_mad_aud: 0.14,
      notes: null,
    };

    return successResponse(settings);
  } catch (err) {
    console.error('GET budget/settings error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}

// PUT /api/trips/[id]/budget/settings
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['trip_admin', 'admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const {
      total_budget_aud,
      show_group_budget_to_members,
      show_individual_breakdown_to_members,
      exchange_rate_mad_aud,
      notes,
    } = body;

    // Upsert — creates the row if it doesn't exist
    const { data, error } = await supabase
      .from('trip_budget_settings')
      .upsert(
        {
          trip_id: tripId,
          ...(total_budget_aud !== undefined && { total_budget_aud }),
          ...(show_group_budget_to_members !== undefined && { show_group_budget_to_members }),
          ...(show_individual_breakdown_to_members !== undefined && { show_individual_breakdown_to_members }),
          ...(exchange_rate_mad_aud !== undefined && { exchange_rate_mad_aud }),
          ...(notes !== undefined && { notes }),
        },
        { onConflict: 'trip_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return successResponse(data);
  } catch (err) {
    console.error('PUT budget/settings error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
