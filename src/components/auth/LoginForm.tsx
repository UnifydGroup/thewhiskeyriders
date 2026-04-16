'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { trackClientActivity } from '@/lib/activity/client';
import Link from 'next/link';

type View = 'password' | 'forgot';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [view, setView] = useState<View>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const accessState = searchParams.get('access');
    const signupState = searchParams.get('signup');

    if (accessState === 'pending') {
      setInfo('Your account is pending admin approval. You can sign in after approval.');
      return;
    }

    if (accessState === 'inactive') {
      setInfo('Your account is not active. Contact an admin for assistance.');
      return;
    }

    if (signupState === 'requested') {
      setInfo('Signup request submitted. An admin will review your details.');
      return;
    }

    setInfo('');
  }, [searchParams]);

  const clearMessages = () => { setError(''); setMessage(''); setInfo(''); };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) {
        throw new Error('Unable to verify account profile');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Unable to load your member profile. Contact an admin.');
      }

      if (profile.status !== 'active') {
        await supabase.auth.signOut();
        if (profile.status === 'pending') {
          setError('Your account is pending admin approval.');
          return;
        }
        setError('Your account is not active. Contact an admin.');
        return;
      }

      await trackClientActivity({
        action: 'login',
        entityType: 'auth',
        entityId: 'session',
        entityName: 'Signed in from login form',
        changes: {
          source: 'login_form',
          redirect: '/dashboard',
        },
        accessToken: data.session?.access_token,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setMessage('Password reset email sent! Check your inbox and follow the link.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">

      {/* ── Forgot Password view ── */}
      {view === 'forgot' && (
        <div>
          <button
            onClick={() => { setView('password'); clearMessages(); }}
            className="flex items-center gap-1.5 text-brand-cream/60 hover:text-brand-cream text-sm mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </button>

          <h3 className="text-lg font-semibold text-brand-cream mb-1">Reset your password</h3>
          <p className="text-brand-cream/60 text-sm mb-5">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>

          {message ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
              <p className="text-green-200 text-sm">{message}</p>
              <button
                onClick={() => { setView('password'); clearMessages(); }}
                className="text-brand-brown hover:underline text-sm mt-2"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-cream mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
                Send Reset Link
              </Button>
            </form>
          )}
        </div>
      )}

      {/* ── Password Sign-In view ── */}
      {view !== 'forgot' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-cream mb-2">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-brand-cream">
                Password
              </label>
              <button
                type="button"
                onClick={() => { setView('forgot'); clearMessages(); }}
                className="text-xs text-brand-brown hover:text-brand-brown/80 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
              {error}
            </div>
          )}

          {info && (
            <div className="p-4 bg-brand-brown/15 border border-brand-brown/40 rounded-lg text-brand-tan text-sm">
              {info}
            </div>
          )}

          <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
            Sign In
          </Button>

          <p className="text-xs text-brand-cream/60 text-center">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-brand-brown hover:text-brand-brown/80 font-semibold">
              Request access
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
