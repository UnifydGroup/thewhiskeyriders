import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function normalizeNullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  return stringValue === '' ? null : stringValue;
}

function normalizeDateValue(value: unknown): string | null {
  const normalized = normalizeNullableText(value);
  return normalized || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: missing Supabase URL or anon key' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      supabaseUrl,
      anonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      }
    );

    // Check authorization
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user is super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - super_admin only' }, { status: 403 });
    }

    const { members } = await request.json();

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: 'Invalid members array' },
        { status: 400 }
      );
    }

    const results = [];

    for (const member of members) {
      try {
        const email = normalizeNullableText(member.email);
        if (!email) {
          results.push({
            status: 'error',
            email: member.email,
            error: 'Email is required',
          });
          continue;
        }

        // Check if member already exists
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        if (existing) {
          results.push({
            status: 'skipped',
            email,
            reason: 'Already exists',
          });
          continue;
        }

        // Insert member
        const { error: insertError } = await supabase.from('profiles').insert({
          email,
          full_name: normalizeNullableText(member.full_name),
          phone: normalizeNullableText(member.phone),
          date_of_birth: normalizeDateValue(member.date_of_birth),
          address: normalizeNullableText(member.address),
          passport_number: normalizeNullableText(member.passport_number),
          shirt_size: normalizeNullableText(member.shirt_size),
          shorts_size: normalizeNullableText(member.shorts_size),
          role: 'member',
          status: 'active',
        });

        if (insertError) {
          results.push({
            status: 'error',
            email,
            error: insertError.message,
          });
        } else {
          results.push({
            status: 'success',
            email,
            name: normalizeNullableText(member.full_name),
          });
        }
      } catch (err) {
        results.push({
          status: 'error',
          email: member.email,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;

    return NextResponse.json({
      success: true,
      total: results.length,
      successCount,
      results,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
