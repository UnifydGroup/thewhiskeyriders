'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import {
  Plus, Edit2, Trash2, Eye, Copy, Users, ClipboardList,
  ChevronDown, ChevronUp, GripVertical, X, Save, Link2,
  CheckSquare, AlignLeft, Hash, Calendar, List, ToggleLeft,
  Upload, Minus, AlertCircle, CheckCircle, Send, FileText
} from 'lucide-react';
import type { Form, FormField, FormFieldType, FormStatus } from '@/lib/types/database';

// ── Field type config ────────────────────────────────────────
const FIELD_TYPES: { value: FormFieldType; label: string; icon: React.ReactNode; hasOptions: boolean }[] = [
  { value: 'short_text',      label: 'Short text',       icon: <AlignLeft size={14} />,     hasOptions: false },
  { value: 'long_text',       label: 'Long text',        icon: <AlignLeft size={14} />,     hasOptions: false },
  { value: 'number',          label: 'Number',           icon: <Hash size={14} />,          hasOptions: false },
  { value: 'currency',        label: 'Currency',         icon: <Hash size={14} />,          hasOptions: false },
  { value: 'date',            label: 'Date',             icon: <Calendar size={14} />,      hasOptions: false },
  { value: 'date_range',      label: 'Date range',       icon: <Calendar size={14} />,      hasOptions: false },
  { value: 'single_choice',   label: 'Single choice',    icon: <List size={14} />,          hasOptions: true },
  { value: 'multiple_choice', label: 'Multiple choice',  icon: <CheckSquare size={14} />,   hasOptions: true },
  { value: 'dropdown',        label: 'Dropdown',         icon: <ChevronDown size={14} />,   hasOptions: true },
  { value: 'yes_no',          label: 'Yes / No',         icon: <ToggleLeft size={14} />,    hasOptions: false },
  { value: 'file_upload',     label: 'File upload',      icon: <Upload size={14} />,        hasOptions: false },
  { value: 'section_header',  label: 'Section header',   icon: <Minus size={14} />,         hasOptions: false },
  { value: 'acknowledgement', label: 'Acknowledgement',  icon: <CheckSquare size={14} />,   hasOptions: false },
];

const STATUS_COLOURS: Record<FormStatus, string> = {
  draft:  'bg-zinc-700 text-zinc-200',
  active: 'bg-[#B5621E]/20 text-[#B5621E] border border-[#B5621E]/30',
  closed: 'bg-zinc-800 text-zinc-400',
};

type FormWithMeta = Form & {
  trips?: { id: string; name: string; slug: string } | null;
  form_assignments?: { count: number }[];
  form_responses?: { count: number }[];
};

type NewFieldDraft = {
  field_type: FormFieldType;
  label: string;
  placeholder: string;
  helper_text: string;
  is_required: boolean;
  options: string[];  // displayed as textarea, one per line
};

