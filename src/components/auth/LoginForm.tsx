'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle } from 'lucide-react';

type View = 'magic' | 'password' | 'forgot';

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [view, setView] = useState<View>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const clearMessages = () => { setError(''); setMessage(''); };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMessage('Check your email for a magic link to sign in!');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
            Enter your email and we'll send you a link to set a new password.
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

      {/* ── Sign-In tabs (magic / password) ── */}
      {view !== 'forgot' && (
        <>
          <div className="flex gap-4 mb-6 border-b border-brand-brown/20">
            <button
              onClick={() => { setView('magic'); clearMessages(); }}
              className={`pb-3 px-2 font-semibold transition-colors ${
                view === 'magic'
                  ? 'text-brand-brown border-b-2 border-brand-brown'
                  : 'text-brand-cream/60 hover:text-brand-cream'
              }`}
            >
              Magic Link
            </button>
            <button
              onClick={() => { setView('password'); clearMessages(); }}
              className={`pb-3 px-2 font-semibold transition-colors ${
                view === 'password'
                  ? 'text-brand-brown border-b-2 border-brand-brown'
                  : 'text-brand-cream/60 hover:text-brand-cream'
              }`}
            >
              Email & Password
            </button>
          </div>

          {/* Magic Link Tab */}
          {view === 'magic' && (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
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

              {message && (
                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-green-100 text-sm">
                  {message}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
                Send Magic Link
              </Button>

              <p className="text-xs text-brand-cream/60 text-center">
                We'll send you a link to sign in with no password needed.
              </p>
            </form>
          )}

          {/* Password Tab */}
          {view === 'password' && (
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

              <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
                Sign In
              </Button>

              <p className="text-xs text-brand-cream/60 text-center">
                Don't have an account? Contact an admin to create one.
              </p>
            </form>
          )}
        </>
      )}
    </div>
  );
}
