'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Plane,
  Car,
  BedDouble,
  Compass,
  ChevronDown,
  ChevronUp,
  Phone,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'flight' | 'transfer' | 'accommodation' | 'activity';
type SegmentStatus =
  | 'paid'
  | 'partially_paid'
  | 'confirmed'
  | 'booked'
  | 'pending'
  | 'cancelled';

interface Contact {
  name: string;
  phone: string;
  role: string;
}

interface Segment {
  id: string;
  trip_id: string;
  date: string;
  sort_order: number;
  category: Category;
  title: string;
  location_from: string | null;
  location_to: string | null;
  start_time: string | null;
  end_time: string | null;
  reference_number: string | null;
  status: SegmentStatus;
  contacts: Contact[];
  member_description: string | null;
  internal_notes: string | null;
  member_visible: boolean;
  created_at: string;
  updated_at: string;
}

type SegmentFormData = Omit<Segment, 'id' | 'trip_id' | 'created_at' | 'updated_at'>;

const DEFAULT_FORM: SegmentFormData = {
  date: '',
  sort_order: 0,
  category: 'flight',
  title: '',
  location_from: '',
  location_to: '',
  start_time: '',
  end_time: '',
  reference_number: '',
  status: 'pending',
  contacts: [],
  member_description: '',
  internal_notes: '',
  member_visible: false,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string; icon: React.ReactNode }[] = [
  { value: 'flight', label: 'Flight', icon: <Plane size={14} /> },
  { value: 'transfer', label: 'Transfer', icon: <Car size={14} /> },
  { value: 'accommodation', label: 'Accommodation', icon: <BedDouble size={14} /> },
  { value: 'activity', label: 'Activity', icon: <Compass size={14} /> },
];

