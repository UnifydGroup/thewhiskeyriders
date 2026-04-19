'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/news/RichTextEditor';
import {
  AlertTriangle,
  BookTemplate,
  Check,
  ChevronDown,
  Edit2,
  FileText,
  Layout,
  Mail,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { getMemberDisplayName } from '@/lib/member-display';
import { normalizeEditorHtmlForSave, toEditorHtml, hasRenderableNewsContent } from '@/lib/news/content';

// ─── Types ───────────────────────────────────────────────────────────────────

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
type Template = {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  created_at: string | null;
  updated_at: string | null;
  creator: { id: string; full_name: string | null; nickname: string | null } | null;
};
type HeaderSettings = {
  email_header_title: string;
  email_header_tagline: string;
  email_footer_text: string;
};

// ─── Defaults ────────────────────────────────────────────────────────────────

const emptyCampaignForm = {
  subject: '',
  body: '',
  is_global: false,
  tag_all_members: false,
  trip_ids: [] as string[],
  member_ids: [] as string[],
};

const emptyTemplateForm = {
  name: '',
  description: '',
  subject: '',
  body: '',
};

const defaultHeader: HeaderSettings = {
  email_header_title: 'The Whiskey Riders',
  email_header_tagline: 'Ride. Bond. Remember.',
  email_footer_text: "You're receiving this because you're a member of The Whiskey Riders.",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminEmailsPage() {
  const supabase = useMemo(() => createClient(), []);
  const campaignEditorRef = useRef<RichTextEditorHandle>(null);
  const templateEditorRef = useRef<RichTextEditorHandle>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates' | 'header'>('campaigns');

  // ── Campaign state ──
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState<Campaign | null>(null);

  // ── Template state ──
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerSearch, setTemplatePickerSearch] = useState('');

  // ── Header/footer state ──
  const [header, setHeader] = useState<HeaderSettings>(defaultHeader);
  const [headerOriginal, setHeaderOriginal] = useState<HeaderSettings>(defaultHeader);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [siteSettingsId, setSiteSettingsId] = useState<string | null>(null);

  // ── Shared state ──
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Auth ──────────────────────────────────────────────────────────────────

  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
    return session.access_token;
  }, [supabase]);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      const accessToken = await getAccessToken();

      const [campaignsRes, optionsRes, templatesRes] = await Promise.all([
        fetch('/api/emails?limit=200', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/news/options', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/email-templates', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);

      const campaignsData = await campaignsRes.json().catch(() => ({})) as {
        success?: boolean; data?: { campaigns?: Campaign[] }; error?: string;
      };
      const optionsData = await optionsRes.json().catch(() => ({})) as {
        success?: boolean; data?: { trips?: Trip[]; members?: Member[] }; error?: string;
      };
      const templatesData = await templatesRes.json().catch(() => ({})) as {
        success?: boolean; data?: { templates?: Template[] }; error?: string;
      };

      if (!campaignsRes.ok || !campaignsData.success) {
        throw new Error(campaignsData.error || 'Failed to load campaigns');
      }

      setCampaigns(campaignsData.data?.campaigns || []);
      setTrips(optionsData.data?.trips || []);
      setMembers(optionsData.data?.members || []);
      setTemplates(templatesData.data?.templates || []);

      // Load header settings directly via Supabase client
      const { data: settingsRow } = await supabase
        .from('site_settings')
        .select('id, email_header_title, email_header_tagline, email_footer_text')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsRow) {
        const loaded: HeaderSettings = {
          email_header_title: settingsRow.email_header_title?.trim() || defaultHeader.email_header_title,
          email_header_tagline: settingsRow.email_header_tagline?.trim() || defaultHeader.email_header_tagline,
          email_footer_text: settingsRow.email_footer_text?.trim() || defaultHeader.email_footer_text,
        };
        setSiteSettingsId(settingsRow.id);
        setHeader(loaded);
        setHeaderOriginal(loaded);
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ─── Campaign handlers ─────────────────────────────────────────────────────

  const resetCampaignForm = () => {
    setEditingCampaignId(null);
    setCampaignForm(emptyCampaignForm);
    setMessage(null);
  };

  const toggleSelection = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];

  const handleLoadTemplate = (template: Template) => {
    setCampaignForm((prev) => ({
      ...prev,
      subject: template.subject,
      body: toEditorHtml(template.body),
    }));
    setShowTemplatePicker(false);
    setTemplatePickerSearch('');
  };

  const handleCampaignSave = async () => {
    const subject = campaignForm.subject.trim();
    const body = normalizeEditorHtmlForSave(campaignForm.body);
    if (!subject) { setMessage({ type: 'error', text: 'Subject line is required.' }); return; }
    if (!hasRenderableNewsContent(body)) { setMessage({ type: 'error', text: 'Email body is required.' }); return; }

    try {
      setCampaignSaving(true);
      setMessage(null);
      const accessToken = await getAccessToken();

      const endpoint = editingCampaignId ? `/api/emails/${editingCampaignId}` : '/api/emails';
      const method = editingCampaignId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          subject, body,
          is_global: campaignForm.is_global,
          tag_all_members: campaignForm.tag_all_members,
          trip_ids: campaignForm.is_global ? [] : campaignForm.trip_ids,
          member_ids: campaignForm.tag_all_members ? [] : campaignForm.member_ids,
        }),
      });

      const payload = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to save campaign');

      setMessage({ type: 'success', text: editingCampaignId ? 'Campaign updated.' : 'Campaign saved as draft.' });
      resetCampaignForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save campaign' });
    } finally {
      setCampaignSaving(false);
    }
  };

  const handleCampaignEdit = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id);
    setCampaignForm({
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

      const res = await fetch(`/api/emails/${campaign.id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const payload = await res.json().catch(() => ({})) as {
        success?: boolean; error?: string;
        data?: { sent: number; failed: number; attempted: number };
      };

      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to send campaign');

      const { sent, failed, attempted } = payload.data || { sent: 0, failed: 0, attempted: 0 };
      setMessage({
        type: failed > 0 && sent === 0 ? 'error' : 'success',
        text: `Sent to ${sent} of ${attempted} members.${failed > 0 ? ` ${failed} failed.` : ''}`,
      });
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send campaign' });
    } finally {
      setSendingId(null);
    }
  };

  const handleCampaignDelete = async (campaign: Campaign) => {
    if (!window.confirm(`Delete "${campaign.subject}"?`)) return;
    try {
      setDeletingCampaignId(campaign.id);
      const accessToken = await getAccessToken();
      const res = await fetch(`/api/emails/${campaign.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to delete');
      setMessage({ type: 'success', text: 'Campaign deleted.' });
      if (editingCampaignId === campaign.id) resetCampaignForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete campaign' });
    } finally {
      setDeletingCampaignId(null);
    }
  };

  // ─── Template handlers ─────────────────────────────────────────────────────

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm);
  };

  const handleTemplateSave = async () => {
    const name = templateForm.name.trim();
    const subject = templateForm.subject.trim();
    const body = normalizeEditorHtmlForSave(templateForm.body);
    if (!name) { setMessage({ type: 'error', text: 'Template name is required.' }); return; }
    if (!subject) { setMessage({ type: 'error', text: 'Subject line is required.' }); return; }
    if (!hasRenderableNewsContent(body)) { setMessage({ type: 'error', text: 'Body is required.' }); return; }

    try {
      setTemplateSaving(true);
      setMessage(null);
      const accessToken = await getAccessToken();

      const endpoint = editingTemplateId ? `/api/email-templates/${editingTemplateId}` : '/api/email-templates';
      const method = editingTemplateId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name, description: templateForm.description.trim(), subject, body }),
      });

      const payload = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to save template');

      setMessage({ type: 'success', text: editingTemplateId ? 'Template updated.' : 'Template saved.' });
      resetTemplateForm();
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save template' });
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleTemplateEdit = (template: Template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      description: template.description,
      subject: template.subject,
      body: toEditorHtml(template.body),
    });
    setPreviewTemplate(null);
    setMessage(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTemplateDelete = async (template: Template) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      setDeletingTemplateId(template.id);
      const accessToken = await getAccessToken();
      const res = await fetch(`/api/email-templates/${template.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to delete');
      setMessage({ type: 'success', text: 'Template deleted.' });
      if (editingTemplateId === template.id) resetTemplateForm();
      if (previewTemplate?.id === template.id) setPreviewTemplate(null);
      await loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete template' });
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // ─── Header/Footer handlers ────────────────────────────────────────────────

  const handleHeaderSave = async () => {
    try {
      setHeaderSaving(true);
      setMessage(null);

      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user?.id) throw new Error('Not authenticated');

      const updatePayload = {
        email_header_title: header.email_header_title.trim() || defaultHeader.email_header_title,
        email_header_tagline: header.email_header_tagline.trim() || defaultHeader.email_header_tagline,
        email_footer_text: header.email_footer_text.trim() || defaultHeader.email_footer_text,
        updated_by: userResult.user.id,
      };

      if (siteSettingsId) {
        const { error } = await supabase
          .from('site_settings')
          .update(updatePayload)
          .eq('id', siteSettingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('site_settings')
          .insert(updatePayload)
          .select('id')
          .single();
        if (error) throw error;
        setSiteSettingsId(data?.id ?? null);
      }

      setHeaderOriginal({ ...header });
      setMessage({ type: 'success', text: 'Email header and footer saved.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save header settings' });
    } finally {
      setHeaderSaving(false);
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    return getMemberDisplayName(m).toLowerCase().includes(memberSearch.toLowerCase());
  });

  const filteredTemplatesForPicker = templates.filter((t) => {
    if (!templatePickerSearch.trim()) return true;
    return (
      t.name.toLowerCase().includes(templatePickerSearch.toLowerCase()) ||
      t.subject.toLowerCase().includes(templatePickerSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(templatePickerSearch.toLowerCase())
    );
  });

  const drafts = campaigns.filter((c) => c.status === 'draft');
  const sent = campaigns.filter((c) => c.status === 'sent');
  const headerChanged = JSON.stringify(header) !== JSON.stringify(headerOriginal);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">Email</h1>
        <p className="text-brand-cream/70">Manage campaigns, templates, and email branding.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-brand-brown/20 pb-0">
        {([
          { id: 'campaigns', label: 'Campaigns', icon: Mail },
          { id: 'templates', label: 'Templates', icon: BookTemplate },
          { id: 'header', label: 'Header & Footer', icon: Layout },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-brand-brown text-brand-brown'
                : 'border-transparent text-brand-cream/60 hover:text-brand-cream hover:border-brand-brown/40'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Message banner */}
      {message && (
        <Card className={message.type === 'error' ? 'border border-red-500/40' : 'border border-green-500/40'}>
          <CardContent className={`py-3 flex items-center justify-between ${message.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
          </CardContent>
        </Card>
      )}

      {/* ── CAMPAIGNS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <>
          {/* Send confirmation modal */}
          {confirmSend && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="bg-[#1a1a1a] border border-brand-brown/30 rounded-xl p-6 max-w-md w-full space-y-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-brand-brown shrink-0" />
                  <h2 className="text-lg font-semibold text-brand-cream">Send Campaign?</h2>
                </div>
                <p className="text-sm text-brand-cream/70">
                  <strong className="text-brand-cream">{confirmSend.subject}</strong> will be emailed to all targeted members. This cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setConfirmSend(null)}>Cancel</Button>
                  <Button onClick={() => handleSendCampaign(confirmSend)} isLoading={sendingId === confirmSend.id}>
                    <Send className="w-4 h-4" /> Yes, Send Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Compose / Edit panel */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {editingCampaignId ? <Edit2 className="w-5 h-5 text-brand-brown" /> : <Plus className="w-5 h-5 text-brand-brown" />}
                  {editingCampaignId ? 'Edit Campaign' : 'Compose Email'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Load template button */}
                {templates.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTemplatePicker((p) => !p)}
                      className="flex items-center gap-2 text-sm text-brand-brown hover:text-brand-brown/80 transition-colors"
                    >
                      <BookTemplate className="w-4 h-4" />
                      Load from template
                      <ChevronDown className={`w-4 h-4 transition-transform ${showTemplatePicker ? 'rotate-180' : ''}`} />
                    </button>
                    {showTemplatePicker && (
                      <div className="absolute top-8 left-0 z-20 w-full sm:w-96 rounded-xl border border-brand-brown/30 bg-[#1a1a1a] shadow-2xl">
                        <div className="p-3 border-b border-brand-brown/20">
                          <input
                            type="text"
                            value={templatePickerSearch}
                            onChange={(e) => setTemplatePickerSearch(e.target.value)}
                            placeholder="Search templates..."
                            autoFocus
                            className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-3 py-1.5 text-sm text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-brand-brown/10">
                          {filteredTemplatesForPicker.length === 0 && (
                            <p className="px-4 py-3 text-sm text-brand-cream/50">No templates found.</p>
                          )}
                          {filteredTemplatesForPicker.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleLoadTemplate(t)}
                              className="w-full text-left px-4 py-3 hover:bg-brand-dark-grey/50 transition-colors"
                            >
                              <p className="text-sm font-medium text-brand-cream">{t.name}</p>
                              {t.description && <p className="text-xs text-brand-cream/50 mt-0.5">{t.description}</p>}
                              <p className="text-xs text-brand-cream/40 mt-0.5 truncate">Subject: {t.subject}</p>
                            </button>
                          ))}
                        </div>
                        <div className="p-2 border-t border-brand-brown/20 text-right">
                          <button type="button" onClick={() => setShowTemplatePicker(false)} className="text-xs text-brand-cream/50 hover:text-brand-cream px-2 py-1">Close</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-cream/90">Subject line</label>
                  <input
                    type="text"
                    value={campaignForm.subject}
                    onChange={(e) => setCampaignForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g. Morocco 2027 – Important Update"
                    className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                  />
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-cream/90">Body</label>
                  <RichTextEditor
                    ref={campaignEditorRef}
                    value={campaignForm.body}
                    onChange={(v) => setCampaignForm((p) => ({ ...p, body: v }))}
                    placeholder="Write your email content here..."
                  />
                  <p className="text-xs text-brand-cream/50">The branded header and footer are added automatically.</p>
                </div>

                {/* Recipients */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-brand-cream/90">Recipients</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={campaignForm.is_global}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, is_global: e.target.checked, trip_ids: e.target.checked ? [] : p.trip_ids }))}
                        className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey"
                      />
                      <span className="text-sm text-brand-cream/80">Not trip-specific</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={campaignForm.tag_all_members}
                        onChange={(e) => setCampaignForm((p) => ({ ...p, tag_all_members: e.target.checked, member_ids: e.target.checked ? [] : p.member_ids }))}
                        className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey"
                      />
                      <span className="text-sm text-brand-cream/80">All Members</span>
                    </label>
                  </div>
                </div>

                {/* Target trips */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-brand-cream/90">Target Trips</p>
                  <div className={`max-h-36 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-1 ${campaignForm.is_global ? 'bg-brand-dark-grey/10 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/30'}`}>
                    {trips.length === 0 && <p className="text-xs text-brand-cream/50 py-2 px-1">No trips yet.</p>}
                    {trips.map((trip) => {
                      const selected = campaignForm.trip_ids.includes(trip.id);
                      return (
                        <label key={trip.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60 cursor-pointer">
                          <span className="text-sm text-brand-cream/80 truncate">{trip.name}</span>
                          <button
                            type="button"
                            onClick={() => setCampaignForm((p) => ({ ...p, trip_ids: toggleSelection(p.trip_ids, trip.id) }))}
                            className={`h-6 w-6 rounded border flex items-center justify-center shrink-0 ${selected ? 'border-brand-brown bg-brand-brown text-brand-black' : 'border-brand-brown/30 text-brand-cream/50'}`}
                          >
                            {selected && <Check className="w-4 h-4" />}
                          </button>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Target members */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-brand-cream/90">Target Specific Riders</p>
                  <div className="relative">
                    <Search className="w-4 h-4 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search riders..."
                      className={`w-full rounded-lg border border-brand-brown/20 py-2 pl-10 pr-4 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none ${campaignForm.tag_all_members ? 'bg-brand-dark-grey/20 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/50'}`}
                    />
                  </div>
                  <div className={`max-h-48 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-1 ${campaignForm.tag_all_members ? 'bg-brand-dark-grey/10 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/30'}`}>
                    {filteredMembers.map((member) => {
                      const selected = campaignForm.member_ids.includes(member.id);
                      return (
                        <label key={member.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60 cursor-pointer">
                          <span className="text-sm text-brand-cream/80 truncate">{getMemberDisplayName(member)}</span>
                          <button
                            type="button"
                            onClick={() => setCampaignForm((p) => ({ ...p, member_ids: toggleSelection(p.member_ids, member.id) }))}
                            className={`h-6 w-6 rounded border flex items-center justify-center shrink-0 ${selected ? 'border-brand-brown bg-brand-brown text-brand-black' : 'border-brand-brown/30 text-brand-cream/50'}`}
                          >
                            {selected && <Check className="w-4 h-4" />}
                          </button>
                        </label>
                      );
                    })}
                  </div>
                  {campaignForm.tag_all_members && <p className="text-xs text-brand-cream/50">Sending to every active member account.</p>}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleCampaignSave} isLoading={campaignSaving} variant="outline">Save Draft</Button>
                  {editingCampaignId && (
                    <Button variant="ghost" onClick={resetCampaignForm}><X className="w-4 h-4" /> Cancel</Button>
                  )}
                </div>
                <p className="text-xs text-brand-cream/50">Drafts can be reviewed before sending. Use Send in the list to dispatch.</p>
              </CardContent>
            </Card>

            {/* Campaign list */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-brand-brown" />
                    Drafts ({drafts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {drafts.length === 0 && <p className="text-sm text-brand-cream/60 py-4">No drafts yet.</p>}
                  {drafts.map((campaign) => (
                    <div key={campaign.id} className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-3">
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
                        <Button size="sm" onClick={() => setConfirmSend(campaign)} isLoading={sendingId === campaign.id}>
                          <Send className="w-4 h-4" /> Send Now
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCampaignEdit(campaign)}>
                          <Edit2 className="w-4 h-4" /> Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleCampaignDelete(campaign)} isLoading={deletingCampaignId === campaign.id}>
                          <Trash2 className="w-4 h-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-brown" />
                    Sent ({sent.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sent.length === 0 && <p className="text-sm text-brand-cream/60 py-4">No campaigns sent yet.</p>}
                  {sent.map((campaign) => (
                    <div key={campaign.id} className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-2">
                      <p className="font-semibold text-brand-cream truncate">{campaign.subject}</p>
                      <p className="text-xs text-brand-cream/55">
                        Sent {formatDate(campaign.sent_at)}
                        {campaign.tag_all_members && ' · All Members'}
                        {campaign.trip_tags.length > 0 && ` · ${campaign.trip_tags.map((t) => t.name).join(', ')}`}
                        {campaign.member_tags.length > 0 && ` · ${campaign.member_tags.length} rider${campaign.member_tags.length !== 1 ? 's' : ''}`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="danger" onClick={() => handleCampaignDelete(campaign)} isLoading={deletingCampaignId === campaign.id}>
                          <Trash2 className="w-4 h-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ── TEMPLATES TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <>
          {/* Template preview modal */}
          {previewTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 overflow-y-auto">
              <div className="bg-[#1a1a1a] border border-brand-brown/30 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-brand-brown/20 shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold text-brand-cream">{previewTemplate.name}</h2>
                    <p className="text-xs text-brand-cream/55 mt-0.5">Subject: {previewTemplate.subject}</p>
                  </div>
                  <button onClick={() => setPreviewTemplate(null)} className="text-brand-cream/60 hover:text-brand-cream transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-6">
                  <div className="rounded-lg overflow-hidden border border-brand-brown/30 text-sm">
                    <div className="bg-brand-brown px-6 py-4 text-center">
                      <p className="text-white font-semibold tracking-widest text-xs uppercase">{header.email_header_title}</p>
                      <p className="text-white/70 text-xs tracking-wide mt-1">{header.email_header_tagline}</p>
                    </div>
                    <div className="bg-[#111] px-6 py-6">
                      <p className="text-[#C9B98A] mb-3 text-sm">Hi [Recipient],</p>
                      <div
                        className="prose prose-invert prose-sm max-w-none text-[#d4c9a8] leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: previewTemplate.body }}
                      />
                    </div>
                    <div className="bg-[#111] border-t border-brand-brown/20 px-6 py-4 text-center">
                      <p className="text-[#666] text-xs">{header.email_footer_text}</p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-brand-brown/20 shrink-0 flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setPreviewTemplate(null)}>Close</Button>
                  <Button variant="outline" onClick={() => handleTemplateEdit(previewTemplate)}>
                    <Edit2 className="w-4 h-4" /> Edit Template
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Create / Edit */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {editingTemplateId ? <Edit2 className="w-5 h-5 text-brand-brown" /> : <Plus className="w-5 h-5 text-brand-brown" />}
                  {editingTemplateId ? 'Edit Template' : 'New Template'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-cream/90">Template name</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Welcome to the Ride"
                    className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-cream/90">
                    Description <span className="text-brand-cream/40 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="e.g. Used for new member welcome emails"
                    className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-cream/90">Default subject line</label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g. Welcome to The Whiskey Riders"
                    className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                  />
                  <p className="text-xs text-brand-cream/50">Can be edited when the template is loaded into a campaign.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-cream/90">Body</label>
                  <RichTextEditor
                    ref={templateEditorRef}
                    value={templateForm.body}
                    onChange={(v) => setTemplateForm((p) => ({ ...p, body: v }))}
                    placeholder="Write your template content here..."
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleTemplateSave} isLoading={templateSaving}>
                    <Check className="w-4 h-4" />
                    {editingTemplateId ? 'Update Template' : 'Save Template'}
                  </Button>
                  {editingTemplateId && (
                    <Button variant="ghost" onClick={resetTemplateForm}><X className="w-4 h-4" /> Cancel</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Template list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-brown" />
                  Saved Templates ({templates.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.length === 0 && (
                  <p className="text-sm text-brand-cream/60 py-4">No templates yet. Create one to get started.</p>
                )}
                {templates.map((template) => {
                  const creatorName = template.creator
                    ? getMemberDisplayName(template.creator as { full_name: string | null; nickname: string | null; avatar_url?: string | null; status?: string })
                    : null;
                  return (
                    <div key={template.id} className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-brand-cream">{template.name}</p>
                        {template.description && <p className="text-sm text-brand-cream/60 mt-0.5">{template.description}</p>}
                        <p className="text-xs text-brand-cream/40 mt-1">Subject: <span className="text-brand-cream/60">{template.subject}</span></p>
                        <p className="text-xs text-brand-cream/40 mt-0.5">
                          {creatorName ? `By ${creatorName} · ` : ''}Updated {formatDateShort(template.updated_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(template)}>Preview</Button>
                        <Button size="sm" variant="outline" onClick={() => handleTemplateEdit(template)}>
                          <Edit2 className="w-4 h-4" /> Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleTemplateDelete(template)} isLoading={deletingTemplateId === template.id}>
                          <Trash2 className="w-4 h-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── HEADER & FOOTER TAB ───────────────────────────────────────────── */}
      {activeTab === 'header' && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-brand-brown" />
                Email Header
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-brand-cream/60">
                This branded header appears at the top of every email sent from the portal.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Title</label>
                <input
                  type="text"
                  value={header.email_header_title}
                  onChange={(e) => setHeader((p) => ({ ...p, email_header_title: e.target.value }))}
                  placeholder="The Whiskey Riders"
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Tagline</label>
                <input
                  type="text"
                  value={header.email_header_tagline}
                  onChange={(e) => setHeader((p) => ({ ...p, email_header_tagline: e.target.value }))}
                  placeholder="Ride. Bond. Remember."
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>

              {/* Live header preview */}
              <div className="rounded-lg overflow-hidden border border-brand-brown/30 mt-2">
                <div className="bg-brand-brown px-6 py-4 text-center">
                  <p className="text-white font-semibold tracking-widest text-xs uppercase">
                    {header.email_header_title || 'The Whiskey Riders'}
                  </p>
                  <p className="text-white/70 text-xs tracking-wide mt-1">
                    {header.email_header_tagline || 'Ride. Bond. Remember.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-brown" />
                Email Footer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-brand-cream/60">
                This text appears at the bottom of every email as a brief explanation of why the recipient is receiving it.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Footer text</label>
                <textarea
                  rows={3}
                  value={header.email_footer_text}
                  onChange={(e) => setHeader((p) => ({ ...p, email_footer_text: e.target.value }))}
                  placeholder="You're receiving this because you're a member of The Whiskey Riders."
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none resize-none"
                />
              </div>

              {/* Live footer preview */}
              <div className="rounded-lg overflow-hidden border border-brand-brown/30">
                <div className="bg-[#111] border-t border-brand-brown/20 px-6 py-4 text-center">
                  <p className="text-[#666] text-xs">
                    {header.email_footer_text || "You're receiving this because you're a member of The Whiskey Riders."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full email preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-brand-cream/70">Full Email Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-brand-brown/30 text-sm">
                <div className="bg-brand-brown px-6 py-4 text-center">
                  <p className="text-white font-semibold tracking-widest text-xs uppercase">{header.email_header_title || 'The Whiskey Riders'}</p>
                  <p className="text-white/70 text-xs tracking-wide mt-1">{header.email_header_tagline || 'Ride. Bond. Remember.'}</p>
                </div>
                <div className="bg-[#111] px-6 py-6">
                  <p className="text-[#C9B98A] mb-3 text-sm">Hi Gloorious,</p>
                  <p className="text-[#d4c9a8] text-sm leading-relaxed">Your email body content will appear here...</p>
                  <div className="mt-6 text-center">
                    <div className="inline-block bg-brand-brown text-white text-sm font-semibold px-7 py-3 rounded-lg">Visit the Portal</div>
                  </div>
                </div>
                <div className="bg-[#111] border-t border-brand-brown/20 px-6 py-4 text-center">
                  <p className="text-[#666] text-xs">{header.email_footer_text || "You're receiving this because you're a member of The Whiskey Riders."}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleHeaderSave} isLoading={headerSaving} disabled={!headerChanged && !headerSaving}>
              <Check className="w-4 h-4" />
              Save Changes
            </Button>
            {headerChanged && (
              <Button variant="ghost" onClick={() => setHeader({ ...headerOriginal })}>
                <X className="w-4 h-4" /> Reset
              </Button>
            )}
          </div>
          {!headerChanged && !headerSaving && (
            <p className="text-xs text-brand-cream/40">No unsaved changes.</p>
          )}
        </div>
      )}

    </div>
  );
}
