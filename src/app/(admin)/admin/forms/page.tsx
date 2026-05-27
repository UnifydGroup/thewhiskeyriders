'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
  Plus, Trash2, Users, ClipboardList,
  ChevronDown, ChevronUp, GripVertical, X, Link2,
  CheckSquare, AlignLeft, Hash, Calendar, List, ToggleLeft,
  Upload, Minus, AlertCircle, CheckCircle, FileText,
  BookOpen, Sparkles, Search, Tag, RefreshCw,
} from 'lucide-react';
import type { Form, FormField, FormFieldLibrary, FormFieldType, FormStatus } from '@/lib/types/database';

// ── Field type config ────────────────────────────────────────
const FIELD_TYPES: { value: FormFieldType; label: string; icon: React.ReactNode; hasOptions: boolean }[] = [
  { value: 'short_text',      label: 'Short text',       icon: <AlignLeft size={14} />,   hasOptions: false },
  { value: 'long_text',       label: 'Long text',        icon: <AlignLeft size={14} />,   hasOptions: false },
  { value: 'number',          label: 'Number',           icon: <Hash size={14} />,        hasOptions: false },
  { value: 'currency',        label: 'Currency',         icon: <Hash size={14} />,        hasOptions: false },
  { value: 'date',            label: 'Date',             icon: <Calendar size={14} />,    hasOptions: false },
  { value: 'date_range',      label: 'Date range',       icon: <Calendar size={14} />,    hasOptions: false },
  { value: 'single_choice',   label: 'Single choice',    icon: <List size={14} />,        hasOptions: true  },
  { value: 'multiple_choice', label: 'Multiple choice',  icon: <CheckSquare size={14} />, hasOptions: true  },
  { value: 'dropdown',        label: 'Dropdown',         icon: <ChevronDown size={14} />, hasOptions: true  },
  { value: 'yes_no',          label: 'Yes / No',         icon: <ToggleLeft size={14} />,  hasOptions: false },
  { value: 'file_upload',     label: 'File upload',      icon: <Upload size={14} />,      hasOptions: false },
  { value: 'section_header',  label: 'Section header',   icon: <Minus size={14} />,       hasOptions: false },
  { value: 'acknowledgement', label: 'Acknowledgement',  icon: <CheckSquare size={14} />, hasOptions: false },
];

const LIBRARY_CATEGORIES = ['Profile', 'Address', 'Travel', 'Medical', 'Personal', 'Trip', 'Equipment', 'Logistics', 'Other'];

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

type FormFieldWithLib = FormField & {
  library_field?: Pick<FormFieldLibrary, 'id' | 'category' | 'use_count' | 'description'> | null;
};

type NewFieldDraft = {
  field_type: FormFieldType;
  label: string;
  placeholder: string;
  helper_text: string;
  is_required: boolean;
  options: string[];
  category: string;
};

