import { NextRequest } from 'next/server';
import {
  verifyRole,
  verifyAuth,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
  supabase,
} from '@/lib/api/helpers';

// GET /api/forms/field-library
// Returns all library fields. Optionally filter by ?search=&category=
// Available to all authenticated users (needed when building/completing forms).
export async function GET(request: NextRequest) {
  const { authenticated } = await verifyAuth(request);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);

  const search   = request.nextUrl.searchParams.get('search')?.trim() || '';
  const category = request.nextUrl.searchParams.get('category')?.trim() || '';

  let query = supabase
    .from('form_field_library')
    .select('*')
    .order('use_count', { ascending: false })
    .order('label');

  if (search) {
    query = query.ilike('label', `%${search}%`);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data);
}

// POST /api/forms/field-library
// Create a new library field (admin only).
export async function POST(request: NextRequest) {
  const { authenticated, authorized, profile } = await verifyRole(request, [
    'super_admin', 'admin', 'trip_admin',
  ]);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  if (!authorized)    return errorResponse(ApiErrors.FORBIDDEN);

  const body = await getJsonBody(request);
  const {
    field_type, label, description, placeholder,
    helper_text, options, settings, category,
  } = body;

  if (!field_type || !label?.trim()) {
    return errorResponse(ApiErrors.BAD_REQUEST, 'field_type and label are required');
  }

  const { data, error } = await supabase
    .from('form_field_library')
    .insert({
      field_type,
      label:       label.trim(),
      description: description?.trim() || null,
      placeholder: placeholder?.trim() || null,
      helper_text: helper_text?.trim() || null,
      options:     options || null,
      settings:    settings || null,
      category:    category?.trim() || null,
      created_by:  profile.id,
    })
    .select()
    .single();

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse(data, 201);
}
