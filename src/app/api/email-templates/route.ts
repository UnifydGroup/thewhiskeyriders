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

// GET /api/email-templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, TEMPLATE_ADMIN_ROLES);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const { data, error } = await db
      .from('email_templates')
      .select(`
        id,
        name,
        description,
        subject,
        body,
        created_by,
        created_at,
        updated_at,
        creator:created_by (
          id,
          full_name,
          nickname
        )
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    return successResponse({ templates: data || [] });
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}

// POST /api/email-templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const { authenticated, authorized, user } = await verifyRole(request, TEMPLATE_ADMIN_ROLES);
    if (!authenticated || !user) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const bodyContent = typeof body.body === 'string' ? body.body.trim() : '';

    if (!name) return errorResponse(ApiErrors.BAD_REQUEST, 'name is required');
    if (!subject) return errorResponse(ApiErrors.BAD_REQUEST, 'subject is required');
    if (!bodyContent) return errorResponse(ApiErrors.BAD_REQUEST, 'body is required');

    const { data: created, error: createError } = await db
      .from('email_templates')
      .insert({
        name,
        description,
        subject,
        body: bodyContent,
        created_by: user.id,
      })
      .select('id, name')
      .single();

    if (createError || !created) {
      return errorResponse(
        ApiErrors.INTERNAL_ERROR,
        createError?.message || 'Failed to create template'
      );
    }

    await logActivity(
      user.id,
      'create',
      'email_template',
      created.id,
      created.name,
      null,
      getIpAddress(request)
    );

    return successResponse({ id: created.id }, 201);
  } catch (error: unknown) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, getErrorMessage(error));
  }
}
