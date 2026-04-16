import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  verifyRole,
  errorResponse,
  successResponse,
  ApiErrors,
  getJsonBody,
} from '@/lib/api/helpers';

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }
    _supabaseAdmin = createClient(_supabaseUrl, serviceRoleKey);
  }
  return _supabaseAdmin;
}

/**
 * POST /api/admin/members/reset-password
 * Body: { email: string }
 * Sends a password-reset email to the given member (admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, ['admin', 'super_admin']);
    if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
    if (!authorized) return errorResponse(ApiErrors.FORBIDDEN);

    const body = await getJsonBody(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) return errorResponse(ApiErrors.BAD_REQUEST, 'Email is required');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const redirectTo = `${siteUrl}/auth/callback?next=/reset-password`;

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
    }

    return successResponse({ message: `Password reset email sent to ${email}` });
  } catch (err) {
    return errorResponse(ApiErrors.INTERNAL_ERROR, err instanceof Error ? err.message : 'Unknown error');
  }
}
