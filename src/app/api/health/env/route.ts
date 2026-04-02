import { NextRequest } from 'next/server';
import { ApiErrors, errorResponse, successResponse, verifyRole } from '@/lib/api/helpers';

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function hasNonEmptyValue(name: string): boolean {
  return (process.env[name] || '').trim().length > 0;
}

// GET /api/health/env - Admin-only environment sanity check (no secret values returned)
export async function GET(request: NextRequest) {
  try {
    const { authenticated, authorized } = await verifyRole(request, ['admin', 'super_admin']);

    if (!authenticated) {
      return errorResponse(ApiErrors.UNAUTHORIZED);
    }

    if (!authorized) {
      return errorResponse(ApiErrors.FORBIDDEN);
    }

    const envStatus = REQUIRED_ENV_VARS.map((name) => ({
      name,
      configured: hasNonEmptyValue(name),
    }));

    const allRequiredConfigured = envStatus.every((item) => item.configured);

    return successResponse({
      allRequiredConfigured,
      required: envStatus,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return errorResponse(
      ApiErrors.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
}
