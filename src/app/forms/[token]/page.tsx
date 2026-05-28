'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { CheckCircle, AlertCircle, ChevronDown, Clock, RefreshCw, ShieldCheck, Mail, Send, LogIn } from 'lucide-react';
import Image from 'next/image';
import type { FormField } from '@/lib/types/database';

// Extended field type that includes profiles_column from the library
type FormFieldWithMapping = FormField & { profiles_column?: string | null };

type FormData = {
  id: string;
  title: string;
  description: string | null;
  token: string;
  status: string;
  submission_deadline: string | null;
  goes_live_at: string | null;
  show_countdown: boolean;
  allow_multiple_submissions: boolean;
  require_email_verification: boolean;
  trips: { name: string } | null;
  form_fields: FormFieldWithMapping[];
};

// ── Countdown hook ───────────────────────────────────────────
type CountdownParts = { days: number; hours: number; mins: number; secs: number; total: number };

function useCountdown(targetIso: string | null | undefined): CountdownParts {
  const calc = (): CountdownParts => {
    if (!targetIso) return { days: 0, hours: 0, mins: 0, secs: 0, total: 0 };
    const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
    return {
      total: diff,
      days:  Math.floor(diff / 86400),
      hours: Math.floor((diff % 86400) / 3600),
      mins:  Math.floor((diff % 3600) / 60),
      secs:  diff % 60,
    };
  };
  const [parts, setParts] = useState<CountdownParts>(calc);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    setParts(calc());
    ref.current = setInterval(() => setParts(calc()), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);
  return parts;
}

