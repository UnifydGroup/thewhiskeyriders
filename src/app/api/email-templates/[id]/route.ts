import { NextRequest } from 'next/server';
import {
  ApiErrors,
  errorResponse,
  getIpAddress,
  getJsonBody,
  logActivity,
  successResponse,
  supabase,
  verifyRole,
} from '@/lib/api/helpers';
import type { UserRole } from '@/lib/types/database';

// New table not yet in generated types — use untyped client until types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const TEMPLATE_ADMIN_ROLES: UserRole[] = ['trip_admin', 'admin', 'super_admin'];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

// GET /api/email-templates/[id]
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { authenticated, authorized } = await verifyRole(request, TEMPLATE_ADMIN_ROLES);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data, error } = await db
      .from('email_templates')
      .select(`
        id, name, description, subject, body,
        created_by, created_at, updated_at,
        creator:created_by (id, full_name, nickname)
      `)
      .eq('id', params.id)
      .single();

    if (error || !data) return errorResponse(ApiErrors.NOT_FOUND, 'Template not found');

    return successResponse(data);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// PUT /api/email-templates/[id] - Update a template
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { authenticated, authorized, user } = await verifyRole(request, TEMPLATE_ADMIN_ROLES);
    if (!authenticated || !user) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data: existing, error: existingError } = await db
      .from('email_templates')
      .select('id, name')
      .eq('id', params.id)
      .single();

    if (existingError || !existing) {
      return errorResponse(ApiErrors.NOT_FOUND, 'Template not found');
    }

    const body = await getJsonBody(request);
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return errorResponse(ApiErrors.BAD_REQUEST, 'name cannot be empty');
      updatePayload.name = name;
    }

    if (typeof body.description === 'string') {
      updatePayload.description = body.description.trim();
    }

    if (typeof body.subject === 'string') {
      const subject = body.subject.trim();
      if (!subject) return errorResponse(ApiErrors.BAD_REQUEST, 'subject cannot be empty');
      updatePayload.subject = subject;
    }

    if (typeof body.body === 'string') {
      const bodyContent = body.body.trim();
      if (!bodyContent) return errorResponse(ApiErrors.BAD_REQUEST, 'body cannot be empty');
      updatePayload.body = bodyContent;
    }

    if (Object.keys(updatePayload).length === 0) {
      return errorResponse(ApiErrors.BAD_REQUEST, 'No fields to update');
    }

    const { error: updateError } = await db
      .from('email_templates')
      .update(updatePayload)
      .eq('id', params.id);

    if (updateError) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, updateError.message);
    }

    await logActivity(
      user.id,
      'update',
      'email_template',
      params.id,
      existing.name,
      { updated_fields: Object.keys(updatePayload) },
      getIpAddress(request)
    );

    // Return the updated template
    const { data: updated } = await db
      .from('email_templates')
      .select(`
        id, name, description, subject, body,
        created_by, created_at, updated_at,
        creator:created_by (id, full_name, nickname)
      `)
      .eq('id', params.id)
      .single();

    return successResponse(updated);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// DELETE /api/email-templates/[id]
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { authenticated, authorized, user } = await verifyRole(request, TEMPLATE_ADMIN_ROLES);
    if (!authenticated || !user) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data: existing } = await db
      .from('email_templates')
      .select('id, name')
      .eq('id', params.id)
      .single();

    const { error } = await db
      .from('email_templates')
      .delete()
      .eq('id', params.id);

    if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);

    await logActivity(
      user.id,
      'delete',
      'email_template',
      params.id,
      existing?.name || null,
      null,
      getIpAddress(request)
    );

    return successResponse({ id: params.id });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
