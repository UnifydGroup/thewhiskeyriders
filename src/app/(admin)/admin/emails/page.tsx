'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/news/RichTextEditor';
import {
  Check,
  Edit2,
  Mail,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  X,
  AlertTriangle,
} from 'lucide-react';
import { getMemberDisplayName } from '@/lib/member-display';
import { normalizeEditorHtmlForSave, toEditorHtml, hasRenderableNewsContent } from '@/lib/news/content';

type Trip = { id: string; name: string; slug: string; status: string };
type Member = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
};

type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent';
  is_global: boolean;
  tag_all_members: boolean;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  creator: { id: string; full_name: string | null; nickname: string | null } | null;
  trip_tags: { id: string; name: string; slug: string }[];
  member_tags: { id: string; full_name: string | null; nickname: string | null }[];
};

const emptyForm = {
  subject: '',
  body: '',
  is_global: false,
  tag_all_members: false,
  trip_ids: [] as string[],
  member_ids: [] as string[],
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminEmailsPage() {
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmSend, setConfirmSend] = useState<Campaign | null>(null);

  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    return session.access_token;
  }, [supabase]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      const accessToken = await getAccessToken();

      const [campaignsResponse, optionsResponse] = await Promise.all([
        fetch('/api/emails?limit=200', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/news/options', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);

      const campaignsPayload = await campaignsResponse.json().catch(() => ({})) as {
        success?: boolean; data?: { campaigns?: Campaign[] }; error?: string;
      };
      const optionsPayload = await optionsResponse.json().catch(() => ({})) as {
        success?: boolean; data?: { trips?: Trip[]; members?: Member[] }; error?: string;
      };

      if (!campaignsResponse.ok || !campaignsPayload.success) {
        throw new Error(campaignsPayload.error || 'Failed to load campaigns');
      }

      setCampaigns(campaignsPayload.data?.campaigns || []);
      setTrips(optionsPayload.data?.trips || []);
      setMembers(optionsPayload.data?.members || []);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => { void loadData(); }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  };

  const toggleSelection = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];

  const handleSave = async () => {
    const subject = form.subject.trim();
    const body = normalizeEditorHtmlForSave(form.body);
    const hasBody = hasRenderableNewsContent(body);

    if (!subject) {
      setMessage({ type: 'error', text: 'Subject line is required.' });
      return;
    }

    if (!hasBody) {
      setMessage({ type: 'error', text: 'Email body is required.' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      const accessToken = await getAccessToken();

      const endpoint = editingId ? `/api/emails/${editingId}` : '/api/emails';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          subject,
          body,
          is_global: form.is_global,
          tag_all_members: form.tag_all_members,
          trip_ids: form.is_global ? [] : form.trip_ids,
          member_ids: form.tag_all_members ? [] : form.member_ids,
        }),
      });

      const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to save campaign');

      setMessage({ type: 'success', text: editingId ? 'Campaign updated.' : 'Campaign saved as draft.' });
      resetForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save campaign' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setForm({
      subject: campaign.subject,
      body: toEditorHtml(campaign.body),
      is_global: campaign.is_global,
      tag_all_members: campaign.tag_all_members,
      trip_ids: campaign.trip_tags.map((t) => t.id),
      member_ids: campaign.member_tags.map((m) => m.id),
    });
    setMessage(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendCampaign = async (campaign: Campaign) => {
    setConfirmSend(null);
    try {
      setSendingId(campaign.id);
      setMessage(null);
      const accessToken = await getAccessToken();

      const response = await fetch(`/api/emails/${campaign.id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const payload = await response.json().catch(() => ({})) as {
        success?: boolean;
        error?: string;
        data?: { sent: number; failed: number; attempted: number };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to send campaign');
      }

      const { sent, failed, attempted } = payload.data || { sent: 0, failed: 0, attempted: 0 };
      setMessage({
        type: failed > 0 && sent === 0 ? 'error' : 'success',
        text: `Sent to ${sent} of ${attempted} members.${failed > 0 ? ` ${failed} failed — check delivery logs.` : ''}`,
      });
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send campaign' });
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    if (!window.confirm(`Delete "${campaign.subject}"?`)) return;

    try {
      setDeletingId(campaign.id);
      const accessToken = await getAccessToken();

      const response = await fetch(`/api/emails/${campaign.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to delete campaign');

      setMessage({ type: 'success', text: 'Campaign deleted.' });
      if (editingId === campaign.id) resetForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete campaign' });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    return getMemberDisplayName(m).toLowerCase().includes(memberSearch.toLowerCase());
  });

  const drafts = campaigns.filter((c) => c.status === 'draft');
  const sent = campaigns.filter((c) => c.status === 'sent');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Email Campaigns</h1>
        <p className="text-brand-cream/70">Compose and send branded emails directly to members.</p>
      </div>

      {message && (
        <Card className={message.type === 'error' ? 'border border-red-500/40' : 'border border-green-500/40'}>
          <CardContent className={`py-4 ${message.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
            {message.text}
          </CardContent>
        </Card>
      )}

      {/* Send confirmation modal */}
      {confirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-[#1a1a1a] border border-brand-brown/30 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-brand-brown shrink-0" />
              <h2 className="text-lg font-semibold text-brand-cream">Send Campaign?</h2>
            </div>
            <p className="text-sm text-brand-cream/70">
              <strong className="text-brand-cream">{confirmSend.subject}</strong> will be emailed to all targeted
              members. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setConfirmSend(null)}>Cancel</Button>
              <Button
                onClick={() => handleSendCampaign(confirmSend)}
                isLoading={sendingId === confirmSend.id}
              >
                <Send className="w-4 h-4" />
                Yes, Send Now
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Compose / Edit panel */}
        <div>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5 text-brand-brown" /> : <Plus className="w-5 h-5 text-brand-brown" />}
                {editingId ? 'Edit Campaign' : 'Compose Email'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Subject line</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g. Morocco 2027 – Important Update"
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Body</label>
                <RichTextEditor
                  ref={editorRef}
                  value={form.body}
                  onChange={(v) => setForm((prev) => ({ ...prev, body: v }))}
                  placeholder="Write your email content here..."
                />
                <p className="text-xs text-brand-cream/50">
                  Rich formatting supported. The email will be wrapped in a branded Whiskey Riders template automatically.
                </p>
              </div>

              {/* Targeting */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-cream/90">Recipients</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.is_global}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          is_global: e.target.checked,
                          trip_ids: e.target.checked ? [] : prev.trip_ids,
                        }))
                      }
                      className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey"
                    />
                    <span className="text-sm text-brand-cream/80">Not trip-specific</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.tag_all_members}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tag_all_members: e.target.checked,
                          member_ids: e.target.checked ? [] : prev.member_ids,
                        }))
                      }
                      className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey"
                    />
                    <span className="text-sm text-brand-cream/80">All Members</span>
                  </label>
                </div>
              </div>

              {/* Tag Trips */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-cream/90">Target Trips</p>
                <div className={`max-h-36 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-1 ${
                  form.is_global ? 'bg-brand-dark-grey/10 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/30'
                }`}>
                  {trips.length === 0 && (
                    <p className="text-xs text-brand-cream/50 py-2 px-1">No trips yet.</p>
                  )}
                  {trips.map((trip) => {
                    const selected = form.trip_ids.includes(trip.id);
                    return (
                      <label key={trip.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60 cursor-pointer">
                        <span className="text-sm text-brand-cream/80 truncate">{trip.name}</span>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, trip_ids: toggleSelection(prev.trip_ids, trip.id) }))}
                          className={`h-6 w-6 rounded border flex items-center justify-center shrink-0 ${
                            selected ? 'border-brand-brown bg-brand-brown text-brand-black' : 'border-brand-brown/30 text-brand-cream/50'
                          }`}
                        >
                          {selected && <Check className="w-4 h-4" />}
                        </button>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Tag Members */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-cream/90">Target Specific Riders</p>
                <div className="relative">
                  <Search className="w-4 h-4 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search riders..."
                    className={`w-full rounded-lg border border-brand-brown/20 py-2 pl-10 pr-4 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none ${
                      form.tag_all_members ? 'bg-brand-dark-grey/20 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/50'
                    }`}
                  />
                </div>
                <div className={`max-h-48 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-1 ${
                  form.tag_all_members ? 'bg-brand-dark-grey/10 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/30'
                }`}>
                  {filteredMembers.map((member) => {
                    const selected = form.member_ids.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60 cursor-pointer">
                        <span className="text-sm text-brand-cream/80 truncate">{getMemberDisplayName(member)}</span>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, member_ids: toggleSelection(prev.member_ids, member.id) }))}
                          className={`h-6 w-6 rounded border flex items-center justify-center shrink-0 ${
                            selected ? 'border-brand-brown bg-brand-brown text-brand-black' : 'border-brand-brown/30 text-brand-cream/50'
                          }`}
                        >
                          {selected && <Check className="w-4 h-4" />}
                        </button>
                      </label>
                    );
                  })}
                </div>
                {form.tag_all_members && (
                  <p className="text-xs text-brand-cream/50">Sending to every active member account.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleSave} isLoading={saving} variant="outline">
                  Save Draft
                </Button>
                {editingId && (
                  <Button variant="ghost" onClick={resetForm}>
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                )}
              </div>
              <p className="text-xs text-brand-cream/50">
                Drafts are saved and can be reviewed before sending. Use the Send button in the campaign list to dispatch.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign list panel */}
        <div className="space-y-6">
          {/* Drafts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-brown" />
                Drafts ({drafts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {drafts.length === 0 && (
                <p className="text-sm text-brand-cream/60 py-4">No drafts yet. Compose one to get started.</p>
              )}
              {drafts.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-3"
                >
                  <div>
                    <p className="font-semibold text-brand-cream truncate">{campaign.subject}</p>
                    <p className="text-xs text-brand-cream/55 mt-1">
                      Created {formatDate(campaign.created_at)}
                      {campaign.is_global && ' · General'}
                      {campaign.tag_all_members && ' · All Members'}
                      {campaign.trip_tags.length > 0 && ` · ${campaign.trip_tags.map((t) => t.name).join(', ')}`}
                      {campaign.member_tags.length > 0 && ` · ${campaign.member_tags.length} rider${campaign.member_tags.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setConfirmSend(campaign)}
                      isLoading={sendingId === campaign.id}
                    >
                      <Send className="w-4 h-4" />
                      Send Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(campaign)}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(campaign)}
                      isLoading={deletingId === campaign.id}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sent */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-brown" />
                Sent ({sent.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sent.length === 0 && (
                <p className="text-sm text-brand-cream/60 py-4">No campaigns sent yet.</p>
              )}
              {sent.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-2"
                >
                  <p className="font-semibold text-brand-cream truncate">{campaign.subject}</p>
                  <p className="text-xs text-brand-cream/55">
                    Sent {formatDate(campaign.sent_at)}
                    {campaign.tag_all_members && ' · All Members'}
                    {campaign.trip_tags.length > 0 && ` · ${campaign.trip_tags.map((t) => t.name).join(', ')}`}
                    {campaign.member_tags.length > 0 && ` · ${campaign.member_tags.length} rider${campaign.member_tags.length !== 1 ? 's' : ''}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(campaign)}
                      isLoading={deletingId === campaign.id}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
