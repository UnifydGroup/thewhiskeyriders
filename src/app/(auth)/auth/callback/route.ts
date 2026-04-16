import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session) {
      // If this was a password-reset flow, send to the reset-password page
      if (next === '/reset-password') {
        return NextResponse.redirect(new URL('/reset-password', origin));
      }
    }
  }

  return NextResponse.redirect(new URL(next === '/reset-password' ? '/reset-password' : '/dashboard', origin));
}
