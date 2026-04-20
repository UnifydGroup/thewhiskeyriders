import { NextRequest } from 'next/server';
import { verifyRole, errorResponse, successResponse, ApiErrors, supabase } from '@/lib/api/helpers';

type Params = { params: Promise<{ id: string }> };

// DELETE /api/trips/[id]/budget/all
// Deletes ALL trip_expenses and trip_income_entries for a trip (super_admin / admin only).
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const { authenticated, authorized } = await verifyRole(request, ['admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    // Count before deleting so we can report back
    const [{ count: expCount }, { count: incCount }] = await Promise.all([
      supabase
        .from('trip_expenses')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .then((r) => ({ count: r.count ?? 0 })),
      supabase
        .from('trip_income_entries')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .then((r) => ({ count: r.count ?? 0 })),
    ]);

    const [expResult, incResult] = await Promise.all([
      supabase.from('trip_expenses').delete().eq('trip_id', tripId),
      supabase.from('trip_income_entries').delete().eq('trip_id', tripId),
    ]);

    if (expResult.error) throw expResult.error;
    if (incResult.error) throw incResult.error;

    return successResponse({
      deleted: {
        expenses: expCount,
        income_entries: incCount,
        total: expCount + incCount,
      },
      message: `Deleted ${expCount} expense(s) and ${incCount} income entry/entries.`,
    });
  } catch (err) {
    console.error('DELETE budget/all error:', err);
    return errorResponse(ApiErrors.INTERNAL_ERROR);
  }
}
