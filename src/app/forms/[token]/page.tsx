'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import type { FormField } from '@/lib/types/database';

type FormData = {
  id: string;
  title: string;
  description: string | null;
  token: string;
  status: string;
  submission_deadline: string | null;
  allow_multiple_submissions: boolean;
  trips: { name: string } | null;
  form_fields: FormField[];
};

export default function PublicFormPage() {
  const params = useParams();
  const token = params.token as string;

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Check if user is already logged in (for pre-fill check)
  const supabase = createClient();

  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch via the form's token using the submit endpoint (which also returns form metadata)
      const res = await fetch(`/api/forms/${token}/public`);
      if (!res.ok) {
        if (res.status === 404) setError('This form could not be found.');
        else if (res.status === 403) setError('This form is not currently accepting submissions.');
        else setError('Unable to load form.');
        return;
      }
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Unable to load form.'); return; }
      setForm(json.data);

      // Check existing submission
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !json.data.allow_multiple_submissions) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
        if (profile) {
          const { data: existing } = await supabase
            .from('form_responses')
            .select('id')
            .eq('form_id', json.data.id)
            .eq('member_id', profile.id)
            .maybeSingle();
          if (existing) setAlreadySubmitted(true);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitError(null);

    // Client-side required check
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

    setSubmitting(true);
    const res = await fetch(`/api/forms/submit/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
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

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col items-center justify-start py-12 px-4">
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
        ) : form ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form header */}
            <div className="space-y-1 pb-2 border-b border-zinc-800">
              <h1 className="text-2xl font-bold text-white">{form.title}</h1>
              {form.description && <p className="text-zinc-400">{form.description}</p>}
              {form.trips && <p className="text-[#C9B98A] text-sm">{form.trips.name}</p>}
              {form.submission_deadline && (
                <p className="text-zinc-500 text-xs">
                  Deadline: {new Date(form.submission_deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Fields */}
            {form.form_fields.map((field) => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(val) => setValue(field.id, val)}
                onToggle={(opt) => toggleMultiChoice(field.id, opt)}
              />
            ))}

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
}: {
  field: FormField;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  onToggle: (option: string) => void;
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

      {/* Short text */}
      {field.field_type === 'short_text' && (
        <Input
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          required={field.is_required}
          className="w-full"
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

      {/* Date range — stored as JSON { from, to } */}
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
