import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { UserRole, ActivityAction } from '@/lib/types/database';
import type { SupabaseDatabase } from '@/lib/types/database.generated';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function getEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

// Lazy singleton — not created at module load time so build succeeds without env vars
let _supabase: ReturnType<typeof createClient<SupabaseDatabase>> | null = null;
function getSupabase() {
  if (!_supabase) {
    const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const key = serviceRoleKey || anonKey;
    if (!url || !key) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL and at least one of SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    }
    _supabase = createClient<SupabaseDatabase>(
      url,
      key
    );
  }
  return _supabase;
}
const supabase = new Proxy({} as ReturnType<typeof createClient<SupabaseDatabase>>, {
  get: (_target, prop) => getSupabase()[prop as keyof ReturnType<typeof createClient<SupabaseDatabase>>],
});

// Separate auth client using anon key so user token verification does not depend on service role key.
let _authClient: ReturnType<typeof createClient<SupabaseDatabase>> | null = null;
function getAuthClient() {
  if (!_authClient) {
    const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!url || !anonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    _authClient = createClient<SupabaseDatabase>(url, anonKey);
  }
  return _authClient;
}

async function getCurrentUserFromCookies() {
  try {
    const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!url || !anonKey) return null;

    const cookieStore = await cookies();
    const sessionClient = createServerClient<SupabaseDatabase>(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignore set attempts when not allowed in this context.
          }
        },
      },
    });

    const {
      data: { user },
      error,
    } = await sessionClient.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code: string;
}

// Error responses
export const ApiErrors = {
  UNAUTHORIZED: { status: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' },
  FORBIDDEN: { status: 403, message: 'Forbidden', code: 'FORBIDDEN' },
  NOT_FOUND: { status: 404, message: 'Not found', code: 'NOT_FOUND' },
  BAD_REQUEST: { status: 400, message: 'Bad request', code: 'BAD_REQUEST' },
  CONFLICT: { status: 409, message: 'Conflict', code: 'CONFLICT' },
  INTERNAL_ERROR: { status: 500, message: 'Internal server error', code: 'INTERNAL_ERROR' },
  INVALID_ROLE: { status: 403, message: 'Invalid role for this action', code: 'INVALID_ROLE' },
  INVALID_TRIP: { status: 400, message: 'Invalid trip', code: 'INVALID_TRIP' },
};

// Helper to create error responses
export function errorResponse(error: ApiError, details?: string): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      error: details || error.message,
      code: error.code,
    },
    { status: error.status }
  );
}

// Helper to create success responses
export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

// Get current user from request
export async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const {
          data: { user },
        } = await getAuthClient().auth.getUser(token);
        if (user) return user;
      } catch {
        // Fall back to cookie-based session lookup.
      }
    }
  }

  return getCurrentUserFromCookies();
}

// Get user profile with role
export async function getUserProfile(userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return null;
  }

  return profile;
}

// Check if user has role
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

// Check if user is admin
export function isAdmin(userRole: UserRole): boolean {
  return hasRole(userRole, ['admin', 'super_admin']);
}

// Check if user is trip admin or super admin
export function isTripsAdmin(userRole: UserRole): boolean {
  return hasRole(userRole, ['trip_admin', 'admin', 'super_admin']);
}

// Check if user is super admin
export function isSuperAdmin(userRole: UserRole): boolean {
  return userRole === 'super_admin';
}

// Verify request auth
export async function verifyAuth(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return { authenticated: false, user: null, profile: null };
  }

  const profile = await getUserProfile(user.id);
  if (!profile) {
    return { authenticated: false, user, profile: null };
  }

  if (profile.status !== 'active') {
    return { authenticated: false, user, profile };
  }

  return { authenticated: true, user, profile };
}

// Verify user has required role
export async function verifyRole(
  request: NextRequest,
  requiredRoles: UserRole[]
): Promise<{
  authenticated: boolean;
  authorized: boolean;
  user: any;
  profile: any;
}> {
  const { authenticated, user, profile } = await verifyAuth(request);

  if (!authenticated || !profile) {
    return { authenticated: false, authorized: false, user, profile };
  }

  const authorized = hasRole(profile.role as UserRole, requiredRoles);
  return { authenticated: true, authorized, user, profile };
}

// Get user's trip role
export async function getUserTripRole(userId: string, tripId: string) {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_role')
    .eq('user_id', userId)
    .eq('trip_id', tripId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.trip_role;
}

// Check if user is trip member
export async function isUserTripMember(userId: string, tripId: string): Promise<boolean> {
  const { data } = await supabase
    .from('trip_members')
    .select('id')
    .eq('user_id', userId)
    .eq('trip_id', tripId)
    .single();

  return !!data;
}

// Check if user is trip captain/organizer
export async function isUserTripAdmin(userId: string, tripId: string): Promise<boolean> {
  const role = await getUserTripRole(userId, tripId);
  return role === 'captain' || role === 'organiser';
}

// Log activity
export async function logActivity(
  userId: string,
  action: ActivityAction,
  entityType: string,
  entityId: string,
  entityName?: string | null,
  changes?: Record<string, any> | null,
  ipAddress?: string | null
) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName || null,
      changes: changes || null,
      ip_address: ipAddress || null,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Get trip by ID
export async function getTrip(tripId: string) {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    return null;
  }

  return trip;
}

// Get trip by slug
export async function getTripBySlug(slug: string) {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !trip) {
    return null;
  }

  return trip;
}

// Validate request body
export async function getJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch (error) {
    const err = new Error(ApiErrors.BAD_REQUEST.message);
    (err as any).status = ApiErrors.BAD_REQUEST.status;
    (err as any).code = ApiErrors.BAD_REQUEST.code;
    throw err;
  }
}

// Validate query parameter
export function getQueryParam(request: NextRequest, key: string): string | null {
  return request.nextUrl.searchParams.get(key);
}

// Generate slug from string
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Format currency
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Paginate query results
export function getPagination(request: NextRequest, defaultLimit = 25, maxLimit = 100) {
  const page = Math.max(1, parseInt(getQueryParam(request, 'page') || '1'));
  const limit = Math.min(maxLimit, parseInt(getQueryParam(request, 'limit') || String(defaultLimit)));

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

// Get request IP address
export function getIpAddress(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).ip ||
    null
  );
}

// Validate file upload
export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSizeInMB: number
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeInMB}MB limit`,
    };
  }

  return { valid: true };
}

// Send notification
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'trip_update' | 'payment' | 'award' | 'gallery' | 'comment' | 'system',
  link?: string | null
) {
  try {
    const { data: notification } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link: link || null,
        is_read: false,
      })
      .select()
      .single();

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// Send bulk notifications
export async function createNotifications(
  userIds: string[],
  title: string,
  message: string,
  type: 'trip_update' | 'payment' | 'award' | 'gallery' | 'comment' | 'system',
  link?: string | null
) {
  try {
    const notifications = userIds.map((userId) => ({
      user_id: userId,
      title,
      message,
      type,
      link: link || null,
      is_read: false,
    }));

    await supabase.from('notifications').insert(notifications);
    return true;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return false;
  }
}

// Export errors for use
export { supabase };
