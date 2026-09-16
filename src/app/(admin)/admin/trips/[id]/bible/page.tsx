'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
  ArrowLeft,
  Download,
  BookOpen,
  MapPin,
  Calendar,
  Users,
  Phone,
  Mail,
  Plus,
  Pencil,
  Trash2,
  X,
  FileText,
  Eye,
  EyeOff,
  Upload,
  Receipt as ReceiptIcon,
  Compass,
  Plane,
  Car,
  BedDouble,
  Shield,
  Landmark,
  UserCog,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'overview' | 'itinerary' | 'contacts' | 'documents' | 'receipts';

type Contact = {
  id: string;
  category: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  sort_order: number;
  member_visible: boolean;
};

type ContactFormData = Omit<Contact, 'id'>;

type ItinerarySegment = {
  id: string;
  date: string;
  category: string;
  title: string;
  location_from: string | null;
  location_to: string | null;
  start_time: string | null;
  end_time: string | null;
  member_visible: boolean;
  member_description: string | null;
  contacts: { name: string; phone: string; role: string }[];
};

type TripDocument = {
  id: string;
  name: string;
  file_url: string;
  access_url?: string;
  file_type: string;
  user_id: string | null;
  created_at: string;
};

type ExpenseReceiptGroup = {
  id: string;
  description: string;
  expense_date: string;
  amount_aud: number;
  receipts: { id: string; file_name: string; file_type: string; file_url: string; access_url?: string }[];
};

type Trip = {
  id: string;
  name: string;
  destination: string;
  country: string;
  start_date: string;
  end_date: string;
  description: string | null;
  cover_image_url: string | null;
};

const CONTACT_CATEGORIES: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: 'guide', label: 'Guide / Tour Lead', icon: <Compass size={14} /> },
  { value: 'accommodation', label: 'Accommodation', icon: <BedDouble size={14} /> },
  { value: 'transport', label: 'Transport', icon: <Car size={14} /> },
  { value: 'emergency', label: 'Emergency', icon: <AlertTriangle size={14} /> },
  { value: 'embassy', label: 'Embassy / Consulate', icon: <Landmark size={14} /> },
  { value: 'insurance', label: 'Insurance', icon: <Shield size={14} /> },
  { value: 'general', label: 'General', icon: <UserCog size={14} /> },
];

const DEFAULT_CONTACT_FORM: ContactFormData = {
  category: 'general',
  name: '',
  role: '',
  phone: '',
  email: '',
  notes: '',
  sort_order: 0,
  member_visible: true,
};

const ITINERARY_ICONS: Record<string, React.ReactNode> = {
  flight: <Plane size={14} />,
  transfer: <Car size={14} />,
  accommodation: <BedDouble size={14} />,
  activity: <Compass size={14} />,
};

const SECTIONS: { value: Section; label: string; icon: React.ReactNode }[] = [
  { value: 'overview', label: 'Overview', icon: <BookOpen size={15} /> },
  { value: 'itinerary', label: 'Itinerary', icon: <Calendar size={15} /> },
  { value: 'contacts', label: 'Key Contacts', icon: <Phone size={15} /> },
  { value: 'documents', label: 'Documents', icon: <FileText size={15} /> },
  { value: 'receipts', label: 'Receipts', icon: <ReceiptIcon size={15} /> },
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const arr = map.get(item.date) ?? [];
    arr.push(item);
    map.set(item.date, arr);
  }
  return map;
}

