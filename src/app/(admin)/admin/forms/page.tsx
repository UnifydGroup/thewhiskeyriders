'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
  Plus, Trash2, Users, ClipboardList,
  ChevronDown, ChevronUp, GripVertical, X, Link2,
  CheckSquare, AlignLeft, Hash, Calendar, List, ToggleLeft,
  Upload, Minus, AlertCircle, CheckCircle, FileText,
  BookOpen, Sparkles, Search, Tag, RefreshCw, Copy,
  Pencil, Clock, CalendarClock, Timer, Eye, Download, FileSpreadsheet,
} from 'lucide-react';
import type { Form, FormField, FormFieldLibrary, FormFieldType, FormStatus } from '@/lib/types/database';

// ── Field type config ────────────────────────────────────────────
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

const LIBRARY_CATEGORIES = [
  'Profile', 'Address', 'Travel', 'Medical', 'Personal', 'Trip', 'Equipment', 'Logistics', 'Other',
];

// ── Effective lifecycle status ───────────────────────────────────
type LifecycleStatus = 'scheduled' | 'live' | 'ended' | 'draft';

function getLifecycle(form: FormWithMeta): LifecycleStatus {
  const now = new Date();
  if (form.status === 'closed') return 'ended';
  if (form.submission_deadline && new Date(form.submission_deadline) < now) return 'ended';
  if (form.status === 'active') return 'live';
  if (form.goes_live_at) {
    return new Date(form.goes_live_at) > now ? 'scheduled' : 'live';
  }
  return 'draft';
}

const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  draft:     'bg-zinc-700/60 text-zinc-300',
  scheduled: 'bg-blue-900/40 text-blue-300 border border-blue-700/40',
  live:      'bg-[#B5621E]/20 text-[#B5621E] border border-[#B5621E]/30',
  ended:     'bg-zinc-800 text-zinc-500',
};
const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  draft: 'Draft', scheduled: 'Scheduled', live: 'Live', ended: 'Ended',
};

// ── Countdown hook ───────────────────────────────────────────────
type Remaining = { days: number; hours: number; mins: number; secs: number } | null;