// ── Countdown display ─────────────────────────────────────────
function CountdownDisplay({ parts, label }: { parts: CountdownParts; label: string }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-zinc-400 text-sm">{label}</p>
      <div className="flex items-end gap-3">
        {parts.days > 0 && (
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-white font-mono">{parts.days}</span>
            <span className="text-zinc-500 text-xs uppercase tracking-widest">day{parts.days !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-white font-mono">{pad(parts.hours)}</span>
          <span className="text-zinc-500 text-xs uppercase tracking-widest">hrs</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[#C9B98A] font-mono">{pad(parts.mins)}</span>
          <span className="text-zinc-500 text-xs uppercase tracking-widest">min</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[#B5621E] font-mono">{pad(parts.secs)}</span>
          <span className="text-zinc-500 text-xs uppercase tracking-widest">sec</span>
        </div>
      </div>
    </div>
  );
}

// ── Profile update confirmation modal ────────────────────────
type ChangedField = { label: string; current: string; submitted: string };

function ProfileUpdateModal({
  changes,
  onConfirm,
  onSkip,
}: {
  changes: ChangedField[];
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <RefreshCw size={22} className="text-[#C9B98A] mt-0.5 shrink-0" />
          <div>
            <h2 className="text-white font-semibold text-lg">Update your profile?</h2>
            <p className="text-zinc-400 text-sm mt-1">
              Some of your answers differ from what&apos;s saved on your profile. Would you like us to update your profile with the new information?
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {changes.map((c) => (
            <div key={c.label} className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm">
              <p className="text-zinc-300 font-medium mb-1">{c.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-zinc-600 text-xs mb-0.5">Current</p>
                  <p className="text-zinc-400 truncate">{c.current || <span className="italic text-zinc-600">empty</span>}</p>
                </div>
                <div>
                  <p className="text-[#C9B98A] text-xs mb-0.5">New</p>
                  <p className="text-white truncate">{c.submitted}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={onConfirm}
            className="flex-1"
          >
            Update Profile
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors"
          >
            Keep Current
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicFormPage() {
  const params = useParams();
  const token = params.token as string;
  const pathname = usePathname();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Profile pre-fill state
  const [profileData, setProfileData] = useState<Record<string, string> | null>(null);

  // Update confirmation modal state
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const [profileChanges, setProfileChanges] = useState<ChangedField[]>([]);

  // Email verification state (for forms that require it)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'email' | 'otp' | 'verified'>('email');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [confirmingOtp, setConfirmingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const supabase = createClient();

  // Countdown hooks — always called, conditionally used
  const goesLiveCountdown = useCountdown(form?.goes_live_at);
  const deadlineCountdown = useCountdown(form?.submission_deadline);

  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forms/${token}/public`);
      if (!res.ok) {
        if (res.status === 404) setError('This form could not be found.');
        else if (res.status === 403) setError('This form is not currently accepting submissions.');
        else setError('Unable to load form.');
        return;
      }
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Unable to load form.'); return; }
      const formData: FormData = json.data;
      setForm(formData);

      // If form is scheduled, re-poll once it goes live (within 24h window)
      if (formData.status === 'scheduled' && formData.goes_live_at) {
        const msUntilLive = new Date(formData.goes_live_at).getTime() - Date.now();
        if (msUntilLive > 0 && msUntilLive < 24 * 60 * 60 * 1000) {
          setTimeout(() => loadForm(), msUntilLive + 500);
        }
      }

      // Check logged-in user for duplicate check + profile pre-fill
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Authenticated users bypass email verification — their identity is already proven
        setIsAuthenticated(true);
        setVerificationStep('verified');
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          // Build a flat string map of profile fields for comparison
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(profile)) {
            if (v !== null && v !== undefined) flat[k] = String(v);
          }
          setProfileData(flat);

          // Pre-fill form values from profile where a profiles_column mapping exists
          if (formData.status !== 'scheduled') {
            setValues(prev => {
              const prefilled = { ...prev };
              for (const field of formData.form_fields) {
                const col = field.profiles_column;
                if (col && flat[col] && !prefilled[field.id]) {
                  prefilled[field.id] = flat[col];
                }
              }
              return prefilled;
            });
          }

          // Check for existing submission
          if (!formData.allow_multiple_submissions) {
            const { data: existing } = await supabase
              .from('form_responses')
              .select('id')
              .eq('form_id', formData.id)
              .eq('member_id', user.id)
              .maybeSingle();
            if (existing) setAlreadySubmitted(true);
          }
        }
      }
    } catch {
      setError('Unable to load form.');
    } finally {
      setLoading(false);
    }
  }, [token, supabase]);

  useEffect(() => { loadForm(); }, [loadForm]);

  function setValue(fieldId: string, val: string | string[]) {
    setValues(prev => ({ ...prev, [fieldId]: val }));
  }

  function toggleMultiChoice(fieldId: string, option: string) {
    const current = (values[fieldId] as string[] | undefined) || [];
    if (current.includes(option)) {
      setValue(fieldId, current.filter(o => o !== option));
    } else {
      setValue(fieldId, [...current, option]);
    }
  }

  // ── Email verification helpers ──────────────────────────────
  async function sendOtp() {
    if (!verifyEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifyEmail)) {
      setOtpError('Please enter a valid email address.');
      return;
    }
    setSendingOtp(true);
    setOtpError(null);
    const res = await fetch(`/api/forms/${token}/request-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verifyEmail }),
    });
    const json = await res.json();
    setSendingOtp(false);
    if (json.success) {
      setVerificationId(json.data.verification_id);
      setVerificationStep('otp');
    } else {
      setOtpError(json.error || 'Failed to send code. Please try again.');
    }
  }

  async function confirmOtp() {
    if (!otpInput || otpInput.length < 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }
    setConfirmingOtp(true);
    setOtpError(null);
    const res = await fetch(`/api/forms/${token}/confirm-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_id: verificationId, otp: otpInput }),
    });
    const json = await res.json();
    setConfirmingOtp(false);
    if (json.success && json.data.verified) {
      setVerificationStep('verified');
      // Pre-fill the email field if there's a mapped field for it
      if (form) {
        const emailField = form.form_fields.find(f => f.profiles_column === 'email');
        if (emailField) {
          setValue(emailField.id, verifyEmail);
        }
      }
    } else {
      setOtpError(json.error || 'Incorrect code. Please try again.');
    }
  }

  // Detect which profile-mapped fields have changed vs stored profile
  function detectProfileChanges(): ChangedField[] {
    if (!form || !profileData) return [];
    const changes: ChangedField[] = [];
    for (const field of form.form_fields) {
      const col = field.profiles_column;
      if (!col) continue;
      const submitted = values[field.id];
      if (!submitted || Array.isArray(submitted)) continue; // skip multi-choice
      const submittedStr = submitted.trim();
      const currentStr = (profileData[col] || '').trim();
      if (submittedStr && submittedStr !== currentStr) {
        changes.push({ label: field.label, current: currentStr, submitted: submittedStr });
      }
    }
    return changes;
  }

  async function doSubmit(updateProfile: boolean) {
    if (!form) return;
    setSubmitting(true);
    setSubmitError(null);

    // Get auth token if available
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const body: Record<string, unknown> = { values, updateProfile };
    if (verificationId) body.verification_id = verificationId;

    const res = await fetch(`/api/forms/submit/${token}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSubmitting(false);

    if (json.success) {
      setSubmitted(true);
    } else if (res.status === 409) {
      setAlreadySubmitted(true);
    } else {
      setSubmitError(json.error || 'Submission failed. Please try again.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitError(null);

    // Client-side required validation
    const requiredFields = form.form_fields.filter(
      f => f.is_required && !['section_header'].includes(f.field_type)
    );
    for (const f of requiredFields) {
      const val = values[f.id];
      const empty = !val || (Array.isArray(val) && val.length === 0) || val === '';
      if (empty) {
        setSubmitError(`Please fill in: "${f.label}"`);
        return;
      }
    }

    // Validate email format for any email-mapped fields
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const f of form.form_fields) {
      if (f.profiles_column === 'email') {
        const val = typeof values[f.id] === 'string' ? (values[f.id] as string).trim() : '';
        if (val && !EMAIL_RE.test(val)) {
          setSubmitError(`Please enter a valid email address in "${f.label}".`);
          return;
        }
      }
    }

    // If the member is logged in, check for profile changes that need confirmation
    if (profileData) {
      const changes = detectProfileChanges();
      if (changes.length > 0) {
        setProfileChanges(changes);
        setPendingUpdate(true);
        return; // wait for modal confirmation
      }
    }

    // No changes to confirm — submit directly (always update for unauthenticated)
    await doSubmit(true);
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col items-center justify-start py-12 px-4">
      {/* Profile update confirmation modal */}
      {pendingUpdate && (
        <ProfileUpdateModal
          changes={profileChanges}
          onConfirm={async () => {
            setPendingUpdate(false);
            await doSubmit(true);
          }}
          onSkip={async () => {
            setPendingUpdate(false);
            await doSubmit(false);
          }}
        />
      )}

      {/* Logo */}
      <div className="mb-8">
        <Image src="/1.png" alt="Whiskey Riders" width={72} height={72} className="opacity-80" />
      </div>

      <div className="w-full max-w-lg">
        {loading ? (
          <div className="flex justify-center py-24"><Spinner /></div>
        ) : error ? (
          <div className="text-center space-y-3">
            <AlertCircle size={48} className="text-red-400 mx-auto" />
            <p className="text-zinc-300 text-lg">{error}</p>
          </div>
        ) : submitted ? (
          <div className="text-center space-y-4 py-12">
            <CheckCircle size={56} className="text-[#B5621E] mx-auto" />
            <h2 className="text-2xl font-bold text-white">Submitted!</h2>
            <p className="text-zinc-400">Thanks for completing the form. Your response has been saved.</p>
          </div>
        ) : alreadySubmitted ? (
          <div className="text-center space-y-4 py-12">
            <CheckCircle size={56} className="text-[#C9B98A] mx-auto" />
            <h2 className="text-2xl font-bold text-white">Already Submitted</h2>
            <p className="text-zinc-400">You&apos;ve already submitted this form. Contact an admin if you need to make changes.</p>
          </div>
        ) : form?.status === 'scheduled' ? (
          /* ── Not yet open: countdown to goes_live_at ─────────── */
          <div className="text-center space-y-8 py-12">
            <div className="space-y-2">
              <Clock size={48} className="text-[#C9B98A] mx-auto" />
              <h1 className="text-2xl font-bold text-white">{form.title}</h1>
              {form.description && <p className="text-zinc-400 text-sm">{form.description}</p>}
              {form.trips && <p className="text-[#C9B98A] text-sm">{form.trips.name}</p>}
            </div>
            <div className="border border-zinc-800 rounded-xl bg-zinc-900/60 px-8 py-6 space-y-4">
              <p className="text-zinc-500 text-xs uppercase tracking-widest font-medium">Opens in</p>
              {goesLiveCountdown.total > 0 ? (
                <CountdownDisplay parts={goesLiveCountdown} label="" />
              ) : (
                <p className="text-[#C9B98A] text-sm">Opening now — refresh the page</p>
              )}
              {form.goes_live_at && (
                <p className="text-zinc-600 text-xs mt-2">
                  {new Date(form.goes_live_at).toLocaleString('en-AU', {
                    weekday: 'long', day: 'numeric', month: 'long',
                    year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        ) : form && form.require_email_verification && !isAuthenticated && verificationStep !== 'verified' ? (
          /* ── Email verification gate ───────────────────────────── */
          <div className="space-y-6">
            {/* Form header */}
            <div className="space-y-1 pb-4 border-b border-zinc-800">
              <h1 className="text-2xl font-bold text-white">{form.title}</h1>
              {form.description && <p className="text-zinc-400">{form.description}</p>}
              {form.trips && <p className="text-[#C9B98A] text-sm">{form.trips.name}</p>}
            </div>

            <div className="flex flex-col items-center gap-1 pb-2">
              <ShieldCheck size={36} className="text-[#C9B98A]" />
              <h2 className="text-lg font-semibold text-white mt-2">Verify your email</h2>
              <p className="text-zinc-400 text-sm text-center max-w-sm">
                This form requires email verification before you can submit. Enter your email address to receive a one-time code.
              </p>
            </div>

            {verificationStep === 'email' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-200 mb-1.5 flex items-center gap-1.5">
                    <Mail size={13} className="text-zinc-400" /> Your email address
                  </label>
                  <input
                    type="email"
                    value={verifyEmail}
                    onChange={e => { setVerifyEmail(e.target.value); setOtpError(null); }}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    placeholder="you@example.com"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#B5621E]"
                  />
                </div>
                {otpError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
                    <AlertCircle size={14} /> {otpError}
                  </div>
                )}
                <Button onClick={sendOtp} disabled={sendingOtp} className="w-full flex items-center justify-center gap-2">
                  {sendingOtp ? <Spinner size="sm" /> : <><Send size={14} /> Send verification code</>}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
                  <Mail size={12} className="text-[#C9B98A] shrink-0" />
                  Code sent to <span className="text-zinc-300 font-medium">{verifyEmail}</span>
                  <button
                    onClick={() => { setVerificationStep('email'); setOtpInput(''); setOtpError(null); }}
                    className="ml-auto text-zinc-500 hover:text-zinc-300 underline transition-colors"
                  >
                    Change
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-200 mb-1.5">
                    Enter your 6-digit code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={e => { setOtpInput(e.target.value.replace(/\D/g, '')); setOtpError(null); }}
                    onKeyDown={e => e.key === 'Enter' && confirmOtp()}
                    placeholder="000000"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white text-2xl font-mono tracking-[0.5em] rounded-lg px-4 py-3 focus:outline-none focus:border-[#B5621E] text-center"
                  />
                  <p className="text-zinc-600 text-xs mt-1.5">The code expires in 15 minutes.</p>
                </div>
                {otpError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
                    <AlertCircle size={14} /> {otpError}
                  </div>
                )}
                <Button onClick={confirmOtp} disabled={confirmingOtp || otpInput.length < 6} className="w-full flex items-center justify-center gap-2">
                  {confirmingOtp ? <Spinner size="sm" /> : <><ShieldCheck size={14} /> Verify &amp; continue</>}
                </Button>
                <button
                  onClick={() => { setOtpError(null); sendOtp(); }}
                  disabled={sendingOtp}
                  className="w-full text-zinc-500 text-sm hover:text-zinc-300 transition-colors py-1"
                >
                  {sendingOtp ? 'Resending…' : 'Resend code'}
                </button>
              </div>
            )}
          </div>
        ) : form ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form header */}
            <div className="space-y-1 pb-2 border-b border-zinc-800">
              <h1 className="text-2xl font-bold text-white">{form.title}</h1>
              {form.description && <p className="text-zinc-400">{form.description}</p>}
              {form.trips && <p className="text-[#C9B98A] text-sm">{form.trips.name}</p>}
            </div>

            {/* Pre-fill notice for logged-in members */}
            {profileData ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
                <CheckCircle size={12} className="text-[#C9B98A] shrink-0" />
                Some fields have been pre-filled from your profile. Review and update as needed.
              </div>
            ) : (
              /* Login prompt for unauthenticated users */
              <a
                href={`/login?redirect=${encodeURIComponent(pathname)}`}
                className="flex items-center gap-2.5 text-xs bg-zinc-900/60 border border-zinc-800 hover:border-zinc-600 rounded-lg px-3 py-2.5 transition-colors group"
              >
                <LogIn size={13} className="text-[#C9B98A] shrink-0" />
                <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  Already a member?{' '}
                  <span className="text-[#C9B98A] underline underline-offset-2">Log in</span>
                  {' '}to pre-fill your details automatically.
                </span>
              </a>
            )}

            {/* Closing countdown banner */}
            {form.show_countdown && form.submission_deadline && deadlineCountdown.total > 0 && (
              <div className="flex items-center justify-between gap-4 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-widest shrink-0">
                  <Clock size={13} className="text-[#B5621E]" />
                  Closes in
                </div>
                <div className="flex items-end gap-2 text-sm font-mono">
                  {deadlineCountdown.days > 0 && (
                    <span className="text-white font-bold">{deadlineCountdown.days}<span className="text-zinc-500 text-xs font-normal ml-0.5">d</span></span>
                  )}
                  <span className="text-white font-bold">{String(deadlineCountdown.hours).padStart(2,'0')}<span className="text-zinc-500 text-xs font-normal ml-0.5">h</span></span>
                  <span className="text-[#C9B98A] font-bold">{String(deadlineCountdown.mins).padStart(2,'0')}<span className="text-zinc-500 text-xs font-normal ml-0.5">m</span></span>
                  <span className="text-[#B5621E] font-bold">{String(deadlineCountdown.secs).padStart(2,'0')}<span className="text-zinc-500 text-xs font-normal ml-0.5">s</span></span>
                </div>
              </div>
            )}

            {/* Deadline date fallback */}
            {form.submission_deadline && (!form.show_countdown || deadlineCountdown.total === 0) && (
              <p className="text-zinc-500 text-xs">
                Deadline: {new Date(form.submission_deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}

            {/* Verification badge — show if email was verified before form */}
            {verificationStep === 'verified' && !isAuthenticated && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
                <ShieldCheck size={12} className="text-[#B5621E] shrink-0" />
                Email verified: <span className="text-zinc-300 font-medium">{verifyEmail}</span>
              </div>
            )}

            {/* Fields */}
            {form.form_fields.map((field) => {
              // Lock the email field if it was verified via OTP (unauthenticated flow)
              const isLockedEmail = verificationStep === 'verified' && !isAuthenticated
                && field.profiles_column === 'email';
              return (
                <FormFieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={(val) => setValue(field.id, val)}
                  onToggle={(opt) => toggleMultiChoice(field.id, opt)}
                  readOnly={isLockedEmail}
                />
              );
            })}

            {/* Submit error */}
            {submitError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
                <AlertCircle size={14} /> {submitError}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Spinner size="sm" /> : 'Submit'}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

// ── Field renderer ────────────────────────────────────────────
function FormFieldRenderer({
  field,
  value,
  onChange,
  onToggle,
  readOnly = false,
}: {
  field: FormFieldWithMapping;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  onToggle: (option: string) => void;
  readOnly?: boolean;
}) {
  const strVal = typeof value === 'string' ? value : '';
  const arrVal = Array.isArray(value) ? value : [];

  if (field.field_type === 'section_header') {
    return (
      <div className="pt-4 pb-1 border-b border-zinc-700">
        <h3 className="text-lg font-semibold text-[#C9B98A]">{field.label}</h3>
        {field.helper_text && <p className="text-zinc-500 text-sm mt-0.5">{field.helper_text}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-200">
        {field.label}
        {field.is_required && <span className="text-[#B5621E] ml-1">*</span>}
      </label>
      {field.helper_text && <p className="text-zinc-500 text-xs">{field.helper_text}</p>}

      {/* Short text — use type="email" for email-mapped fields for browser-native validation */}
      {field.field_type === 'short_text' && (
        <Input
          type={field.profiles_column === 'email' ? 'email' : 'text'}
          value={strVal}
          onChange={readOnly ? () => {} : (e) => onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={field.placeholder || (field.profiles_column === 'email' ? 'you@example.com' : '')}
          required={field.is_required}
          className={`w-full ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
        />
      )}

      {/* Long text */}
      {field.field_type === 'long_text' && (
        <textarea
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          required={field.is_required}
          className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none h-28 focus:outline-none focus:border-[#B5621E]"
        />
      )}

      {/* Number / currency */}
      {(field.field_type === 'number' || field.field_type === 'currency') && (
        <Input
          type="number"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || (field.field_type === 'currency' ? '0.00' : '')}
          required={field.is_required}
          className="w-full"
        />
      )}

      {/* Date */}
      {field.field_type === 'date' && (
        <Input
          type="date"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          className="w-full"
        />
      )}

      {/* Date range */}
      {field.field_type === 'date_range' && (
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={typeof value === 'object' && !Array.isArray(value) ? '' : ''}
            onChange={(e) => {
              const current = typeof value === 'object' && !Array.isArray(value) ? (value as unknown as { from?: string; to?: string }) : {};
              onChange(JSON.stringify({ ...current, from: e.target.value }) as unknown as string);
            }}
            className="flex-1"
          />
          <span className="text-zinc-500 text-sm">to</span>
          <Input
            type="date"
            onChange={(e) => {
              const current = typeof value === 'object' && !Array.isArray(value) ? (value as unknown as { from?: string; to?: string }) : {};
              onChange(JSON.stringify({ ...current, to: e.target.value }) as unknown as string);
            }}
            className="flex-1"
          />
        </div>
      )}

      {/* Single choice */}
      {field.field_type === 'single_choice' && (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={strVal === opt}
                onChange={() => onChange(opt)}
                className="accent-[#B5621E]"
              />
              <span className="text-zinc-200 text-sm group-hover:text-white transition-colors">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {/* Multiple choice */}
      {field.field_type === 'multiple_choice' && (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={arrVal.includes(opt)}
                onChange={() => onToggle(opt)}
                className="accent-[#B5621E]"
              />
              <span className="text-zinc-200 text-sm group-hover:text-white transition-colors">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {field.field_type === 'dropdown' && (
        <div className="relative">
          <select
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            required={field.is_required}
            className="w-full appearance-none bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-[#B5621E]"
          >
            <option value="">Select an option…</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>
      )}

      {/* Yes / No */}
      {field.field_type === 'yes_no' && (
        <div className="flex gap-3">
          {['Yes', 'No'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                strVal === opt
                  ? 'bg-[#B5621E] border-[#B5621E] text-white'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Acknowledgement */}
      {field.field_type === 'acknowledgement' && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={strVal === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : '')}
            required={field.is_required}
            className="mt-0.5 accent-[#B5621E]"
          />
          <span className="text-zinc-300 text-sm leading-relaxed">{field.placeholder || 'I acknowledge and agree'}</span>
        </label>
      )}
    </div>
  );
}
