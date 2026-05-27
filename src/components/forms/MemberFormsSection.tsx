'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  ClipboardList, CheckCircle, Clock, Eye, EyeOff,
  ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';

type FormAssignmentWithResponse = {
  id: string;
  assigned_at: string;
  forms: {
    id: string;
    title: string;
    description: string | null;
    token: string;
    status: string;
    submission_deadline: string | null;
    trips: { id: string; name: string; slug: string } | null;
  } | null;
  response: {
    id: string;
    form_id: string;
    submitted_at: string;
    is_public: boolean;
    form_response_values: Array<{
      id: string;
      field_id: string;
      value_text: string | null;
      value_json: unknown;
      form_fields: {
        id: string;
        label: string;
        field_type: string;
        sort_order: number;
      } | null;
    }>;
  } | null;
};

interface Props {
  memberId: string;
  isSelf: boolean;
  isAdmin: boolean;
}

export default function MemberFormsSection({ memberId, isSelf, isAdmin }: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<FormAssignmentWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forms/member/${memberId}`);
      const json = await res.json();
      setAssignments(json.success ? json.data : []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  async function toggleVisibility(responseId: string, currentValue: boolean) {
    setTogglingVisibility(responseId);
    await fetch(`/api/forms/responses/${responseId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !currentValue }),
    });
    setTogglingVisibility(null);
    load();
  }

  if (loading) {
    return (
      <section>
        <h2 className="mb-4 text-2xl font-bold text-brand-cream">Forms</h2>
        <div className="flex justify-center py-8"><Spinner /></div>
      </section>
    );
  }

  // Filter what to show based on viewer
  const visibleAssignments = assignments.filter((a) => {
    if (!a.forms) return false;
    if (isAdmin || isSelf) return true;
    // Other members: only show if response is public
    return a.response?.is_public === true;
  });

  if (visibleAssignments.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold text-brand-cream flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-brand-brown" />
        Forms
      </h2>
      <div className="space-y-3">
        {visibleAssignments.map((assignment) => {
          const form = assignment.forms!;
          const response = assignment.response;
          const isSubmitted = !!response;
          const isExpanded = expandedResponseId === (response?.id ?? null);
          const isPastDeadline = form.submission_deadline && new Date(form.submission_deadline) < new Date();

          return (
            <Card key={assignment.id} className="border-brand-brown/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-brand-cream font-medium">{form.title}</span>
                      {isSubmitted ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900/20 border border-green-800/30 px-2 py-0.5 rounded-full">
                          <CheckCircle size={11} /> Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#C9B98A] bg-[#C9B98A]/10 border border-[#C9B98A]/20 px-2 py-0.5 rounded-full">
                          <Clock size={11} /> Pending
                        </span>
                      )}
                      {response && (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          {response.is_public ? <Eye size={11} /> : <EyeOff size={11} />}
                          {response.is_public ? 'Public' : 'Private'}
                        </span>
                      )}
                    </div>
                    {form.description && (
                      <p className="text-brand-cream/60 text-sm mt-1">{form.description}</p>
                    )}
                    {form.trips && (
                      <p className="text-[#C9B98A] text-xs mt-1">{form.trips.name}</p>
                    )}
                    {form.submission_deadline && (
                      <p className={`text-xs mt-1 ${isPastDeadline ? 'text-red-400' : 'text-brand-cream/50'}`}>
                        {isPastDeadline ? 'Closed' : `Due: ${new Date(form.submission_deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Open form to fill */}
                    {!isSubmitted && (isSelf || isAdmin) && form.status === 'active' && !isPastDeadline && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/forms/${form.token}`)}
                        className="flex items-center gap-1.5"
                      >
                        <ExternalLink size={12} /> Complete
                      </Button>
                    )}

                    {/* Toggle public/private */}
                    {isSubmitted && (isSelf || isAdmin) && (
                      <button
                        onClick={() => toggleVisibility(response!.id, response!.is_public)}
                        disabled={togglingVisibility === response?.id}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded border border-zinc-700 hover:border-zinc-500"
                        title={response?.is_public ? 'Make private' : 'Make public'}
                      >
                        {togglingVisibility === response?.id ? (
                          <Spinner size="sm" />
                        ) : response?.is_public ? (
                          <><EyeOff size={12} /> Hide</>
                        ) : (
                          <><Eye size={12} /> Show</>
                        )}
                      </button>
                    )}

                    {/* Expand / collapse response */}
                    {isSubmitted && (
                      <button
                        onClick={() => setExpandedResponseId(isExpanded ? null : response!.id)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded response values */}
                {isSubmitted && isExpanded && response && (
                  <div className="mt-4 pt-4 border-t border-brand-brown/10 space-y-3">
                    <p className="text-xs text-brand-cream/50">
                      Submitted {new Date(response.submitted_at).toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </p>
                    {[...response.form_response_values]
                      .sort((a, b) => (a.form_fields?.sort_order ?? 0) - (b.form_fields?.sort_order ?? 0))
                      .map((val) => {
                        if (val.form_fields?.field_type === 'section_header') return null;
                        return (
                          <div key={val.id} className="grid grid-cols-[1fr_2fr] gap-2 text-sm">
                            <span className="text-brand-cream/50 truncate">{val.form_fields?.label ?? '—'}</span>
                            <span className="text-brand-cream/80 break-words">
                              {val.value_json != null
                                ? Array.isArray(val.value_json)
                                  ? (val.value_json as string[]).join(', ')
                                  : JSON.stringify(val.value_json)
                                : val.value_text || <span className="text-brand-cream/30 italic">—</span>}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
