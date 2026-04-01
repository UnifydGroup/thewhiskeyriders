'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Wait for the session to be established from the reset link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (callback already exchanged the code)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Mark password_changed = true in the profile
      await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-400" />
        <h2 className="text-xl font-bold text-brand-cream">Password updated!</h2>
        <p className="text-brand-cream/60 text-sm">Redirecting you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-cream mb-2 text-center">Set New Password</h2>
      <p className="text-brand-cream/60 text-sm text-center mb-6">
        Choose a strong password for your account.
      </p>

      {!sessionReady && (
        <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg text-yellow-200 text-sm mb-4 text-center">
          Verifying your reset link…
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-brand-cream mb-2">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={isLoading || !sessionReady}
              className="w-full px-3 py-2 bg-brand-dark-grey border border-brand-brown/30 rounded text-brand-cream placeholder:text-brand-cream/40 focus:outline-none focus:border-brand-brown disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-brand-cream/60 hover:text-brand-cream"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-cream mb-2">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={isLoading || !sessionReady}
              className="w-full px-3 py-2 bg-brand-dark-grey border border-brand-brown/30 rounded text-brand-cream placeholder:text-brand-cream/40 focus:outline-none focus:border-brand-brown disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-2.5 text-brand-cream/60 hover:text-brand-cream"
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          isLoading={isLoading}
          disabled={!sessionReady || isLoading}
        >
          Update Password
        </Button>

        <p className="text-xs text-brand-cream/50 text-center">
          Password must be at least 8 characters long
        </p>
      </form>
    </div>
  );
}