function categoryMeta(value: string) {
  return CONTACT_CATEGORIES.find((c) => c.value === value) ?? { value, label: value, icon: <UserCog size={14} /> };
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial: ContactFormData;
  onSave: (data: ContactFormData) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<ContactFormData>(initial);
  const set = <K extends keyof ContactFormData>(field: K, value: ContactFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-bold">{initial.name ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
            >
              {CONTACT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Name *</label>
            <Input placeholder="e.g. Hassan (Tour Guide)" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <Input placeholder="e.g. Lead Guide" value={form.role ?? ''} onChange={(e) => set('role', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <Input placeholder="+212 6..." value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <Input placeholder="name@example.com" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <TextArea
              placeholder="Anything else worth knowing (e.g. best time to call, WhatsApp only, etc.)"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input
              id="contact_member_visible"
              type="checkbox"
              checked={form.member_visible}
              onChange={(e) => set('member_visible', e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-brand-brown focus:ring-brand-brown/40"
            />
            <label htmlFor="contact_member_visible" className="text-sm text-gray-200 cursor-pointer">
              Visible to members
            </label>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-700">
          <Button variant="primary" onClick={() => onSave(form)} disabled={isSaving || !form.name.trim()}>
            {isSaving ? 'Saving…' : 'Save Contact'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TripBiblePage() {
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);
  const tripId = params.id as string;

  const [section, setSection] = useState<Section>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<ItinerarySegment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [expenseReceipts, setExpenseReceipts] = useState<ExpenseReceiptGroup[]>([]);

  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);

  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    return session.access_token;
  }, [supabase]);

  const fetchBible = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/bible`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to load Trip Bible');

      setTrip(payload.data.trip);
      setItinerary(payload.data.itinerary ?? []);
      setContacts(payload.data.contacts ?? []);
      setDocuments(payload.data.documents ?? []);
      setExpenseReceipts(payload.data.expense_receipts ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load Trip Bible'));
    } finally {
      setIsLoading(false);
    }
  }, [tripId, getToken]);

  useEffect(() => {
    if (tripId) fetchBible();
  }, [tripId, fetchBible]);

  // ── Contacts CRUD ──────────────────────────────────────────────────────────

  const openAddContact = () => {
    setEditingContact(null);
    setShowContactModal(true);
  };

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactModal(true);
  };

  const handleSaveContact = async (formData: ContactFormData) => {
    setIsSavingContact(true);
    setError(null);
    try {
      const token = await getToken();
      const url = editingContact ? `/api/trips/${tripId}/contacts/${editingContact.id}` : `/api/trips/${tripId}/contacts`;
      const res = await fetch(url, {
        method: editingContact ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to save contact');
      setShowContactModal(false);
      await fetchBible();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save contact'));
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return;
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to delete contact');
      await fetchBible();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete contact'));
    }
  };

  // ── Quick document upload ──────────────────────────────────────────────────

  const handleUploadDocument = async () => {
    if (!docFile) return;
    setIsUploadingDoc(true);
    setError(null);
    try {
      const token = await getToken();

      const signRes = await fetch(`/api/trips/${tripId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create_signed_upload',
          file_name: docFile.name,
          file_type: docFile.type || '',
          file_size: docFile.size,
        }),
      });
      const signPayload = await signRes.json().catch(() => ({}));
      if (!signRes.ok || !signPayload.success) throw new Error(signPayload.error || 'Failed to prepare upload');

      const { bucket, storage_path: storagePath, token: uploadToken, file_type: resolvedFileType } = signPayload.data;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(storagePath, uploadToken, docFile, { contentType: resolvedFileType, upsert: false });
      if (uploadError) throw new Error(uploadError.message || 'Failed to upload file');

      const registerRes = await fetch(`/api/trips/${tripId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'register_upload',
          name: docName.trim() || docFile.name,
          file_name: docFile.name,
          file_type: resolvedFileType,
          file_size: docFile.size,
          bucket,
          storage_path: storagePath,
          share_with_all: true,
        }),
      });
      const registerPayload = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok || !registerPayload.success) throw new Error(registerPayload.error || 'Failed to save document');

      setDocName('');
      setDocFile(null);
      await fetchBible();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload document'));
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to delete document');
      await fetchBible();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete document'));
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/trips/${tripId}/bible/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to generate PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(trip?.name || 'trip').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-trip-bible.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to download Trip Bible PDF'));
    } finally {
      setIsDownloading(false);
    }
  };

  const groupedItinerary = groupByDate(itinerary);
  const sortedItineraryDates = Array.from(groupedItinerary.keys()).sort();
  const groupedContacts = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const contact of contacts) {
      const arr = map.get(contact.category) ?? [];
      arr.push(contact);
      map.set(contact.category, arr);
    }
    return map;
  }, [contacts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-400">{error || 'Trip not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href={`/admin/trips/${tripId}`}>
          <button className="p-2 hover:bg-gray-800 rounded">
            <ArrowLeft size={20} />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="text-brand-tan" size={26} />
            Trip Bible
          </h1>
          <p className="text-gray-400 truncate">{trip.name}</p>
        </div>
        <Button variant="primary" onClick={handleDownloadPdf} disabled={isDownloading} className="shrink-0">
          <Download size={16} className="mr-2" />
          {isDownloading ? 'Preparing…' : 'Download PDF'}
        </Button>
      </div>

      {error && (
        <Card className="border border-red-500 bg-red-900/20 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {/* Sticky mobile-friendly section nav */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-gray-950/95 backdrop-blur border-b border-gray-800 flex gap-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSection(s.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              section === s.value ? 'bg-brand-tan text-brand-black' : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {section === 'overview' && (
        <div className="space-y-4">
          <Card className="p-6">
            {trip.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={trip.cover_image_url} alt={trip.name} className="w-full h-48 object-cover rounded-lg mb-4" />
            )}
            <h2 className="text-2xl font-bold mb-2">{trip.name}</h2>
            <div className="flex flex-wrap gap-4 text-gray-400 text-sm mb-4">
              <span className="flex items-center gap-1.5">
                <MapPin size={15} /> {trip.destination}, {trip.country}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={15} /> {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
              </span>
            </div>
            {trip.description && <p className="text-gray-300 whitespace-pre-line">{trip.description}</p>}
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Itinerary segments', value: itinerary.length, icon: <Calendar size={16} /> },
              { label: 'Key contacts', value: contacts.length, icon: <Phone size={16} /> },
              { label: 'Documents', value: documents.length, icon: <FileText size={16} /> },
              { label: 'Expenses with receipts', value: expenseReceipts.length, icon: <ReceiptIcon size={16} /> },
            ].map((stat) => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center gap-2 text-brand-tan mb-1">{stat.icon}</div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Itinerary (read-only summary, edit lives on the itinerary page) */}
      {section === 'itinerary' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{itinerary.length} segments across {sortedItineraryDates.length} days</p>
            <Link href={`/admin/trips/${tripId}/itinerary`}>
              <Button variant="secondary" size="sm">Edit Itinerary →</Button>
            </Link>
          </div>

          {itinerary.length === 0 && (
            <Card className="p-10 text-center">
              <Calendar size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No itinerary segments yet.</p>
            </Card>
          )}

          {sortedItineraryDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-brand-tan uppercase tracking-wider mb-2">{formatDate(date)}</h3>
              <div className="space-y-2">
                {(groupedItinerary.get(date) ?? []).map((seg) => (
                  <div key={seg.id} className="border border-gray-700 rounded-lg bg-gray-900/60 p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide mb-1">
                      {ITINERARY_ICONS[seg.category] ?? <Compass size={14} />}
                      {seg.category}
                      {seg.member_visible ? (
                        <span className="ml-auto text-green-400 flex items-center gap-1"><Eye size={11} /> Members</span>
                      ) : (
                        <span className="ml-auto text-gray-600 flex items-center gap-1"><EyeOff size={11} /> Hidden</span>
                      )}
                    </div>
                    <p className="font-medium">{seg.title}</p>
                    <div className="flex flex-wrap gap-x-3 text-sm text-gray-400 mt-1">
                      {seg.location_from && seg.location_to && <span>{seg.location_from} → {seg.location_to}</span>}
                      {seg.location_from && !seg.location_to && <span>{seg.location_from}</span>}
                      {(seg.start_time || seg.end_time) && (
                        <span>{seg.start_time?.slice(0, 5)}{seg.start_time && seg.end_time && ' – '}{seg.end_time?.slice(0, 5)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Contacts */}
      {section === 'contacts' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{contacts.length} contacts</p>
            <Button variant="primary" size="sm" onClick={openAddContact} className="flex items-center gap-1.5">
              <Plus size={15} /> Add Contact
            </Button>
          </div>

          {contacts.length === 0 && (
            <Card className="p-10 text-center">
              <Phone size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 mb-4">No key contacts yet — guides, accommodation, insurance, embassy…</p>
              <Button variant="primary" size="sm" onClick={openAddContact} className="inline-flex items-center gap-1.5">
                <Plus size={15} /> Add First Contact
              </Button>
            </Card>
          )}

          {Array.from(groupedContacts.entries()).map(([category, list]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-brand-tan uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {categoryMeta(category).icon}
                {categoryMeta(category).label}
              </h3>
              <div className="space-y-2">
                {list.map((contact) => (
                  <div key={contact.id} className="border border-gray-700 rounded-lg bg-gray-900/60 p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{contact.name}</p>
                        {contact.member_visible ? (
                          <span className="text-green-400 flex items-center gap-1 text-xs"><Eye size={11} /></span>
                        ) : (
                          <span className="text-gray-600 flex items-center gap-1 text-xs"><EyeOff size={11} /></span>
                        )}
                      </div>
                      {contact.role && <p className="text-sm text-gray-400">{contact.role}</p>}
                      <div className="flex flex-wrap gap-3 mt-1 text-sm">
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="text-brand-tan hover:underline flex items-center gap-1">
                            <Phone size={12} /> {contact.phone}
                          </a>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-brand-tan hover:underline flex items-center gap-1">
                            <Mail size={12} /> {contact.email}
                          </a>
                        )}
                      </div>
                      {contact.notes && <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{contact.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditContact(contact)} className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteContact(contact.id)} className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {section === 'documents' && (
        <div className="space-y-5">
          <Card className="p-4">
            <p className="text-sm font-semibold mb-3">Quick upload (shared with all trip members)</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                placeholder="Document name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="flex-1"
              />
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-700 rounded cursor-pointer text-sm text-gray-300 hover:border-gray-600">
                <Upload size={14} />
                {docFile ? docFile.name : 'Choose file'}
                <input type="file" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
              </label>
              <Button variant="primary" onClick={handleUploadDocument} disabled={!docFile || isUploadingDoc}>
                {isUploadingDoc ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Need to target specific members instead? Use{' '}
              <Link href={`/admin/trips/${tripId}/documents`} className="underline">
                Manage Documents →
              </Link>
            </p>
          </Card>

          {documents.length === 0 ? (
            <Card className="p-10 text-center">
              <FileText size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No documents yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="p-4 flex items-start gap-3">
                  <FileText size={20} className="text-brand-tan mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.file_type || 'Unknown type'} · {new Date(doc.created_at).toLocaleDateString()}</p>
                    <div className="flex gap-3 mt-2">
                      <a href={doc.access_url || doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-tan hover:underline">
                        View / Download
                      </a>
                      <button onClick={() => handleDeleteDocument(doc.id)} className="text-xs text-red-400 hover:underline">
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Receipts (financial — admin only, this whole page is admin-only anyway) */}
      {section === 'receipts' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{expenseReceipts.length} expenses with receipts attached</p>
            <Link href={`/admin/trips/${tripId}/budget`}>
              <Button variant="secondary" size="sm">Manage Expenses →</Button>
            </Link>
          </div>

          {expenseReceipts.length === 0 ? (
            <Card className="p-10 text-center">
              <ReceiptIcon size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No receipts attached to any expense yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {expenseReceipts.map((expense) => (
                <Card key={expense.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-xs text-gray-500">{new Date(expense.expense_date).toLocaleDateString()}</p>
                    </div>
                    <p className="font-semibold text-red-400">${Number(expense.amount_aud).toFixed(2)} AUD</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {expense.receipts.map((receipt) => (
                      <a
                        key={receipt.id}
                        href={receipt.access_url || receipt.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 rounded text-xs text-gray-300 hover:bg-gray-700"
                      >
                        <FileText size={12} /> {receipt.file_name}
                      </a>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {showContactModal && (
        <ContactModal
          initial={
            editingContact
              ? {
                  category: editingContact.category,
                  name: editingContact.name,
                  role: editingContact.role ?? '',
                  phone: editingContact.phone ?? '',
                  email: editingContact.email ?? '',
                  notes: editingContact.notes ?? '',
                  sort_order: editingContact.sort_order,
                  member_visible: editingContact.member_visible,
                }
              : DEFAULT_CONTACT_FORM
          }
          onSave={handleSaveContact}
          onClose={() => setShowContactModal(false)}
          isSaving={isSavingContact}
        />
      )}
    </div>
  );
}
