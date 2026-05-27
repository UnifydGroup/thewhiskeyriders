import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  supabase,
} from '@/lib/api/helpers';

/**
 * GET /api/admin/members/export
 *
 * Query params:
 *   ids        — comma-separated profile IDs to export (omit = all active members)
 *   include    — comma-separated list of extra sheets to include:
 *                trips, form_responses, payments (default: all)
 *
 * Returns structured JSON ready for xlsx generation:
 * {
 *   generated_at: string,
 *   profiles: ProfileRow[],
 *   trips: TripRow[],
 *   form_responses: FormResponseRow[],
 *   payments: PaymentRow[],
 * }
 */
export async function GET(request: NextRequest) {
  const { authenticated, authorized } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized)    return errorResponse(ApiErrors.FORBIDDEN);

  const idsParam     = request.nextUrl.searchParams.get('ids') || '';
  const includeParam = request.nextUrl.searchParams.get('include') || 'trips,form_responses,payments';
  const include      = includeParam.split(',').map(s => s.trim());

  // ── 1. Profiles ──────────────────────────────────────────────
  let profileQuery = supabase
    .from('profiles')
    .select('*')
    .order('surname', { ascending: true })
    .order('first_name', { ascending: true });

  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    profileQuery = profileQuery.in('id', ids);
  } else {
    profileQuery = profileQuery.eq('status', 'active');
  }

  const { data: profiles, error: profileErr } = await profileQuery;
  if (profileErr) return errorResponse(ApiErrors.INTERNAL_ERROR, profileErr.message);
  if (!profiles?.length) return successResponse({ generated_at: new Date().toISOString(), profiles: [], trips: [], form_responses: [], payments: [] });

  const memberIds = profiles.map((p: { id: string }) => p.id);

  // ── 2. Trips ─────────────────────────────────────────────────
  let tripsData: unknown[] = [];
  if (include.includes('trips')) {
    const { data, error } = await supabase
      .from('trip_members')
      .select(`
        member_id,
        trip_role,
        joined_at,
        trips!inner(
          id, name, destination, country, start_date, end_date, status
        )
      `)
      .in('member_id', memberIds)
      .order('joined_at', { ascending: false });

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    tripsData = (data || []).map((row: any) => ({
      member_id:   row.member_id,
      trip_role:   row.trip_role,
      joined_at:   row.joined_at,
      trip_name:   row.trips?.name,
      destination: row.trips?.destination,
      country:     row.trips?.country,
      start_date:  row.trips?.start_date,
      end_date:    row.trips?.end_date,
      trip_status: row.trips?.status,
    }));
  }

  // ── 3. Form responses ────────────────────────────────────────
  let formResponsesData: unknown[] = [];
  if (include.includes('form_responses')) {
    const { data, error } = await supabase
      .from('form_responses')
      .select(`
        id,
        member_id,
        submitted_at,
        is_public,
        forms!inner(id, title),
        form_response_values(
          value_text,
          value_json,
          form_fields(label, field_type, sort_order, library_field_id)
        )
      `)
      .in('member_id', memberIds)
      .order('submitted_at', { ascending: false });

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);

    // Flatten to one row per field answer (easier to put in a sheet)
    const rows: unknown[] = [];
    for (const resp of (data || []) as any[]) {
      const values: any[] = resp.form_response_values || [];
      const sorted = [...values].sort((a, b) =>
        (a.form_fields?.sort_order ?? 0) - (b.form_fields?.sort_order ?? 0)
      );
      for (const val of sorted) {
        if (val.form_fields?.field_type === 'section_header') continue;
        rows.push({
          member_id:    resp.member_id,
          form_title:   resp.forms?.title,
          field_label:  val.form_fields?.label,
          field_type:   val.form_fields?.field_type,
          library_linked: !!val.form_fields?.library_field_id,
          response:     val.value_json != null
            ? (Array.isArray(val.value_json) ? (val.value_json as string[]).join(', ') : JSON.stringify(val.value_json))
            : (val.value_text ?? ''),
          submitted_at: resp.submitted_at,
          is_public:    resp.is_public,
        });
      }
    }
    formResponsesData = rows;
  }

  // ── 4. Payments ──────────────────────────────────────────────
  let paymentsData: unknown[] = [];
  if (include.includes('payments')) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        member_id,
        amount,
        status,
        due_date,
        paid_date,
        notes,
        trips!inner(name)
      `)
      .in('member_id', memberIds)
      .order('due_date', { ascending: true });

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    paymentsData = (data || []).map((row: any) => ({
      member_id:  row.member_id,
      trip_name:  row.trips?.name,
      amount:     row.amount,
      status:     row.status,
      due_date:   row.due_date,
      paid_date:  row.paid_date,
      notes:      row.notes,
    }));
  }

  return successResponse({
    generated_at:   new Date().toISOString(),
    profiles:       profiles,
    trips:          tripsData,
    form_responses: formResponsesData,
    payments:       paymentsData,
  });
}
