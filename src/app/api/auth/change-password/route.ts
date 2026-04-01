import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PUT /api/auth/change-password - Change user password and mark as changed
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Update password in auth
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Mark password as changed in profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ password_changed: true })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
      // Continue even if profile update fails - password was changed
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/auth/change-password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
