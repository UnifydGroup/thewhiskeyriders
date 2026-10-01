import { NextRequest } from 'next/server';
import {
  verifyAuth,
  errorResponse,
  successResponse,
  getJsonBody,
  ApiErrors,
  supabase,
} from '@/lib/api/helpers';
import { NOTIFICATION_CATEGORIES, normalizePreferences } from '@/lib/notifications/types';

// GET /api/notifications/preferences — which categories the member receives
export async function GET(request: NextRequest) {
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated || !profile) return errorResponse(ApiErrors.UNAUTHORIZED);

  return successResponse({ preferences: normalizePreferences(profile.notification_preferences) });
}

// PUT /api/notifications/preferences — body: { badges?: boolean, tags?: boolean, ... }
export async function PUT(request: NextRequest) {
  const { authenticated, profile } = await verifyAuth(request);
  if (!authenticated || !profile) return errorResponse(ApiErrors.UNAUTHORIZED);

  let body: Record<string, unknown>;
  try {
    body = await getJsonBody(request);
  } catch {
    return errorResponse(ApiErrors.BAD_REQUEST, 'Invalid request body');
  }

  const next = normalizePreferences(profile.notification_preferences);
  for (const { key } of NOTIFICATION_CATEGORIES) {
    if (typeof body[key] === 'boolean') next[key] = body[key] as boolean;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ notification_preferences: next })
    .eq('id', profile.id);

  if (error) return errorResponse(ApiErrors.INTERNAL_ERROR, error.message);
  return successResponse({ preferences: next });
}