function useCountdown(targetIso: string | null | undefined): Remaining {
  const [remaining, setRemaining] = useState<Remaining>(null);
  useEffect(() => {
    if (!targetIso) { setRemaining(null); return; }
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setRemaining(null); return; }
      const s = Math.floor(diff / 1000);
      setRemaining({
        days:  Math.floor(s / 86400),
        hours: Math.floor((s % 86400) / 3600),
        mins:  Math.floor((s % 3600) / 60),
        secs:  s % 60,
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remaining;
}

function CountdownDisplay({ remaining, label }: { remaining: Remaining; label: string }) {
  if (!remaining) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#C9B98A]/80">
      <Timer size={11} className="shrink-0" />
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono tabular-nums">
        {remaining.days > 0 && <>{remaining.days}d </>}
        {pad(remaining.hours)}h {pad(remaining.mins)}m {pad(remaining.secs)}s
      </span>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────
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

// ── To-local-datetime string ─────────────────────────────────────
function toLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Main page ────────────────────────────────────────────────────
export default function AdminFormsPage() {
  const supabase = createClient();
  const [forms, setForms]     = useState<FormWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create form modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDesc, setNewFormDesc]   = useState('');

  // Edit / builder state
  const [editingForm, setEditingForm]     = useState<FormWithMeta | null>(null);
  const [fields, setFields]               = useState<FormFieldWithLib[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [savingField, setSavingField]     = useState(false);

  // Inline title/desc editing
  const [editingTitle, setEditingTitle]   = useState(false);
  const [draftTitle, setDraftTitle]       = useState('');
  const [editingDesc, setEditingDesc]     = useState(false);
  const [draftDesc, setDraftDesc]         = useState('');

  // Add-field panel
  const [addMode, setAddMode] = useState<'none' | 'library' | 'new'>('none');
  const [newField, setNewField] = useState<NewFieldDraft>({
    field_type: 'short_text', label: '', placeholder: '',
    helper_text: '', is_required: false, options: [], category: '',
  });

  // Library picker
  const [libraryFields, setLibraryFields]     = useState<FormFieldLibrary[]>([]);
  const [librarySearch, setLibrarySearch]     = useState('');
  const [libraryCategory, setLibraryCategory] = useState('');
  const [loadingLibrary, setLoadingLibrary]   = useState(false);
  const libraryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'fields' | 'schedule' | 'assign' | 'responses'>('fields');

  // Schedule tab state
  const [schedGoesLive, setSchedGoesLive]       = useState('');
  const [schedClosesAt, setSchedClosesAt]       = useState('');
  const [schedCountdown, setSchedCountdown]     = useState(false);
  const [savingSchedule, setSavingSchedule]     = useState(false);

  // Assign tab
  const [members, setMembers]           = useState<any[]>([]);
  const [assignments, setAssignments]   = useState<string[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign]   = useState(false);
  const [assignSearch, setAssignSearch]   = useState('');

  // Responses tab
  const [responses, setResponses]   = useState<any[]>([]);
  const [loadingResp, setLoadingResp] = useState(false);

  // ── helpers ──────────────────────────────────────────────────────
  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const memberName = (m: any) =>
    [m.first_name, m.surname].filter(Boolean).join(' ') || m.full_name || '—';

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    });
  }, [supabase]);

  // ── Data loaders ─────────────────────────────────────────────────
  const loadForms = useCallback(async () => {
    setLoading(true);
    const res  = await authFetch('/api/forms');
    const json = await res.json();
    setForms(json.success ? json.data : []);
    setLoading(false);
  }, [authFetch]);

  useEffect(() => { loadForms(); }, [loadForms]);

  const loadFields = useCallback(async (formId: string) => {
    setLoadingFields(true);
    const res  = await authFetch(`/api/forms/${formId}/fields`);
    const json = await res.json();
    setFields(json.success ? json.data : []);
    setLoadingFields(false);
  }, [authFetch]);

  const loadLibrary = useCallback(async (search = '', category = '') => {
    setLoadingLibrary(true);
    const params = new URLSearchParams();
    if (search)   params.set('search', search);
    if (category) params.set('category', category);
    const res  = await authFetch(`/api/forms/field-library?${params}`);
    const json = await res.json();
    setLibraryFields(json.success ? json.data : []);
    setLoadingLibrary(false);
  }, [authFetch]);

  const loadAssignments = useCallback(async (formId: string) => {
    setLoadingAssign(true);
    const [mr, ar] = await Promise.all([
      authFetch('/api/members'),
      authFetch(`/api/forms/${formId}/assign`),
    ]);
    const [mj, aj] = await Promise.all([mr.json(), ar.json()]);
    setMembers(mj.success ? (mj.data?.members ?? mj.data ?? []) : []);
    setAssignments(aj.success ? aj.data.map((a: any) => a.member_id) : []);
    setLoadingAssign(false);
  }, [authFetch]);

  const loadResponses = useCallback(async (formId: string) => {
    setLoadingResp(true);
    const res  = await authFetch(`/api/forms/${formId}/responses`);
    const json = await res.json();
    setResponses(json.success ? json.data : []);
    setLoadingResp(false);
  }, [authFetch]);

  // ── Export responses to Excel ─────────────────────────────────────
  function exportResponses() {
    if (!editingForm || responses.length === 0) return;

    // Columns = non-structural fields in sort order
    const dataFields = fields.filter(f => f.field_type !== 'section_header' && f.field_type !== 'acknowledgement');

    // Header row
    const headers = ['Member Name', 'Email', 'Submitted', ...dataFields.map(f => f.label)];

    // Data rows — one per response
    const rows = responses.map((resp: any) => {
      const name = resp.member
        ? ([resp.member.first_name, resp.member.surname].filter(Boolean).join(' ') || resp.member.email)
        : 'Anonymous';
      const email = resp.member?.email || '';
      const submitted = resp.submitted_at
        ? new Date(resp.submitted_at).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

      // Build a lookup from field_id → value for this response
      const valueMap: Record<string, string> = {};
      for (const val of resp.form_response_values || []) {
        const fieldId = val.form_fields?.id;
        if (!fieldId) continue;
        if (val.value_json != null) {
          valueMap[fieldId] = Array.isArray(val.value_json)
            ? val.value_json.join(', ')
            : String(val.value_json);
        } else {
          valueMap[fieldId] = val.value_text || '';
        }
      }

      return [name, email, submitted, ...dataFields.map(f => valueMap[f.id] ?? '')];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    const colWidths = [
      { wch: 24 }, // Member Name
      { wch: 30 }, // Email
      { wch: 14 }, // Submitted
      ...dataFields.map(() => ({ wch: 22 })),
    ];
    ws['!cols'] = colWidths;
    ws['!rows'] = [{ hpt: 20 }];

    // Header row styling
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
        fill:      { fgColor: { rgb: '1A1A1A' }, patternType: 'solid' },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
        border:    { bottom: { style: 'medium', color: { rgb: 'B5621E' } } },
      };
    }

    const sheetName = editingForm.title.slice(0, 31).replace(/[:\\/?*\[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Responses');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `form-responses-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // ── Open builder ─────────────────────────────────────────────────
  function openBuilder(form: FormWithMeta) {
    setEditingForm(form);
    setAddMode('none');
    setActiveTab('fields');
    setDraftTitle(form.title);
    setDraftDesc(form.description || '');
    setEditingTitle(false);
    setEditingDesc(false);
    // Prefill schedule state
    setSchedGoesLive(toLocalDatetimeValue(form.goes_live_at));
    setSchedClosesAt(toLocalDatetimeValue(form.submission_deadline));
    setSchedCountdown(form.show_countdown ?? false);
    loadFields(form.id);
  }

  // ── Create form ───────────────────────────────────────────────────
  async function handleCreate() {
    if (!newFormTitle.trim()) return;
    setCreating(true);
    const res  = await authFetch('/api/forms', {
      method: 'POST',
      body: JSON.stringify({ title: newFormTitle.trim(), description: newFormDesc.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.success) {
      setShowCreate(false); setNewFormTitle(''); setNewFormDesc('');
      flash('success', 'Form created'); loadForms();
    } else flash('error', json.error || 'Failed to create form');
  }

  // ── Duplicate form ───────────────────────────────────────────────
  async function handleDuplicate(formId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res  = await authFetch(`/api/forms/${formId}/duplicate`, { method: 'POST' });
    const json = await res.json();
    if (json.success) { flash('success', 'Form duplicated'); loadForms(); }
    else flash('error', json.error || 'Failed to duplicate');
  }

  // ── Update form status ────────────────────────────────────────────
  async function updateStatus(formId: string, status: FormStatus) {
    const res  = await authFetch(`/api/forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.success) {
      flash('success', `Form ${status}`); loadForms();
      if (editingForm?.id === formId) setEditingForm({ ...editingForm, status });
    } else flash('error', json.error || 'Update failed');
  }

  // ── Save inline title/description ────────────────────────────────
  async function saveTitle() {
    if (!editingForm || !draftTitle.trim()) return;
    const res  = await authFetch(`/api/forms/${editingForm.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: draftTitle.trim() }),
    });
    const json = await res.json();
    if (json.success) {
      const updated = { ...editingForm, title: draftTitle.trim() };
      setEditingForm(updated);
      setForms(prev => prev.map(f => f.id === editingForm.id ? { ...f, title: draftTitle.trim() } : f));
    }
    setEditingTitle(false);
  }

  async function saveDesc() {
    if (!editingForm) return;
    const res  = await authFetch(`/api/forms/${editingForm.id}`, {
      method: 'PUT',
      body: JSON.stringify({ description: draftDesc }),
    });
    const json = await res.json();
    if (json.success) {
      const updated = { ...editingForm, description: draftDesc || null };
      setEditingForm(updated);
      setForms(prev => prev.map(f => f.id === editingForm.id ? { ...f, description: draftDesc || null } : f));
    }
    setEditingDesc(false);
  }

  // ── Save schedule ─────────────────────────────────────────────────
  async function saveSchedule() {
    if (!editingForm) return;
    setSavingSchedule(true);
    const payload: Record<string, unknown> = {
      goes_live_at:        schedGoesLive ? new Date(schedGoesLive).toISOString() : null,
      submission_deadline: schedClosesAt ? new Date(schedClosesAt).toISOString() : null,
      show_countdown:      schedCountdown,
    };
    const res  = await authFetch(`/api/forms/${editingForm.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSavingSchedule(false);
    if (json.success) {
      const updated = {
        ...editingForm,
        goes_live_at:        payload.goes_live_at as string | null,
        submission_deadline: payload.submission_deadline as string | null,
        show_countdown:      schedCountdown,
      };
      setEditingForm(updated);
      setForms(prev => prev.map(f => f.id === editingForm.id ? { ...f, ...updated } : f));
      flash('success', 'Schedule saved');
    } else flash('error', json.error || 'Failed to save schedule');
  }

  // ── Delete form ───────────────────────────────────────────────────
  async function deleteForm(formId: string) {
    if (!confirm('Delete this form and all its responses? This cannot be undone.')) return;
    const res  = await authFetch(`/api/forms/${formId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      flash('success', 'Deleted');
      if (editingForm?.id === formId) setEditingForm(null);
      loadForms();
    } else flash('error', json.error || 'Delete failed');
  }

  // ── Add field: from library ───────────────────────────────────────
  async function handleAddFromLibrary(libField: FormFieldLibrary) {
    if (!editingForm) return;
    setSavingField(true);
    const res  = await authFetch(`/api/forms/${editingForm.id}/fields`, {
      method: 'POST',
      body: JSON.stringify({ library_field_id: libField.id }),
    });
    const json = await res.json();
    setSavingField(false);
    if (json.success) { loadFields(editingForm.id); flash('success', `"${libField.label}" added`); }
    else flash('error', json.error || 'Failed to add field');
  }

  // ── Add field: new ────────────────────────────────────────────────
  async function handleAddNewField() {
    if (!editingForm || !newField.label.trim()) return;
    setSavingField(true);
    const body = {
      ...newField,
      options:         newField.options.length ? newField.options : null,
      category:        newField.category || null,
      save_to_library: true,
    };
    const res  = await authFetch(`/api/forms/${editingForm.id}/fields`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSavingField(false);
    if (json.success) {
      setAddMode('none');
      setNewField({ field_type: 'short_text', label: '', placeholder: '', helper_text: '', is_required: false, options: [], category: '' });
      loadFields(editingForm.id);
      flash('success', 'Field added');
    } else flash('error', json.error || 'Failed to add field');
  }

  // ── Delete field ──────────────────────────────────────────────────
  async function handleDeleteField(fieldId: string) {
    if (!editingForm) return;
    if (!confirm('Remove this field? Existing response data will be deleted.')) return;
    await authFetch(`/api/forms/${editingForm.id}/fields/${fieldId}`, { method: 'DELETE' });
    loadFields(editingForm.id);
  }

  // ── Reorder fields ────────────────────────────────────────────────
  async function moveField(index: number, dir: -1 | 1) {
    if (!editingForm) return;
    const updated = [...fields];
    const swap = index + dir;
    if (swap < 0 || swap >= updated.length) return;
    [updated[index], updated[swap]] = [updated[swap], updated[index]];
    const reordered = updated.map((f, i) => ({ ...f, sort_order: i }));
    setFields(reordered);
    await authFetch(`/api/forms/${editingForm.id}/fields`, {
      method: 'PUT',
      body: JSON.stringify({ fields: reordered.map(f => ({ id: f.id, sort_order: f.sort_order })) }),
    });
  }

  // ── Tab switching ─────────────────────────────────────────────────
  async function switchTab(tab: 'fields' | 'schedule' | 'assign' | 'responses') {
    setActiveTab(tab);
    setAddMode('none');
    if (!editingForm) return;
    if (tab === 'assign')    await loadAssignments(editingForm.id);
    if (tab === 'responses') await loadResponses(editingForm.id);
  }

  // ── Assignments ───────────────────────────────────────────────────
  async function toggleAssignment(memberId: string) {
    if (!editingForm) return;
    const assigned = assignments.includes(memberId);
    setSavingAssign(true);
    if (assigned) {
      await authFetch(`/api/forms/${editingForm.id}/assign`, {
        method: 'DELETE',
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      setAssignments(p => p.filter(id => id !== memberId));
    } else {
      await authFetch(`/api/forms/${editingForm.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      setAssignments(p => [...p, memberId]);
    }
    setSavingAssign(false);
  }

  async function assignAll() {
    if (!editingForm) return;
    setSavingAssign(true);
    await authFetch(`/api/forms/${editingForm.id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ member_ids: 'all' }),
    });
    setSavingAssign(false);
    await loadAssignments(editingForm.id);
    flash('success', 'Assigned to all active members');
  }

  // ── Library search ────────────────────────────────────────────────
  function onLibrarySearch(val: string) {
    setLibrarySearch(val);
    if (libraryDebounce.current) clearTimeout(libraryDebounce.current);
    libraryDebounce.current = setTimeout(() => loadLibrary(val, libraryCategory), 300);
  }
  function onLibraryCategoryChange(val: string) {
    setLibraryCategory(val);
    loadLibrary(librarySearch, val);
  }
  function openLibraryPicker() {
    setAddMode('library');
    setLibrarySearch(''); setLibraryCategory('');
    loadLibrary('', '');
  }

  // ── Misc ──────────────────────────────────────────────────────────
  function copyShareLink(form: FormWithMeta) {
    navigator.clipboard.writeText(`${window.location.origin}/forms/${form.token}`);
    flash('success', 'Share link copied');
  }

  const filteredMembers = members.filter(m => {
    if (!assignSearch) return true;
    return memberName(m).toLowerCase().includes(assignSearch.toLowerCase())
      || m.email?.toLowerCase().includes(assignSearch.toLowerCase());
  });
  const usedLibraryIds = new Set(fields.map(f => f.library_field_id).filter(Boolean));
  const assignmentCount = (f: FormWithMeta) => f.form_assignments?.[0]?.count ?? 0;
  const responseCount   = (f: FormWithMeta) => f.form_responses?.[0]?.count   ?? 0;

  // ── Schedule tab countdown previews ─────────────────────────────
  const schedGoesLiveIso = schedGoesLive ? new Date(schedGoesLive).toISOString() : null;
  const schedClosesAtIso = schedClosesAt ? new Date(schedClosesAt).toISOString() : null;
  const goesLiveCountdown = useCountdown(schedGoesLiveIso && new Date(schedGoesLiveIso) > new Date() ? schedGoesLiveIso : null);
  const closesAtCountdown = useCountdown(schedClosesAtIso && new Date(schedClosesAtIso) > new Date() ? schedClosesAtIso : null);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Form Builder</h1>
          <p className="text-zinc-400 text-sm mt-1">Create forms, schedule them, assign to members, collect responses</p>
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

      {/* Create form modal */}
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

      {/* Two-column layout */}
      <div className={`grid gap-6 ${editingForm ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>

        {/* Forms list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : forms.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-zinc-500">
              No forms yet — create one above.
            </CardContent></Card>
          ) : forms.map(form => {
            const lifecycle = getLifecycle(form);
            return (
              <FormCard key={form.id} form={form} lifecycle={lifecycle}
                isEditing={editingForm?.id === form.id}
                onClick={() => openBuilder(form)}
                onCopy={e => handleDuplicate(form.id, e)}
                onDelete={e => { e.stopPropagation(); deleteForm(form.id); }}
                onShare={e => { e.stopPropagation(); copyShareLink(form); }}
                assignmentCount={assignmentCount(form)}
                responseCount={responseCount(form)}
              />
            );
          })}
        </div>

        {/* Builder panel */}
        {editingForm && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  {/* Editable title */}
                  <div className="flex-1 min-w-0">
                    {editingTitle ? (
                      <Input
                        value={draftTitle}
                        onChange={e => setDraftTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                        autoFocus
                        className="text-base font-semibold w-full"
                      />
                    ) : (
                      <button
                        onClick={() => { setDraftTitle(editingForm.title); setEditingTitle(true); }}
                        className="group flex items-center gap-1.5 text-left w-full">
                        <CardTitle className="text-base truncate">{editingForm.title}</CardTitle>
                        <Pencil size={12} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-0.5" />
                      </button>
                    )}
                    {/* Editable description */}
                    {editingDesc ? (
                      <textarea
                        value={draftDesc}
                        onChange={e => setDraftDesc(e.target.value)}
                        onBlur={saveDesc}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingDesc(false); }}
                        autoFocus
                        rows={2}
                        className="mt-1 w-full bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs rounded-lg px-2 py-1 resize-none focus:outline-none focus:border-[#B5621E]"
                      />
                    ) : (
                      <button
                        onClick={() => { setDraftDesc(editingForm.description || ''); setEditingDesc(true); }}
                        className="group flex items-start gap-1 mt-0.5 text-left w-full">
                        <span className="text-zinc-500 text-xs line-clamp-1">
                          {editingForm.description || <span className="italic text-zinc-600">Add a description…</span>}
                        </span>
                        <Pencil size={10} className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 mt-0.5" />
                      </button>
                    )}
                  </div>
                  <button onClick={() => setEditingForm(null)} className="text-zinc-500 hover:text-white shrink-0">
                    <X size={16} />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Status + actions row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <LifecycleBadge lifecycle={getLifecycle(editingForm)} />
                  {editingForm.status === 'draft'  && <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'active')}>Publish now</Button>}
                  {editingForm.status === 'active' && <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'closed')}>Close</Button>}
                  {editingForm.status === 'closed' && <Button size="sm" variant="outline" onClick={() => updateStatus(editingForm.id, 'active')}>Re-open</Button>}
                  <button onClick={() => copyShareLink(editingForm)}
                    className="ml-auto flex items-center gap-1 text-xs text-[#C9B98A] hover:text-[#B5621E] transition-colors">
                    <Link2 size={12} /> Copy link
                  </button>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-zinc-800">
                  {([
                    { id: 'fields',    label: 'Fields',    icon: <FileText size={13} /> },
                    { id: 'schedule',  label: 'Schedule',  icon: <CalendarClock size={13} /> },
                    { id: 'assign',    label: 'Assign',    icon: <Users size={13} /> },
                    { id: 'responses', label: 'Responses', icon: <ClipboardList size={13} /> },
                  ] as const).map(tab => (
                    <button key={tab.id}
                      onClick={() => switchTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
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
                  <FieldsTab
                    fields={fields} loadingFields={loadingFields} addMode={addMode}
                    setAddMode={setAddMode} savingField={savingField}
                    newField={newField} setNewField={setNewField}
                    libraryFields={libraryFields} loadingLibrary={loadingLibrary}
                    librarySearch={librarySearch} libraryCategory={libraryCategory}
                    usedLibraryIds={usedLibraryIds}
                    onLibrarySearch={onLibrarySearch}
                    onLibraryCategoryChange={onLibraryCategoryChange}
                    onRefreshLibrary={() => loadLibrary(librarySearch, libraryCategory)}
                    onOpenLibraryPicker={openLibraryPicker}
                    onAddFromLibrary={handleAddFromLibrary}
                    onAddNewField={handleAddNewField}
                    onDeleteField={handleDeleteField}
                    onMoveField={moveField}
                  />
                )}

                {/* ══ SCHEDULE TAB ══ */}
                {activeTab === 'schedule' && (
                  <ScheduleTab
                    editingForm={editingForm}
                    schedGoesLive={schedGoesLive} setSchedGoesLive={setSchedGoesLive}
                    schedClosesAt={schedClosesAt} setSchedClosesAt={setSchedClosesAt}
                    schedCountdown={schedCountdown} setSchedCountdown={setSchedCountdown}
                    goesLiveCountdown={goesLiveCountdown}
                    closesAtCountdown={closesAtCountdown}
                    savingSchedule={savingSchedule}
                    onSave={saveSchedule}
                    onStatusChange={updateStatus}
                  />
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
                    {responses.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-xs">{responses.length} response{responses.length !== 1 ? 's' : ''}</span>
                        <button
                          onClick={exportResponses}
                          className="flex items-center gap-1.5 text-xs text-[#C9B98A] hover:text-[#B5621E] transition-colors"
                        >
                          <FileSpreadsheet size={13} /> Export to Excel
                        </button>
                      </div>
                    )}
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

// ── Sub-components ────────────────────────────────────────────────

function LifecycleBadge({ lifecycle }: { lifecycle: LifecycleStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LIFECYCLE_STYLES[lifecycle]}`}>
      {lifecycle === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B5621E] mr-1 animate-pulse" />}
      {LIFECYCLE_LABELS[lifecycle]}
    </span>
  );
}

// ── Form card with countdown support ─────────────────────────────
function FormCard({
  form, lifecycle, isEditing, onClick, onCopy, onDelete, onShare, assignmentCount, responseCount,
}: {
  form: FormWithMeta;
  lifecycle: LifecycleStatus;
  isEditing: boolean;
  onClick: () => void;
  onCopy: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
  assignmentCount: number;
  responseCount: number;
}) {
  const goesLiveCountdown = useCountdown(
    form.show_countdown && lifecycle === 'scheduled' ? form.goes_live_at : null
  );
  const closesAtCountdown = useCountdown(
    form.show_countdown && lifecycle === 'live' ? form.submission_deadline : null
  );

  return (
    <Card
      className={`cursor-pointer transition-all ${isEditing ? 'border-[#B5621E]/50 bg-[#B5621E]/5' : 'hover:border-zinc-600'}`}
      onClick={onClick}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-medium truncate">{form.title}</span>
              <LifecycleBadge lifecycle={lifecycle} />
            </div>
            {form.description && <p className="text-zinc-400 text-sm mt-1 line-clamp-1">{form.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-zinc-500 text-xs flex-wrap">
              <span className="flex items-center gap-1"><Users size={11} /> {assignmentCount} assigned</span>
              <span className="flex items-center gap-1"><ClipboardList size={11} /> {responseCount} responses</span>
              {form.trips && <span className="text-[#C9B98A]">{form.trips.name}</span>}
            </div>
            {/* Countdown badges */}
            {lifecycle === 'scheduled' && goesLiveCountdown && (
              <div className="mt-1.5">
                <CountdownDisplay remaining={goesLiveCountdown} label="Goes live in" />
              </div>
            )}
            {lifecycle === 'live' && closesAtCountdown && (
              <div className="mt-1.5">
                <CountdownDisplay remaining={closesAtCountdown} label="Closes in" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onShare}
              className="p-1.5 text-zinc-500 hover:text-[#C9B98A] transition-colors" title="Copy share link">
              <Link2 size={14} />
            </button>
            <button onClick={onCopy}
              className="p-1.5 text-zinc-500 hover:text-[#C9B98A] transition-colors" title="Duplicate form">
              <Copy size={14} />
            </button>
            <button onClick={onDelete}
              className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors" title="Delete form">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Schedule tab ──────────────────────────────────────────────────
function ScheduleTab({
  editingForm, schedGoesLive, setSchedGoesLive, schedClosesAt, setSchedClosesAt,
  schedCountdown, setSchedCountdown, goesLiveCountdown, closesAtCountdown,
  savingSchedule, onSave, onStatusChange,
}: {
  editingForm: FormWithMeta;
  schedGoesLive: string; setSchedGoesLive: (v: string) => void;
  schedClosesAt: string; setSchedClosesAt: (v: string) => void;
  schedCountdown: boolean; setSchedCountdown: (v: boolean) => void;
  goesLiveCountdown: Remaining;
  closesAtCountdown: Remaining;
  savingSchedule: boolean;
  onSave: () => void;
  onStatusChange: (formId: string, status: FormStatus) => void;
}) {
  const lifecycle = getLifecycle(editingForm);

  return (
    <div className="space-y-5">

      {/* Lifecycle indicator */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          lifecycle === 'live'      ? 'bg-[#B5621E] animate-pulse' :
          lifecycle === 'scheduled' ? 'bg-blue-400' :
          lifecycle === 'ended'     ? 'bg-zinc-600' : 'bg-zinc-500'
        }`} />
        <div>
          <span className="text-white text-sm font-medium">{LIFECYCLE_LABELS[lifecycle]}</span>
          {lifecycle === 'scheduled' && editingForm.goes_live_at && (
            <p className="text-zinc-500 text-xs mt-0.5">
              Goes live {new Date(editingForm.goes_live_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
          {lifecycle === 'live' && editingForm.submission_deadline && (
            <p className="text-zinc-500 text-xs mt-0.5">
              Closes {new Date(editingForm.submission_deadline).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
          {lifecycle === 'ended' && (
            <p className="text-zinc-500 text-xs mt-0.5">This form is no longer accepting submissions</p>
          )}
        </div>
      </div>

      {/* Date pickers */}
      <div className="space-y-4">
        <div>
          <label className="text-zinc-300 text-sm font-medium block mb-1.5 flex items-center gap-1.5">
            <CalendarClock size={14} className="text-blue-400" /> Goes live at
          </label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={schedGoesLive}
              onChange={e => setSchedGoesLive(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
            />
            {schedGoesLive && (
              <button onClick={() => setSchedGoesLive('')}
                className="px-2 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          {schedGoesLive && goesLiveCountdown && (
            <div className="mt-1.5 px-1">
              <CountdownDisplay remaining={goesLiveCountdown} label="Goes live in" />
            </div>
          )}
          {schedGoesLive && !goesLiveCountdown && new Date(schedGoesLive) <= new Date() && (
            <p className="text-xs text-[#B5621E] mt-1.5 px-1">This date is in the past — form will be treated as live.</p>
          )}
          <p className="text-zinc-600 text-xs mt-1.5 px-1">Leave blank to control status manually.</p>
        </div>

        <div>
          <label className="text-zinc-300 text-sm font-medium block mb-1.5 flex items-center gap-1.5">
            <Clock size={14} className="text-zinc-400" /> Closes at (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={schedClosesAt}
              onChange={e => setSchedClosesAt(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#B5621E] [color-scheme:dark]"
            />
            {schedClosesAt && (
              <button onClick={() => setSchedClosesAt('')}
                className="px-2 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          {schedClosesAt && closesAtCountdown && (
            <div className="mt-1.5 px-1">
              <CountdownDisplay remaining={closesAtCountdown} label="Closes in" />
            </div>
          )}
          {schedClosesAt && !closesAtCountdown && new Date(schedClosesAt) <= new Date() && (
            <p className="text-xs text-red-400 mt-1.5 px-1">This date has passed — form is considered ended.</p>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        {/* Countdown toggle */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <div className="mt-0.5">
            <input
              type="checkbox"
              checked={schedCountdown}
              onChange={e => setSchedCountdown(e.target.checked)}
              className="sr-only"
            />
            <div
              onClick={() => setSchedCountdown(!schedCountdown)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                schedCountdown ? 'bg-[#B5621E]' : 'bg-zinc-700'
              }`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                schedCountdown ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm text-zinc-200">
              <Timer size={13} className="text-[#C9B98A]" />
              Show countdown timer
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">
              Displays a live countdown on the form — "going live in…" before open, "closes in…" while live.
            </p>
          </div>
        </label>

        {/* Preview when countdown enabled */}
        {schedCountdown && (schedGoesLive || schedClosesAt) && (
          <div className="mt-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2">
              <Eye size={11} /> Countdown preview
            </div>
            {schedGoesLive && goesLiveCountdown && (
              <CountdownDisplay remaining={goesLiveCountdown} label="Goes live in" />
            )}
            {schedClosesAt && closesAtCountdown && (
              <CountdownDisplay remaining={closesAtCountdown} label="Closes in" />
            )}
            {!goesLiveCountdown && !closesAtCountdown && (
              <p className="text-zinc-600 text-xs">No active countdowns — dates may be in the past.</p>
            )}
          </div>
        )}
      </div>

      {/* Save + manual override */}
      <div className="space-y-3 pt-1">
        <Button onClick={onSave} disabled={savingSchedule} className="w-full">
          {savingSchedule ? <Spinner size="sm" /> : 'Save Schedule'}
        </Button>

        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <p className="text-zinc-600 text-xs">Manual status override:</p>
          <div className="flex gap-2 flex-wrap">
            {editingForm.status === 'draft'  && <Button size="sm" variant="outline" onClick={() => onStatusChange(editingForm.id, 'active')}>Publish now</Button>}
            {editingForm.status === 'active' && <Button size="sm" variant="outline" onClick={() => onStatusChange(editingForm.id, 'closed')}>Close now</Button>}
            {editingForm.status === 'closed' && <Button size="sm" variant="outline" onClick={() => onStatusChange(editingForm.id, 'active')}>Re-open</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fields tab (extracted for readability) ────────────────────────
function FieldsTab({
  fields, loadingFields, addMode, setAddMode, savingField,
  newField, setNewField,
  libraryFields, loadingLibrary, librarySearch, libraryCategory, usedLibraryIds,
  onLibrarySearch, onLibraryCategoryChange, onRefreshLibrary, onOpenLibraryPicker,
  onAddFromLibrary, onAddNewField, onDeleteField, onMoveField,
}: {
  fields: FormFieldWithLib[];
  loadingFields: boolean;
  addMode: 'none' | 'library' | 'new';
  setAddMode: (m: 'none' | 'library' | 'new') => void;
  savingField: boolean;
  newField: NewFieldDraft;
  setNewField: React.Dispatch<React.SetStateAction<NewFieldDraft>>;
  libraryFields: FormFieldLibrary[];
  loadingLibrary: boolean;
  librarySearch: string;
  libraryCategory: string;
  usedLibraryIds: Set<string | null | undefined>;
  onLibrarySearch: (v: string) => void;
  onLibraryCategoryChange: (v: string) => void;
  onRefreshLibrary: () => void;
  onOpenLibraryPicker: () => void;
  onAddFromLibrary: (f: FormFieldLibrary) => void;
  onAddNewField: () => void;
  onDeleteField: (id: string) => void;
  onMoveField: (idx: number, dir: -1 | 1) => void;
}) {
  return (
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
                    <span className="text-[10px] text-blue-400/60 bg-blue-900/15 border border-blue-700/20 px-1.5 py-0.5 rounded-full">
                      ⇄ profile
                    </span>
                  )}
                </div>
                {field.helper_text && (
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">{field.helper_text}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onMoveField(idx, -1)} disabled={idx === 0}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp size={13} /></button>
                <button onClick={() => onMoveField(idx, 1)} disabled={idx === fields.length - 1}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown size={13} /></button>
                <button onClick={() => onDeleteField(field.id)}
                  className="text-zinc-600 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}

          {/* Add-field buttons */}
          {addMode === 'none' && (
            <div className="flex gap-2 pt-1">
              <button onClick={onOpenLibraryPicker}
                className="flex-1 border border-dashed border-[#C9B98A]/30 rounded-lg py-2.5 text-[#C9B98A]/70 hover:text-[#C9B98A] hover:border-[#C9B98A]/60 text-xs flex items-center justify-center gap-1.5 transition-colors">
                <BookOpen size={13} /> Pick from Library
              </button>
              <button onClick={() => setAddMode('new')}
                className="flex-1 border border-dashed border-zinc-700 rounded-lg py-2.5 text-zinc-500 hover:text-[#C9B98A] hover:border-[#C9B98A]/50 text-xs flex items-center justify-center gap-1.5 transition-colors">
                <Sparkles size={13} /> Create New Field
              </button>
            </div>
          )}

          {/* Library picker */}
          {addMode === 'library' && (
            <div className="border border-[#C9B98A]/20 rounded-lg bg-[#C9B98A]/3 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#C9B98A] text-sm font-medium flex items-center gap-1.5">
                  <BookOpen size={14} /> Field Library
                </span>
                <button onClick={() => setAddMode('none')} className="text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input value={librarySearch} onChange={e => onLibrarySearch(e.target.value)}
                    placeholder="Search fields…"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-[#B5621E]" />
                </div>
                <select value={libraryCategory} onChange={e => onLibraryCategoryChange(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-[#B5621E]">
                  <option value="">All categories</option>
                  {LIBRARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={onRefreshLibrary} className="text-zinc-500 hover:text-zinc-300 p-1.5">
                  <RefreshCw size={13} />
                </button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {loadingLibrary ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : libraryFields.length === 0 ? (
                  <p className="text-zinc-500 text-xs text-center py-4">
                    No library fields found.{' '}
                    <button className="text-[#C9B98A] underline" onClick={() => setAddMode('new')}>Create one?</button>
                  </p>
                ) : (
                  libraryFields.map(lf => {
                    const alreadyAdded = usedLibraryIds.has(lf.id);
                    return (
                      <div key={lf.id}
                        onClick={() => !alreadyAdded && !savingField && onAddFromLibrary(lf)}
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
                              <span className="text-[10px] text-blue-400/70 bg-blue-900/20 px-1.5 py-0.5 rounded-full border border-blue-700/20">
                                ⇄ profile
                              </span>
                            )}
                          </div>
                          {lf.description && <p className="text-zinc-500 text-xs mt-0.5 truncate">{lf.description}</p>}
                          <p className="text-zinc-600 text-xs mt-0.5">
                            Used in {lf.use_count} form{lf.use_count !== 1 ? 's' : ''}
                            {lf.options?.length ? ` · ${lf.options.length} options` : ''}
                            {lf.settings?.profiles_column ? ` · profiles.${lf.settings.profiles_column}` : ''}
                          </p>
                        </div>
                        {alreadyAdded
                          ? <span className="text-xs text-zinc-600 mt-0.5">Added</span>
                          : <Plus size={14} className="text-[#C9B98A]/60 mt-0.5 shrink-0" />
                        }
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

          {/* New field panel */}
          {addMode === 'new' && (
            <div className="border border-zinc-700 rounded-lg p-4 space-y-3 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-300 text-sm font-medium flex items-center gap-1.5">
                  <Sparkles size={14} /> New Field
                </span>
                <button onClick={() => setAddMode('none')} className="text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Field type</label>
                  <select value={newField.field_type}
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
                <div className="text-zinc-300 text-sm">All new fields are automatically linked to the shared Field Library.</div>
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Category</label>
                  <select value={newField.category}
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
                  <Button size="sm" onClick={onAddNewField} disabled={!newField.label.trim() || savingField}>
                    {savingField ? <Spinner size="sm" /> : 'Add Field'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddMode('none')}>Cancel</Button>
                </div>
              </div>
              <div className="pt-1 border-t border-zinc-800">
                <button onClick={onOpenLibraryPicker}
                  className="text-xs text-[#C9B98A]/60 hover:text-[#C9B98A] flex items-center gap-1">
                  <BookOpen size={11} /> Browse Field Library instead
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