// ── Main page ────────────────────────────────────────────────
export default function AdminFormsPage() {
  const [forms, setForms]   = useState<FormWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create form modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDesc, setNewFormDesc]   = useState('');

  // Edit / builder state
  const [editingForm, setEditingForm]       = useState<FormWithMeta | null>(null);
  const [fields, setFields]                 = useState<FormFieldWithLib[]>([]);
  const [loadingFields, setLoadingFields]   = useState(false);
  const [savingField, setSavingField]       = useState(false);

  // Add-field panel — mode: 'none' | 'library' | 'new'
  const [addMode, setAddMode] = useState<'none' | 'library' | 'new'>('none');
  const [newField, setNewField] = useState<NewFieldDraft>({
    field_type: 'short_text', label: '', placeholder: '',
    helper_text: '', is_required: false, options: [],
    category: '',
  });

  // Library picker state
  const [libraryFields, setLibraryFields]       = useState<FormFieldLibrary[]>([]);
  const [librarySearch, setLibrarySearch]       = useState('');
  const [libraryCategory, setLibraryCategory]   = useState('');
  const [loadingLibrary, setLoadingLibrary]     = useState(false);
  const libraryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Assign / responses / tab state
  const [activeTab, setActiveTab] = useState<'fields' | 'assign' | 'responses'>('fields');
  const [members, setMembers]           = useState<any[]>([]);
  const [assignments, setAssignments]   = useState<string[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign]   = useState(false);
  const [assignSearch, setAssignSearch]   = useState('');
  const [responses, setResponses]         = useState<any[]>([]);
  const [loadingResp, setLoadingResp]     = useState(false);

  // ── helpers ──────────────────────────────────────────────────
  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const memberName = (m: any) =>
    [m.first_name, m.surname].filter(Boolean).join(' ') || m.full_name || '—';

  // ── data loaders ─────────────────────────────────────────────
  const loadForms = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/forms');
    const json = await res.json();
    setForms(json.success ? json.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);

  const loadFields = useCallback(async (formId: string) => {
    setLoadingFields(true);
    const res  = await fetch(`/api/forms/${formId}/fields`);
    const json = await res.json();
    setFields(json.success ? json.data : []);
    setLoadingFields(false);
  }, []);

  const loadLibrary = useCallback(async (search = '', category = '') => {
    setLoadingLibrary(true);
    const params = new URLSearchParams();
    if (search)   params.set('search', search);
    if (category) params.set('category', category);
    const res  = await fetch(`/api/forms/field-library?${params}`);
    const json = await res.json();
    setLibraryFields(json.success ? json.data : []);
    setLoadingLibrary(false);
  }, []);

  const loadAssignments = useCallback(async (formId: string) => {
    setLoadingAssign(true);
    const [mr, ar] = await Promise.all([
      fetch('/api/members'),
      fetch(`/api/forms/${formId}/assign`),
    ]);
    const [mj, aj] = await Promise.all([mr.json(), ar.json()]);
    setMembers(mj.success ? mj.data : []);
    setAssignments(aj.success ? aj.data.map((a: any) => a.member_id) : []);
    setLoadingAssign(false);
  }, []);

  const loadResponses = useCallback(async (formId: string) => {
    setLoadingResp(true);
    const res  = await fetch(`/api/forms/${formId}/responses`);
    const json = await res.json();
    setResponses(json.success ? json.data : []);
    setLoadingResp(false);
  }, []);

  // ── open builder ─────────────────────────────────────────────
  async function openBuilder(form: FormWithMeta) {
    setEditingForm(form);
    setAddMode('none');
    setActiveTab('fields');
    await loadFields(form.id);
  }

  // ── create form ──────────────────────────────────────────────
  async function handleCreate() {
    if (!newFormTitle.trim()) return;
    setCreating(true);
    const res  = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newFormTitle.trim(), description: newFormDesc.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.success) {
      setShowCreate(false); setNewFormTitle(''); setNewFormDesc('');
      flash('success', 'Form created'); loadForms();
    } else flash('error', json.error || 'Failed to create form');
  }

  // ── status change ────────────────────────────────────────────
  async function updateStatus(formId: string, status: FormStatus) {
    const res  = await fetch(`/api/forms/${formId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.success) {
      flash('success', `Form ${status}`); loadForms();
      if (editingForm?.id === formId) setEditingForm({ ...editingForm, status });
    } else flash('error', json.error || 'Update failed');
  }

  // ── delete form ──────────────────────────────────────────────
  async function deleteForm(formId: string) {
    if (!confirm('Delete this form and all its responses? This cannot be undone.')) return;
    const res  = await fetch(`/api/forms/${formId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      flash('success', 'Deleted');
      if (editingForm?.id === formId) setEditingForm(null);
      loadForms();
    } else flash('error', json.error || 'Delete failed');
  }

  // ── add field: from library ──────────────────────────────────
  async function handleAddFromLibrary(libField: FormFieldLibrary) {
    if (!editingForm) return;
    setSavingField(true);
    const res  = await fetch(`/api/forms/${editingForm.id}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library_field_id: libField.id }),
    });
    const json = await res.json();
    setSavingField(false);
    if (json.success) {
      loadFields(editingForm.id);
      flash('success', `"${libField.label}" added`);
    } else flash('error', json.error || 'Failed to add field');
  }

  // ── add field: new ───────────────────────────────────────────
  async function handleAddNewField() {
    if (!editingForm || !newField.label.trim()) return;
    setSavingField(true);
    const body = {
      ...newField,
      options:          newField.options.length ? newField.options : null,
      category:         newField.category || null,
      save_to_library:  true,   // Always save to library — keeps library & form_fields in sync
    };
    const res  = await fetch(`/api/forms/${editingForm.id}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSavingField(false);
    if (json.success) {
      setAddMode('none');
      setNewField({
        field_type: 'short_text', label: '', placeholder: '',
        helper_text: '', is_required: false, options: [],
        category: '',
      });
      loadFields(editingForm.id);
      flash('success', 'Field added');
    } else flash('error', json.error || 'Failed to add field');
  }

  // ── delete field ─────────────────────────────────────────────
  async function handleDeleteField(fieldId: string) {
    if (!editingForm) return;
    if (!confirm('Remove this field? Existing response data will be deleted.')) return;
    await fetch(`/api/forms/${editingForm.id}/fields/${fieldId}`, { method: 'DELETE' });
    loadFields(editingForm.id);
  }

  // ── reorder fields ───────────────────────────────────────────
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
  async function switchTab(tab: 'fields' | 'assign' | 'responses') {
    setActiveTab(tab);
    setAddMode('none');
    if (!editingForm) return;
    if (tab === 'assign') await loadAssignments(editingForm.id);
    if (tab === 'responses') await loadResponses(editingForm.id);
  }

  async function toggleAssignment(memberId: string) {
    if (!editingForm) return;
    const assigned = assignments.includes(memberId);
    setSavingAssign(true);
    if (assigned) {
      await fetch(`/api/forms/${editingForm.id}/assign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      setAssignments(p => p.filter(id => id !== memberId));
    } else {
      await fetch(`/api/forms/${editingForm.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      setAssignments(p => [...p, memberId]);
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

  // ── library search debounce ──────────────────────────────────
  function onLibrarySearch(val: string) {
    setLibrarySearch(val);
    if (libraryDebounce.current) clearTimeout(libraryDebounce.current);
    libraryDebounce.current = setTimeout(() => loadLibrary(val, libraryCategory), 300);
  }

  function onLibraryCategoryChange(val: string) {
    setLibraryCategory(val);
    loadLibrary(librarySearch, val);
  }

  // Open library mode
  function openLibraryPicker() {
    setAddMode('library');
    setLibrarySearch('');
    setLibraryCategory('');
    loadLibrary('', '');
  }

  // ── copy share link ──────────────────────────────────────────
  function copyShareLink(form: FormWithMeta) {
    navigator.clipboard.writeText(`${window.location.origin}/forms/${form.token}`);
    flash('success', 'Share link copied');
  }

  // ── filtered members ─────────────────────────────────────────
  const filteredMembers = members.filter(m => {
    if (!assignSearch) return true;
    return memberName(m).toLowerCase().includes(assignSearch.toLowerCase())
      || m.email?.toLowerCase().includes(assignSearch.toLowerCase());
  });

  // ── library fields already on this form ──────────────────────
  const usedLibraryIds = new Set(fields.map(f => f.library_field_id).filter(Boolean));

  // ── count helpers ─────────────────────────────────────────────
  const assignmentCount = (f: FormWithMeta) => f.form_assignments?.[0]?.count ?? 0;
  const responseCount   = (f: FormWithMeta) => f.form_responses?.[0]?.count   ?? 0;

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
                <Input value={newFormTitle} onChange={e => setNewFormTitle(e.target.value)}
                  placeholder="e.g. Morocco 2027 Pre-Trip Info" className="w-full"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              </div>
              <div>
                <label className="text-zinc-400 text-sm block mb-1">Description (optional)</label>
                <textarea value={newFormDesc} onChange={e => setNewFormDesc(e.target.value)}
                  placeholder="Brief description shown to members"
                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none h-20 focus:outline-none focus:border-[#B5621E]" />
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

      {/* ── Two-column layout ── */}
      <div className={`grid gap-6 ${editingForm ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>

        {/* Forms list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : forms.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-zinc-500">
              No forms yet — create one above.
            </CardContent></Card>
          ) : forms.map(form => (
            <Card key={form.id}
              className={`cursor-pointer transition-all ${editingForm?.id === form.id ? 'border-[#B5621E]/50 bg-[#B5621E]/5' : 'hover:border-zinc-600'}`}
              onClick={() => openBuilder(form)}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium truncate">{form.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[form.status]}`}>
                        {form.status}
                      </span>
                    </div>
                    {form.description && <p className="text-zinc-400 text-sm mt-1 line-clamp-1">{form.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-zinc-500 text-xs">
                      <span className="flex items-center gap-1"><Users size={11} /> {assignmentCount(form)} assigned</span>
                      <span className="flex items-center gap-1"><ClipboardList size={11} /> {responseCount(form)} responses</span>
                      {form.trips && <span className="text-[#C9B98A]">{form.trips.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); copyShareLink(form); }}
                      className="p-1.5 text-zinc-500 hover:text-[#C9B98A] transition-colors" title="Copy share link">
                      <Link2 size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteForm(form.id); }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors" title="Delete form">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                  {editingForm.status === 'draft'  && <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'active')}>Publish</Button>}
                  {editingForm.status === 'active' && <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'closed')}>Close</Button>}
                  {editingForm.status === 'closed' && <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'active')}>Re-open</Button>}
                  <button onClick={() => copyShareLink(editingForm)}
                    className="ml-auto flex items-center gap-1 text-xs text-[#C9B98A] hover:text-[#B5621E] transition-colors">
                    <Link2 size={12} /> Copy share link
                  </button>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-zinc-800">
                  {([
                    { id: 'fields',    label: 'Fields',    icon: <FileText size={13} /> },
                    { id: 'assign',    label: 'Assign',    icon: <Users size={13} /> },
                    { id: 'responses', label: 'Responses', icon: <ClipboardList size={13} /> },
                  ] as const).map(tab => (
                    <button key={tab.id}
                      onClick={() => switchTab(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-[#B5621E] text-[#B5621E]'
                          : 'border-transparent text-zinc-500 hover:text-zinc-300'
                      }`}>
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* ══ FIELDS TAB ══ */}
                {activeTab === 'fields' && (
                  <div className="space-y-2">
                    {loadingFields ? (
                      <div className="flex justify-center py-6"><Spinner /></div>
                    ) : (
                      <>
                        {fields.length === 0 && addMode === 'none' && (
                          <p className="text-zinc-500 text-sm text-center py-4">No fields yet — add one below.</p>
                        )}

                        {/* Field list */}
                        {fields.map((field, idx) => (
                          <div key={field.id}
                            className="flex items-start gap-2 bg-zinc-900/50 rounded-lg px-3 py-2.5 border border-zinc-800">
                            <span className="text-zinc-600 mt-0.5"><GripVertical size={14} /></span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white text-sm font-medium truncate">{field.label}</span>
                                {field.is_required && <span className="text-[#B5621E] text-xs">*</span>}
                                <span className="text-zinc-600 text-xs ml-auto">
                                  {FIELD_TYPES.find(t => t.value === field.field_type)?.label}
                                </span>
                                {/* Library badge */}
                                {field.library_field_id && (
                                  <span className="flex items-center gap-1 text-[10px] text-[#C9B98A]/70 bg-[#C9B98A]/5 border border-[#C9B98A]/15 px-1.5 py-0.5 rounded-full">
                                    <BookOpen size={9} />
                                    {field.library_field?.category || 'Library'}
                                    {(field.library_field?.use_count ?? 0) > 1 && (
                                      <span className="text-zinc-600">· {field.library_field?.use_count} forms</span>
                                    )}
                                  </span>
                                )}
                                {(field.library_field as any)?.settings?.profiles_column && (
                                  <span className="text-[10px] text-blue-400/60 bg-blue-900/15 border border-blue-700/20 px-1.5 py-0.5 rounded-full" title={`Synced to profiles.${(field.library_field as any).settings.profiles_column}`}>
                                    ⇄ profile
                                  </span>
                                )}
                              </div>
                              {field.helper_text && (
                                <p className="text-zinc-500 text-xs mt-0.5 truncate">{field.helper_text}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => moveField(idx, -1)} disabled={idx === 0}
                                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp size={13} /></button>
                              <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}
                                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown size={13} /></button>
                              <button onClick={() => handleDeleteField(field.id)}
                                className="text-zinc-600 hover:text-red-400"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        ))}

                        {/* ── Add field buttons (when no panel open) ── */}
                        {addMode === 'none' && (
                          <div className="flex gap-2 pt-1">
                            <button onClick={openLibraryPicker}
                              className="flex-1 border border-dashed border-[#C9B98A]/30 rounded-lg py-2.5 text-[#C9B98A]/70 hover:text-[#C9B98A] hover:border-[#C9B98A]/60 text-xs flex items-center justify-center gap-1.5 transition-colors">
                              <BookOpen size={13} /> Pick from Library
                            </button>
                            <button onClick={() => setAddMode('new')}
                              className="flex-1 border border-dashed border-zinc-700 rounded-lg py-2.5 text-zinc-500 hover:text-[#C9B98A] hover:border-[#C9B98A]/50 text-xs flex items-center justify-center gap-1.5 transition-colors">
                              <Sparkles size={13} /> Create New Field
                            </button>
                          </div>
                        )}

                        {/* ══ LIBRARY PICKER PANEL ══ */}
                        {addMode === 'library' && (
                          <div className="border border-[#C9B98A]/20 rounded-lg bg-[#C9B98A]/3 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[#C9B98A] text-sm font-medium flex items-center gap-1.5">
                                <BookOpen size={14} /> Field Library
                              </span>
                              <button onClick={() => setAddMode('none')}
                                className="text-zinc-500 hover:text-white"><X size={14} /></button>
                            </div>

                            {/* Search + category filter */}
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                                <input
                                  value={librarySearch}
                                  onChange={e => onLibrarySearch(e.target.value)}
                                  placeholder="Search fields…"
                                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-[#B5621E]"
                                />
                              </div>
                              <select
                                value={libraryCategory}
                                onChange={e => onLibraryCategoryChange(e.target.value)}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-[#B5621E]"
                              >
                                <option value="">All categories</option>
                                {LIBRARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <button onClick={() => loadLibrary(librarySearch, libraryCategory)}
                                className="text-zinc-500 hover:text-zinc-300 p-1.5">
                                <RefreshCw size={13} />
                              </button>
                            </div>

                            {/* Library results */}
                            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                              {loadingLibrary ? (
                                <div className="flex justify-center py-4"><Spinner /></div>
                              ) : libraryFields.length === 0 ? (
                                <p className="text-zinc-500 text-xs text-center py-4">
                                  No library fields found.{' '}
                                  <button className="text-[#C9B98A] underline" onClick={() => setAddMode('new')}>
                                    Create one?
                                  </button>
                                </p>
                              ) : (
                                libraryFields.map(lf => {
                                  const alreadyAdded = usedLibraryIds.has(lf.id);
                                  return (
                                    <div key={lf.id}
                                      onClick={() => !alreadyAdded && !savingField && handleAddFromLibrary(lf)}
                                      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                                        alreadyAdded
                                          ? 'border-zinc-800 opacity-40 cursor-not-allowed'
                                          : 'border-zinc-800 hover:border-[#C9B98A]/40 hover:bg-[#C9B98A]/5 cursor-pointer'
                                      }`}>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-white text-sm font-medium">{lf.label}</span>
                                          <span className="text-zinc-600 text-xs">
                                            {FIELD_TYPES.find(t => t.value === lf.field_type)?.label}
                                          </span>
                                          {lf.category && (
                                            <span className="flex items-center gap-0.5 text-[10px] text-[#C9B98A]/60 bg-[#C9B98A]/8 px-1.5 py-0.5 rounded-full border border-[#C9B98A]/15">
                                              <Tag size={8} /> {lf.category}
                                            </span>
                                          )}
                                          {lf.settings?.profiles_column && (
                                            <span className="flex items-center gap-0.5 text-[10px] text-blue-400/70 bg-blue-900/20 px-1.5 py-0.5 rounded-full border border-blue-700/20" title="Synced to member profile">
                                              ⇄ profile
                                            </span>
                                          )}
                                        </div>
                                        {lf.description && (
                                          <p className="text-zinc-500 text-xs mt-0.5 truncate">{lf.description}</p>
                                        )}
                                        <p className="text-zinc-600 text-xs mt-0.5">
                                          Used in {lf.use_count} form{lf.use_count !== 1 ? 's' : ''}
                                          {lf.options?.length ? ` · ${lf.options.length} options` : ''}
                                          {lf.settings?.profiles_column ? ` · profiles.${lf.settings.profiles_column}` : ''}
                                        </p>
                                      </div>
                                      {alreadyAdded ? (
                                        <span className="text-xs text-zinc-600 mt-0.5">Added</span>
                                      ) : (
                                        <Plus size={14} className="text-[#C9B98A]/60 mt-0.5 shrink-0" />
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            <div className="pt-1 border-t border-zinc-800 flex items-center justify-between">
                              <span className="text-zinc-600 text-xs">{libraryFields.length} field{libraryFields.length !== 1 ? 's' : ''} in library</span>
                              <button onClick={() => setAddMode('new')}
                                className="text-xs text-[#C9B98A]/70 hover:text-[#C9B98A] flex items-center gap-1">
                                <Sparkles size={11} /> Create new instead
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ══ CREATE NEW FIELD PANEL ══ */}
                        {addMode === 'new' && (
                          <div className="border border-zinc-700 rounded-lg p-4 space-y-3 bg-zinc-900/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-zinc-300 text-sm font-medium flex items-center gap-1.5">
                                <Sparkles size={14} /> New Field
                              </span>
                              <button onClick={() => setAddMode('none')}
                                className="text-zinc-500 hover:text-white"><X size={14} /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Field type</label>
                                <select
                                  value={newField.field_type}
                                  onChange={e => setNewField(p => ({ ...p, field_type: e.target.value as FormFieldType }))}
                                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#B5621E]">
                                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Label *</label>
                                <Input value={newField.label}
                                  onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
                                  placeholder="e.g. Passport number" className="w-full text-sm" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Placeholder</label>
                                <Input value={newField.placeholder}
                                  onChange={e => setNewField(p => ({ ...p, placeholder: e.target.value }))}
                                  className="w-full text-sm" />
                              </div>
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Helper text</label>
                                <Input value={newField.helper_text}
                                  onChange={e => setNewField(p => ({ ...p, helper_text: e.target.value }))}
                                  className="w-full text-sm" />
                              </div>
                            </div>

                            {FIELD_TYPES.find(t => t.value === newField.field_type)?.hasOptions && (
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Options (one per line)</label>
                                <textarea
                                  value={newField.options.join('\n')}
                                  onChange={e => setNewField(p => ({
                                    ...p,
                                    options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                                  }))}
                                  placeholder="Option A&#10;Option B&#10;Option C"
                                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none h-20 focus:outline-none focus:border-[#B5621E]"
                                />
                              </div>
                            )}

                            <div className="rounded-lg border border-[#C9B98A]/15 bg-[#C9B98A]/3 p-3 space-y-2">
                              <div className="text-zinc-300 text-sm">
                                All new fields are automatically linked to the shared Field Library so they stay reusable and synced.
                              </div>
                              <div>
                                <label className="text-zinc-400 text-xs block mb-1">Category</label>
                                <select
                                  value={newField.category}
                                  onChange={e => setNewField(p => ({ ...p, category: e.target.value }))}
                                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#B5621E]">
                                  <option value="">No category</option>
                                  {LIBRARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                                <input type="checkbox" checked={newField.is_required}
                                  onChange={e => setNewField(p => ({ ...p, is_required: e.target.checked }))}
                                  className="accent-[#B5621E]" />
                                Required
                              </label>
                              <div className="ml-auto flex gap-2">
                                <Button size="sm" onClick={handleAddNewField}
                                  disabled={!newField.label.trim() || savingField}>
                                  {savingField ? <Spinner size="sm" /> : 'Add Field'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setAddMode('none')}>Cancel</Button>
                              </div>
                            </div>

                            {/* Shortcut back to library */}
                            <div className="pt-1 border-t border-zinc-800">
                              <button onClick={openLibraryPicker}
                                className="text-xs text-[#C9B98A]/60 hover:text-[#C9B98A] flex items-center gap-1">
                                <BookOpen size={11} /> Browse Field Library instead
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ══ ASSIGN TAB ══ */}
                {activeTab === 'assign' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                        placeholder="Search members…" className="flex-1 text-sm" />
                      <Button size="sm" variant="outline" onClick={assignAll} disabled={savingAssign}>Assign All</Button>
                    </div>
                    {loadingAssign ? (
                      <div className="flex justify-center py-6"><Spinner /></div>
                    ) : (
                      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                        {filteredMembers.map(m => {
                          const assigned = assignments.includes(m.id);
                          return (
                            <div key={m.id} onClick={() => toggleAssignment(m.id)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                assigned ? 'bg-[#B5621E]/10 border border-[#B5621E]/30' : 'hover:bg-zinc-800/50'
                              }`}>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                assigned ? 'bg-[#B5621E] border-[#B5621E]' : 'border-zinc-600'
                              }`}>
                                {assigned && <CheckCircle size={10} className="text-white" />}
                              </div>
                              <span className="text-white text-sm">{memberName(m)}</span>
                              <span className="text-zinc-500 text-xs ml-1">{m.email}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-zinc-600 text-xs">{assignments.length} member{assignments.length !== 1 ? 's' : ''} assigned</p>
                  </div>
                )}

                {/* ══ RESPONSES TAB ══ */}
                {activeTab === 'responses' && (
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
                                      ? Array.isArray(val.value_json) ? val.value_json.join(', ') : JSON.stringify(val.value_json)
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
