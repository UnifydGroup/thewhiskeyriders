'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
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
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-brand-brown/20">
        <button
          onClick={() => {
            setTab('magic');
            setError('');
            setMessage('');
          }}
          className={`pb-3 px-2 font-semibold transition-colors ${
            tab === 'magic'
              ? 'text-brand-brown border-b-2 border-brand-brown'
              : 'text-brand-cream/60 hover:text-brand-cream'
          }`}
        >
          Magic Link
        </button>
        <button
          onClick={() => {
            setTab('password');
            setError('');
            setMessage('');
          }}
          className={`pb-3 px-2 font-semibold transition-colors ${
            tab === 'password'
              ? 'text-brand-brown border-b-2 border-brand-brown'
              : 'text-brand-cream/60 hover:text-brand-cream'
          }`}
        >
          Email & Password
        </button>
      </div>

      {/* Magic Link Tab */}
      {tab === 'magic' && (
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
      {tab === 'password' && (
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
            <label className="block text-sm font-medium text-brand-cream mb-2">
              Password
            </label>
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
    </div>
  );
}
