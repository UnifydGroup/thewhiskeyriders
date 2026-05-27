import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  generateSlug,
  supabase,
} from '@/lib/api/helpers';

// GET /api/forms — admin: all forms; member: forms assigned to them
export async function GET(request: NextRequest) {
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin', 'member',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const isAdminUser = ['super_admin', 'admin', 'trip_admin'].includes(profile.role);

  if (isAdminUser) {
    const { data, error } = await supabase
      .from('forms')
      .select(`
        *,
        trips(id, name, slug),
        creator:profiles!forms_created_by_fkey(id, full_name, first_name, surname),
        form_assignments(count),
        form_responses(count)
      `)
      .order('created_at', { ascending: false });

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    return successResponse(data);
  }

  // Member: only their assigned active forms
  const { data, error } = await supabase
    .from('form_assignments')
    .select(`
      id,
      assigned_at,
      email_sent_at,
      forms!inner(
        id, title, description, slug, token, status,
        submission_deadline, trip_id,
        trips(id, name, slug)
      )
    `)
    .eq('member_id', profile.id)
    .eq('forms.status', 'active');

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data);
}

// POST /api/forms — create a new form (admin only)
export async function POST(request: NextRequest) {
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  const { title, description, trip_id, allow_multiple_submissions, submission_deadline, notify_on_submission } = body;

  if (!title?.trim()) return errorResponse(ApiErrors.BAD_REQUEST, 'Title is required');

  // Generate a unique slug
  let baseSlug = generateSlug(title);
  if (!baseSlug) baseSlug = 'form';
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const { data: existing } = await supabase.from('forms').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const { data, error } = await supabase
    .from('forms')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      slug,
      trip_id: trip_id || null,
      status: 'draft',
      allow_multiple_submissions: allow_multiple_submissions ?? false,
      submission_deadline: submission_deadline || null,
      notify_on_submission: notify_on_submission ?? true,
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data, 201);
}