const STATUSES: { value: SegmentStatus; label: string; colour: string }[] = [
  { value: 'paid', label: 'Paid', colour: 'text-green-400 bg-green-900/30 border-green-700/50' },
  { value: 'partially_paid', label: 'Partially Paid', colour: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50' },
  { value: 'confirmed', label: 'Confirmed', colour: 'text-blue-400 bg-blue-900/30 border-blue-700/50' },
  { value: 'booked', label: 'Booked', colour: 'text-purple-400 bg-purple-900/30 border-purple-700/50' },
  { value: 'pending', label: 'Pending', colour: 'text-gray-400 bg-gray-800/50 border-gray-700/50' },
  { value: 'cancelled', label: 'Cancelled', colour: 'text-red-400 bg-red-900/30 border-red-700/50' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryIcon(cat: Category) {
  const found = CATEGORIES.find((c) => c.value === cat);
  return found?.icon ?? <Compass size={14} />;
}

function categoryLabel(cat: Category) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function statusBadge(status: SegmentStatus) {
  const s = STATUSES.find((st) => st.value === status);
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${s?.colour ?? ''}`}>
      {s?.label ?? status}
    </span>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(segments: Segment[]): Map<string, Segment[]> {
  const map = new Map<string, Segment[]>();
  for (const seg of segments) {
    const arr = map.get(seg.date) ?? [];
    arr.push(seg);
    map.set(seg.date, arr);
  }
  return map;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContactsEditor({
  contacts,
  onChange,
}: {
  contacts: Contact[];
  onChange: (contacts: Contact[]) => void;
}) {
  const add = () => onChange([...contacts, { name: '', phone: '', role: '' }]);
  const remove = (i: number) => onChange(contacts.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof Contact, value: string) => {
    const updated = contacts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c));
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {contacts.map((c, i) => (
        <div key={i} className="flex gap-2 items-start">
          <Input
            placeholder="Name"
            value={c.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Phone"
            value={c.phone}
            onChange={(e) => update(i, 'phone', e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Role (e.g. Guide)"
            value={c.role}
            onChange={(e) => update(i, 'role', e.target.value)}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-1 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs text-brand-tan hover:text-brand-brown flex items-center gap-1 transition-colors"
      >
        <Plus size={12} /> Add contact
      </button>
    </div>
  );
}

// ─── Segment Form Modal ───────────────────────────────────────────────────────

function SegmentModal({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial: SegmentFormData;
  onSave: (data: SegmentFormData) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<SegmentFormData>(initial);

  const set = (field: keyof SegmentFormData, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const needsRoute = form.category === 'flight' || form.category === 'transfer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-bold">{initial.title ? 'Edit Segment' : 'Add Segment'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Date + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date *</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Category *</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value as Category)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Title *</label>
            <Input
              placeholder={
                form.category === 'flight'
                  ? 'e.g. SYD → CMN via DXB'
                  : form.category === 'transfer'
                  ? 'e.g. Airport to Riad transfer'
                  : form.category === 'accommodation'
                  ? 'e.g. Riad Kniza, Marrakech'
                  : 'e.g. Atlas Mountains ride'
              }
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>

          {/* Route (flights/transfers only) */}
          {needsRoute && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">From</label>
                <Input
                  placeholder="e.g. SYD / Sydney"
                  value={form.location_from ?? ''}
                  onChange={(e) => set('location_from', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">To</label>
                <Input
                  placeholder="e.g. CMN / Casablanca"
                  value={form.location_to ?? ''}
                  onChange={(e) => set('location_to', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Location (accommodation/activity) */}
          {!needsRoute && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <Input
                placeholder="e.g. Marrakech, Morocco"
                value={form.location_from ?? ''}
                onChange={(e) => set('location_from', e.target.value)}
              />
            </div>
          )}

          {/* Times + Reference + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Time</label>
              <Input
                type="time"
                value={form.start_time ?? ''}
                onChange={(e) => set('start_time', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End Time</label>
              <Input
                type="time"
                value={form.end_time ?? ''}
                onChange={(e) => set('end_time', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Reference / Booking #</label>
              <Input
                placeholder="e.g. QF1234"
                value={form.reference_number ?? ''}
                onChange={(e) => set('reference_number', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as SegmentStatus)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contacts */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <Phone size={13} /> Contacts
              </span>
            </label>
            <ContactsEditor
              contacts={form.contacts}
              onChange={(contacts) => set('contacts', contacts)}
            />
          </div>

          {/* Member description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Member-facing description</label>
            <TextArea
              placeholder="What members will see (when this segment is visible to them)"
              value={form.member_description ?? ''}
              onChange={(e) => set('member_description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Internal notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Internal notes{' '}
              <span className="text-gray-500 font-normal">(admin only)</span>
            </label>
            <TextArea
              placeholder="Notes, reminders, supplier contacts — never shown to members"
              value={form.internal_notes ?? ''}
              onChange={(e) => set('internal_notes', e.target.value)}
              rows={3}
            />
          </div>

          {/* Visibility toggle */}
          <div className="flex items-center gap-3 pt-1">
            <input
              id="member_visible"
              type="checkbox"
              checked={form.member_visible}
              onChange={(e) => set('member_visible', e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-brand-brown focus:ring-brand-brown/40"
            />
            <label htmlFor="member_visible" className="text-sm text-gray-200 cursor-pointer">
              Visible to members
            </label>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-700">
          <Button variant="primary" onClick={() => onSave(form)} disabled={isSaving || !form.date || !form.title}>
            {isSaving ? 'Saving…' : 'Save Segment'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Segment Card ─────────────────────────────────────────────────────────────

function SegmentCard({
  segment,
  onEdit,
  onDelete,
  onToggleVisible,
}: {
  segment: Segment;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisible: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    segment.member_description || segment.internal_notes || segment.contacts.length > 0;

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-900/60 hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-3 p-4">
        {/* Category icon */}
        <div className="mt-0.5 text-brand-tan">{categoryIcon(segment.category)}</div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              {categoryLabel(segment.category)}
            </span>
            {statusBadge(segment.status)}
            {segment.member_visible ? (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Eye size={11} /> Members
              </span>
            ) : (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <EyeOff size={11} /> Hidden
              </span>
            )}
          </div>

          <p className="font-medium text-white truncate">{segment.title}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-400">
            {segment.location_from && segment.location_to && (
              <span>
                {segment.location_from} → {segment.location_to}
              </span>
            )}
            {segment.location_from && !segment.location_to && (
              <span>{segment.location_from}</span>
            )}
            {(segment.start_time || segment.end_time) && (
              <span>
                {segment.start_time?.slice(0, 5)}
                {segment.start_time && segment.end_time && ' – '}
                {segment.end_time?.slice(0, 5)}
              </span>
            )}
            {segment.reference_number && (
              <span className="font-mono text-xs">{segment.reference_number}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleVisible}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-brand-tan transition-colors"
            title={segment.member_visible ? 'Hide from members' : 'Show to members'}
          >
            {segment.member_visible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
          {hasDetails && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="border-t border-gray-700/60 px-4 pb-4 pt-3 space-y-3">
          {segment.contacts.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Contacts</p>
              <div className="space-y-1">
                {segment.contacts.map((c, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-gray-300 font-medium">{c.name}</span>
                    {c.role && <span className="text-gray-500">{c.role}</span>}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-brand-tan hover:underline">
                        {c.phone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {segment.member_description && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Member description
              </p>
              <p className="text-sm text-gray-300 whitespace-pre-line">{segment.member_description}</p>
            </div>
          )}
          {segment.internal_notes && (
            <div>
              <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">
                Internal notes (admin only)
              </p>
              <p className="text-sm text-gray-400 whitespace-pre-line">{segment.internal_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ItineraryAdminPage() {
  const params = useParams();
  const tripId = params.id as string;
  const supabase = createClient();

  const [tripName, setTripName] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');
    return session.access_token;
  }, [supabase]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();

      // Fetch trip name
      const tripRes = await fetch(`/api/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tripRes.ok) {
        const td = await tripRes.json();
        setTripName(td.data?.name ?? '');
      }

      // Fetch segments
      const segRes = await fetch(`/api/trips/${tripId}/itinerary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!segRes.ok) throw new Error('Failed to load itinerary');
      const sd = await segRes.json();
      setSegments(sd.segments ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [tripId, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAdd = () => {
    setEditingSegment(null);
    setShowModal(true);
  };

  const openEdit = (seg: Segment) => {
    setEditingSegment(seg);
    setShowModal(true);
  };

  const handleSave = async (formData: SegmentFormData) => {
    setIsSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const isEdit = !!editingSegment;

      const url = isEdit
        ? `/api/trips/${tripId}/itinerary/${editingSegment!.id}`
        : `/api/trips/${tripId}/itinerary`;

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save segment');
      }

      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (segmentId: string) => {
    if (!confirm('Delete this segment?')) return;
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/itinerary/${segmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete segment');
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleVisible = async (seg: Segment) => {
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/itinerary/${seg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_visible: !seg.member_visible }),
      });
      if (!res.ok) throw new Error('Failed to update visibility');
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const grouped = groupByDate(segments);
  const sortedDates = Array.from(grouped.keys()).sort();

  const visibleCount = segments.filter((s) => s.member_visible).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/trips/${tripId}`}>
          <button className="p-2 hover:bg-gray-800 rounded">
            <ArrowLeft size={20} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Itinerary</h1>
          <p className="text-gray-400">{tripName}</p>
        </div>
        <Button variant="primary" onClick={openAdd} className="flex items-center gap-2">
          <Plus size={16} />
          Add Segment
        </Button>
      </div>

      {/* Stats strip */}
      <div className="flex gap-6 text-sm text-gray-400">
        <span>
          <span className="text-white font-medium">{segments.length}</span> segments
        </span>
        <span>
          <span className="text-white font-medium">{sortedDates.length}</span> days
        </span>
        <span>
          <span className="text-green-400 font-medium">{visibleCount}</span> visible to members
        </span>
      </div>

      {error && (
        <Card className="border border-red-500 bg-red-900/20 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {/* Empty state */}
      {segments.length === 0 && (
        <Card className="p-12 text-center">
          <Compass size={40} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">No segments yet</p>
          <p className="text-gray-600 text-sm mb-6">
            Add flights, transfers, accommodation, and activities to build out the trip plan.
          </p>
          <Button variant="primary" onClick={openAdd} className="inline-flex items-center gap-2">
            <Plus size={16} />
            Add First Segment
          </Button>
        </Card>
      )}

      {/* Day groups */}
      {sortedDates.map((date) => (
        <div key={date}>
          <h2 className="text-sm font-semibold text-brand-tan uppercase tracking-wider mb-3">
            {formatDate(date)}
          </h2>
          <div className="space-y-2">
            {(grouped.get(date) ?? []).map((seg) => (
              <SegmentCard
                key={seg.id}
                segment={seg}
                onEdit={() => openEdit(seg)}
                onDelete={() => handleDelete(seg.id)}
                onToggleVisible={() => handleToggleVisible(seg)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Modal */}
      {showModal && (
        <SegmentModal
          initial={
            editingSegment
              ? {
                  date: editingSegment.date,
                  sort_order: editingSegment.sort_order,
                  category: editingSegment.category,
                  title: editingSegment.title,
                  location_from: editingSegment.location_from ?? '',
                  location_to: editingSegment.location_to ?? '',
                  start_time: editingSegment.start_time ?? '',
                  end_time: editingSegment.end_time ?? '',
                  reference_number: editingSegment.reference_number ?? '',
                  status: editingSegment.status,
                  contacts: editingSegment.contacts,
                  member_description: editingSegment.member_description ?? '',
                  internal_notes: editingSegment.internal_notes ?? '',
                  member_visible: editingSegment.member_visible,
                }
              : DEFAULT_FORM
          }
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
