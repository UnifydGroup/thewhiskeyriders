import { NextRequest } from 'next/server';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  generateSlug,
  supabase,
} from '@/lib/api/helpers';

// POST /api/forms/[id]/duplicate — clone a form and all its fields
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

  // ── Fetch original form + its fields ─────────────────────────
  const { data: original, error: fetchErr } = await supabase
    .from('forms')
    .select('*, form_fields(*)')
    .eq('id', id)
    .single();

  if (fetchErr || !original) return errorResponse(ApiErrors.NOT_FOUND, 'Source form not found');

  // ── Generate unique slug for copy ─────────────────────────────
  const baseTitle = `Copy of ${original.title}`;
  let baseSlug = generateSlug(baseTitle);
  if (!baseSlug) baseSlug = 'form-copy';
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const { data: existing } = await supabase.from('forms').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  // ── Create new form (draft, no scheduling dates carried over) ─
  const { data: newForm, error: insertErr } = await supabase
    .from('forms')
    .insert({
      title: baseTitle,
      description: original.description,
      slug,
      trip_id: original.trip_id || null,
      status: 'draft',
      allow_multiple_submissions: original.allow_multiple_submissions,
      notify_on_submission: original.notify_on_submission,
      show_countdown: original.show_countdown,
      // goes_live_at and submission_deadline intentionally omitted — blank slate
      created_by: profile.id,
    })
    .select()
    .single();

  if (insertErr || !newForm) return errorResponse(ApiErrors.INTERNAL_ERROR, insertErr?.message || 'Failed to create copy');

  // ── Clone all fields (preserve sort order + library links) ────
  const sourceFields: Array<Record<string, unknown>> = original.form_fields || [];
  if (sourceFields.length > 0) {
    const fieldCopies = sourceFields.map((f) => ({
      form_id:         newForm.id,
      library_field_id: f.library_field_id || null,
      field_type:       f.field_type,
      label:            f.label,
      placeholder:      f.placeholder || null,
      helper_text:      f.helper_text || null,
      is_required:      f.is_required ?? false,
      sort_order:       f.sort_order ?? 0,
      options:          f.options || null,
      settings:         f.settings || null,
    }));

    const { error: fieldsErr } = await supabase.from('form_fields').insert(fieldCopies);
    if (fieldsErr) {
      // Clean up the created form if fields failed
      await supabase.from('forms').delete().eq('id', newForm.id);
      return errorResponse(ApiErrors.INTERNAL_ERROR, `Failed to copy fields: ${fieldsErr.message}`);
    }
  }

  return successResponse(newForm, 201);
}