// ── Main page ────────────────────────────────────────────────
export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create form modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDesc, setNewFormDesc] = useState('');

  // Edit / builder state
  const [editingForm, setEditingForm] = useState<FormWithMeta | null>(null);
  const [fields, setFields]           = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [savingField, setSavingField]     = useState(false);
  const [showAddField, setShowAddField]   = useState(false);
  const [newField, setNewField] = useState<NewFieldDraft>({
    field_type: 'short_text', label: '', placeholder: '',
    helper_text: '', is_required: false, options: [],
  });
  const [editFieldId, setEditFieldId] = useState<string | null>(null);

  // Assign panel
  const [showAssign, setShowAssign] = useState(false);
  const [members, setMembers]       = useState<{ id: string; full_name: string | null; first_name: string | null; surname: string | null; email: string }[]>([]);
  const [assignments, setAssignments] = useState<string[]>([]);   // member_ids already assigned
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign]   = useState(false);
  const [assignSearch, setAssignSearch]   = useState('');

  // Responses panel
  const [showResponses, setShowResponses] = useState(false);
  const [responses, setResponses]         = useState<any[]>([]);
  const [loadingResp, setLoadingResp]     = useState(false);

  // ── helpers ─────────────────────────────────────────────────
  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const memberName = (m: { full_name: string | null; first_name: string | null; surname: string | null }) =>
    [m.first_name, m.surname].filter(Boolean).join(' ') || m.full_name || '—';

  const assignmentCount = (f: FormWithMeta) => f.form_assignments?.[0]?.count ?? 0;
  const responseCount   = (f: FormWithMeta) => f.form_responses?.[0]?.count ?? 0;

  // ── data loading ────────────────────────────────────────────
  const loadForms = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/forms');
    const json = await res.json();
    setForms(json.success ? json.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);

  const loadFields = useCallback(async (formId: string) => {
    setLoadingFields(true);
    const res = await fetch(`/api/forms/${formId}/fields`);
    const json = await res.json();
    setFields(json.success ? json.data : []);
    setLoadingFields(false);
  }, []);

  const loadAssignments = useCallback(async (formId: string) => {
    setLoadingAssign(true);
    const [membersRes, assignRes] = await Promise.all([
      fetch('/api/members'),
      fetch(`/api/forms/${formId}/assign`),
    ]);
    const [membersJson, assignJson] = await Promise.all([membersRes.json(), assignRes.json()]);
    setMembers(membersJson.success ? membersJson.data : []);
    setAssignments(assignJson.success ? assignJson.data.map((a: any) => a.member_id) : []);
    setLoadingAssign(false);
  }, []);

  const loadResponses = useCallback(async (formId: string) => {
    setLoadingResp(true);
    const res = await fetch(`/api/forms/${formId}/responses`);
    const json = await res.json();
    setResponses(json.success ? json.data : []);
    setLoadingResp(false);
  }, []);

  // ── create form ─────────────────────────────────────────────
  async function handleCreate() {
    if (!newFormTitle.trim()) return;
    setCreating(true);
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newFormTitle.trim(), description: newFormDesc.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.success) {
      setShowCreate(false);
      setNewFormTitle('');
      setNewFormDesc('');
      flash('success', 'Form created');
      loadForms();
    } else {
      flash('error', json.error || 'Failed to create form');
    }
  }

  // ── open builder ────────────────────────────────────────────
  async function openBuilder(form: FormWithMeta) {
    setEditingForm(form);
    setShowAddField(false);
    setEditFieldId(null);
    setShowAssign(false);
    setShowResponses(false);
    await loadFields(form.id);
  }

  // ── status change ────────────────────────────────────────────
  async function updateStatus(formId: string, status: FormStatus) {
    const res = await fetch(`/api/forms/${formId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.success) {
      flash('success', `Form marked as ${status}`);
      loadForms();
      if (editingForm?.id === formId) setEditingForm({ ...editingForm, status });
    } else {
      flash('error', json.error || 'Failed to update status');
    }
  }

  // ── delete form ─────────────────────────────────────────────
  async function deleteForm(formId: string) {
    if (!confirm('Delete this form and all its responses? This cannot be undone.')) return;
    const res = await fetch(`/api/forms/${formId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      flash('success', 'Form deleted');
      if (editingForm?.id === formId) setEditingForm(null);
      loadForms();
    } else {
      flash('error', json.error || 'Failed to delete');
    }
  }

  // ── add field ────────────────────────────────────────────────
  async function handleAddField() {
    if (!editingForm || !newField.label.trim()) return;
    setSavingField(true);
    const body = {
      ...newField,
      options: newField.options.length ? newField.options : null,
    };
    const res = await fetch(`/api/forms/${editingForm.id}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSavingField(false);
    if (json.success) {
      setShowAddField(false);
      setNewField({ field_type: 'short_text', label: '', placeholder: '', helper_text: '', is_required: false, options: [] });
      loadFields(editingForm.id);
    } else {
      flash('error', json.error || 'Failed to add field');
    }
  }

  // ── delete field ─────────────────────────────────────────────
  async function handleDeleteField(fieldId: string) {
    if (!editingForm) return;
    if (!confirm('Remove this field? Existing response data will be deleted.')) return;
    await fetch(`/api/forms/${editingForm.id}/fields/${fieldId}`, { method: 'DELETE' });
    loadFields(editingForm.id);
  }

  // ── move field ───────────────────────────────────────────────
  async function moveField(index: number, dir: -1 | 1) {
    if (!editingForm) return;
    const updated = [...fields];
    const swap = index + dir;
    if (swap < 0 || swap >= updated.length) return;
    [updated[index], updated[swap]] = [updated[swap], updated[index]];
    const reordered = updated.map((f, i) => ({ ...f, sort_order: i }));
    setFields(reordered);
    await fetch(`/api/forms/${editingForm.id}/fields`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: reordered.map((f) => ({ id: f.id, sort_order: f.sort_order })) }),
    });
  }

  // ── assignments ──────────────────────────────────────────────
  async function openAssignPanel() {
    if (!editingForm) return;
    setShowAssign(true);
    setShowResponses(false);
    await loadAssignments(editingForm.id);
  }

  async function toggleAssignment(memberId: string) {
    if (!editingForm) return;
    const isAssigned = assignments.includes(memberId);
    setSavingAssign(true);
    if (isAssigned) {
      await fetch(`/api/forms/${editingForm.id}/assign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      setAssignments((prev) => prev.filter((id) => id !== memberId));
    } else {
      await fetch(`/api/forms/${editingForm.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      setAssignments((prev) => [...prev, memberId]);
    }
    setSavingAssign(false);
  }

  async function assignAll() {
    if (!editingForm) return;
    setSavingAssign(true);
    await fetch(`/api/forms/${editingForm.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_ids: 'all' }),
    });
    setSavingAssign(false);
    await loadAssignments(editingForm.id);
    flash('success', 'Assigned to all active members');
  }

  // ── responses ─────────────────────────────────────────────────
  async function openResponsesPanel() {
    if (!editingForm) return;
    setShowResponses(true);
    setShowAssign(false);
    await loadResponses(editingForm.id);
  }

  // ── copy share link ───────────────────────────────────────────
  function copyShareLink(form: FormWithMeta) {
    const url = `${window.location.origin}/forms/${form.token}`;
    navigator.clipboard.writeText(url);
    flash('success', 'Share link copied to clipboard');
  }

  // ── filtered members ──────────────────────────────────────────
  const filteredMembers = members.filter((m) => {
    if (!assignSearch) return true;
    const name = memberName(m).toLowerCase();
    return name.includes(assignSearch.toLowerCase()) || m.email.toLowerCase().includes(assignSearch.toLowerCase());
  });

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Form Builder</h1>
          <p className="text-zinc-400 text-sm mt-1">Create forms, assign to members, collect responses</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus size={16} /> New Form
        </Button>
      </div>

      {/* Flash */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-900/30 border border-green-700/40 text-green-300'
            : 'bg-red-900/30 border border-red-700/40 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {message.text}
        </div>
      )}

      {/* ── Create form modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-zinc-700 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-white font-semibold text-lg">New Form</h2>
            <div className="space-y-3">
              <div>
                <label className="text-zinc-400 text-sm block mb-1">Form title *</label>
                <Input
                  value={newFormTitle}
                  onChange={(e) => setNewFormTitle(e.target.value)}
                  placeholder="e.g. Morocco 2027 Pre-Trip Info"
                  className="w-full"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div>
                <label className="text-zinc-400 text-sm block mb-1">Description (optional)</label>
                <textarea
                  value={newFormDesc}
                  onChange={(e) => setNewFormDesc(e.target.value)}
                  placeholder="Brief description shown to members"
                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none h-20 focus:outline-none focus:border-[#B5621E]"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreate} disabled={!newFormTitle.trim() || creating} className="flex-1">
                {creating ? <Spinner size="sm" /> : 'Create Form'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-column layout when a form is open ── */}
      <div className={`grid gap-6 ${editingForm ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>

        {/* Forms list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : forms.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-zinc-500">No forms yet — create your first one above.</CardContent></Card>
          ) : (
            forms.map((form) => (
              <Card
                key={form.id}
                className={`cursor-pointer transition-all ${editingForm?.id === form.id ? 'border-[#B5621E]/50 bg-[#B5621E]/5' : 'hover:border-zinc-600'}`}
                onClick={() => openBuilder(form)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium truncate">{form.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[form.status]}`}>
                          {form.status}
                        </span>
                      </div>
                      {form.description && (
                        <p className="text-zinc-400 text-sm mt-1 line-clamp-1">{form.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-zinc-500 text-xs">
                        <span className="flex items-center gap-1"><Users size={11} /> {assignmentCount(form)} assigned</span>
                        <span className="flex items-center gap-1"><ClipboardList size={11} /> {responseCount(form)} responses</span>
                        {form.trips && <span className="text-[#C9B98A]">{form.trips.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyShareLink(form); }}
                        className="p-1.5 text-zinc-500 hover:text-[#C9B98A] transition-colors"
                        title="Copy share link"
                      >
                        <Link2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteForm(form.id); }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete form"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── Builder panel ── */}
        {editingForm && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{editingForm.title}</CardTitle>
                  <button onClick={() => setEditingForm(null)} className="text-zinc-500 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[editingForm.status]}`}>
                    {editingForm.status}
                  </span>
                  {editingForm.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'active')}>
                      Publish
                    </Button>
                  )}
                  {editingForm.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'closed')}>
                      Close form
                    </Button>
                  )}
                  {editingForm.status === 'closed' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'active')}>
                      Re-open
                    </Button>
                  )}
                  <button
                    onClick={() => copyShareLink(editingForm)}
                    className="ml-auto flex items-center gap-1 text-xs text-[#C9B98A] hover:text-[#B5621E] transition-colors"
                  >
                    <Link2 size={12} /> Copy share link
                  </button>
                </div>

                {/* Tab navigation */}
                <div className="flex border-b border-zinc-800">
                  {[
                    { id: 'fields',    label: 'Fields',    icon: <FileText size={13} /> },
                    { id: 'assign',    label: 'Assign',    icon: <Users size={13} /> },
                    { id: 'responses', label: 'Responses', icon: <ClipboardList size={13} /> },
                  ].map((tab) => {
                    const active = (tab.id === 'fields' && !showAssign && !showResponses)
                      || (tab.id === 'assign' && showAssign)
                      || (tab.id === 'responses' && showResponses);
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (tab.id === 'fields')    { setShowAssign(false); setShowResponses(false); }
                          if (tab.id === 'assign')    openAssignPanel();
                          if (tab.id === 'responses') openResponsesPanel();
                        }}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
                          active
                            ? 'border-[#B5621E] text-[#B5621E]'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* ── Fields tab ── */}
                {!showAssign && !showResponses && (
                  <div className="space-y-2">
                    {loadingFields ? (
                      <div className="flex justify-center py-6"><Spinner /></div>
                    ) : (
                      <>
                        {fields.length === 0 && (
                          <p className="text-zinc-500 text-sm text-center py-4">No fields yet — add one below.</p>
                        )}
                        {fields.map((field, idx) => (
                          <div key={field.id} className="flex items-start gap-2 bg-zinc-900/50 rounded-lg px-3 py-2.5 border border-zinc-800">
                            <span className="text-zinc-600 mt-0.5"><GripVertical size={14} /></span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-sm font-medium truncate">{field.label}</span>
                                {field.is_required && <span className="text-[#B5621E] text-xs">*</span>}
                                <span className="text-zinc-600 text-xs ml-auto">{FIELD_TYPES.find(t => t.value === field.field_type)?.label}</span>
                              </div>
                              {field.helper_text && (
                                <p className="text-zinc-500 text-xs mt-0.5 truncate">{field.helper_text}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30">
                                <ChevronUp size={13} />
                              </button>
                              <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30">
                                <ChevronDown size={13} />
                              </button>
                              <button onClick={() => handleDeleteField(field.id)} className="text-zinc-600 hover:text-red-400">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Add field form */}
                        {showAddField ? (
                          <div className="border border-zinc-700 rounded-lg p-4 space-y-3 bg-zinc-900/30">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Field type</label>
                                <select
                                  value={newField.field_type}
                                  onChange={(e) => setNewField(p => ({ ...p, field_type: e.target.value as FormFieldType }))}
                                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#B5621E]"
                                >
                                  {FIELD_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Label *</label>
                                <Input
                                  value={newField.label}
                                  onChange={(e) => setNewField(p => ({ ...p, label: e.target.value }))}
                                  placeholder="e.g. Passport number"
                                  className="w-full text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Placeholder</label>
                                <Input
                                  value={newField.placeholder}
                                  onChange={(e) => setNewField(p => ({ ...p, placeholder: e.target.value }))}
                                  className="w-full text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Helper text</label>
                                <Input
                                  value={newField.helper_text}
                                  onChange={(e) => setNewField(p => ({ ...p, helper_text: e.target.value }))}
                                  className="w-full text-sm"
                                />
                              </div>
                            </div>
                            {FIELD_TYPES.find(t => t.value === newField.field_type)?.hasOptions && (
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Options (one per line)</label>
                                <textarea
                                  value={newField.options.join('\n')}
                                  onChange={(e) => setNewField(p => ({
                                    ...p,
                                    options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                                  }))}
                                  placeholder="Option A&#10;Option B&#10;Option C"
                                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none h-20 focus:outline-none focus:border-[#B5621E]"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newField.is_required}
                                  onChange={(e) => setNewField(p => ({ ...p, is_required: e.target.checked }))}
                                  className="accent-[#B5621E]"
                                />
                                Required
                              </label>
                              <div className="ml-auto flex gap-2">
                                <Button size="sm" onClick={handleAddField} disabled={!newField.label.trim() || savingField}>
                                  {savingField ? <Spinner size="sm" /> : 'Add Field'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowAddField(false)}>Cancel</Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowAddField(true)}
                            className="w-full border border-dashed border-zinc-700 rounded-lg py-3 text-zinc-500 hover:text-[#C9B98A] hover:border-[#C9B98A]/50 text-sm flex items-center justify-center gap-2 transition-colors"
                          >
                            <Plus size={14} /> Add field
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── Assign tab ── */}
                {showAssign && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Search members…"
                        className="flex-1 text-sm"
                      />
                      <Button size="sm" variant="outline" onClick={assignAll} disabled={savingAssign}>
                        Assign All
                      </Button>
                    </div>
                    {loadingAssign ? (
                      <div className="flex justify-center py-6"><Spinner /></div>
                    ) : (
                      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                        {filteredMembers.map((m) => {
                          const assigned = assignments.includes(m.id);
                          return (
                            <div
                              key={m.id}
                              onClick={() => toggleAssignment(m.id)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                assigned
                                  ? 'bg-[#B5621E]/10 border border-[#B5621E]/30'
                                  : 'hover:bg-zinc-800/50'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                assigned ? 'bg-[#B5621E] border-[#B5621E]' : 'border-zinc-600'
                              }`}>
                                {assigned && <CheckCircle size={10} className="text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-white text-sm">{memberName(m)}</span>
                                <span className="text-zinc-500 text-xs ml-2">{m.email}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-zinc-600 text-xs">{assignments.length} member{assignments.length !== 1 ? 's' : ''} assigned</p>
                  </div>
                )}

                {/* ── Responses tab ── */}
                {showResponses && (
                  <div className="space-y-3">
                    {loadingResp ? (
                      <div className="flex justify-center py-6"><Spinner /></div>
                    ) : responses.length === 0 ? (
                      <p className="text-zinc-500 text-sm text-center py-4">No responses yet.</p>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {responses.map((resp: any) => (
                          <div key={resp.id} className="border border-zinc-800 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-white text-sm font-medium">
                                {resp.member
                                  ? [resp.member.first_name, resp.member.surname].filter(Boolean).join(' ') || resp.member.email
                                  : 'Anonymous'}
                              </span>
                              <span className="text-zinc-500 text-xs">
                                {resp.submitted_at ? new Date(resp.submitted_at).toLocaleDateString('en-AU') : '—'}
                              </span>
                            </div>
                            {(resp.form_response_values || [])
                              .sort((a: any, b: any) => (a.form_fields?.sort_order ?? 0) - (b.form_fields?.sort_order ?? 0))
                              .map((val: any) => (
                                <div key={val.id} className="text-xs">
                                  <span className="text-zinc-400">{val.form_fields?.label}: </span>
                                  <span className="text-zinc-200">
                                    {val.value_json != null
                                      ? (Array.isArray(val.value_json) ? val.value_json.join(', ') : JSON.stringify(val.value_json))
                                      : val.value_text || '—'}
                                  </span>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
