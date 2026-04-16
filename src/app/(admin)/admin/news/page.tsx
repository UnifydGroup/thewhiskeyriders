'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { NewsCard } from '@/components/news/NewsCard';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/news/RichTextEditor';
import {
  Archive,
  Check,
  Copy,
  Edit2,
  ImageIcon,
  Link2,
  Newspaper,
  Plus,
  Send,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { getMemberDisplayName } from '@/lib/member-display';
import type { NewsAsset, NewsItem } from '@/lib/news/types';
import { hasRenderableNewsContent, normalizeEditorHtmlForSave, toEditorHtml } from '@/lib/news/content';

type NewsOptionsPayload = {
  success?: boolean;
  data?: {
    trips?: Array<{ id: string; name: string; slug: string; status: string }>;
    members?: Array<{
      id: string;
      full_name: string | null;
      nickname: string | null;
      avatar_url: string | null;
      status: string;
    }>;
  };
  error?: string;
};

type NewsListPayload = {
  success?: boolean;
  data?: {
    news?: NewsItem[];
  };
  error?: string;
};

type NewsAssetsPayload = {
  success?: boolean;
  data?: {
    assets?: NewsAsset[];
  };
  error?: string;
};

type NewsStatus = 'draft' | 'published' | 'archived';

const emptyForm = {
  title: '',
  content: '',
  status: 'draft' as NewsStatus,
  is_global: false,
  tag_all_members: false,
  trip_ids: [] as string[],
  member_ids: [] as string[],
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isImageAsset(asset: NewsAsset): boolean {
  return asset.file_type.startsWith('image/');
}

export default function AdminNewsPage() {
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const assetUploadInputRef = useRef<HTMLInputElement>(null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [assets, setAssets] = useState<NewsAsset[]>([]);
  const [trips, setTrips] = useState<Array<{ id: string; name: string; slug: string; status: string }>>([]);
  const [members, setMembers] = useState<
    Array<{ id: string; full_name: string | null; nickname: string | null; avatar_url: string | null; status: string }>
  >([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    return session.access_token;
  }, [supabase]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      const accessToken = await getAccessToken();

      const [newsResponse, optionsResponse, assetsResponse] = await Promise.all([
        fetch('/api/news?includeUnpublished=true&includeArchived=true&limit=200', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('/api/news/options', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('/api/news/assets?limit=200', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const newsPayload = (await newsResponse.json().catch(() => ({}))) as NewsListPayload;
      const optionsPayload = (await optionsResponse.json().catch(() => ({}))) as NewsOptionsPayload;
      const assetsPayload = (await assetsResponse.json().catch(() => ({}))) as NewsAssetsPayload;

      if (!newsResponse.ok || !newsPayload.success) {
        throw new Error(newsPayload.error || 'Failed to load news');
      }

      if (!optionsResponse.ok || !optionsPayload.success) {
        throw new Error(optionsPayload.error || 'Failed to load tag options');
      }

      if (!assetsResponse.ok || !assetsPayload.success) {
        throw new Error(assetsPayload.error || 'Failed to load asset library');
      }

      setNews(newsPayload.data?.news || []);
      setTrips(optionsPayload.data?.trips || []);
      setMembers(optionsPayload.data?.members || []);
      setAssets(assetsPayload.data?.assets || []);
    } catch (err: unknown) {
      console.error('Failed to load admin news data:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load news data',
      });
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const toggleSelection = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];

  const handleSave = async (statusOverride?: NewsStatus) => {
    const title = form.title.trim();
    const content = normalizeEditorHtmlForSave(form.content);
    const hasContent = hasRenderableNewsContent(content);
    const status = statusOverride || form.status;
    if (statusOverride) {
      setForm((prev) => ({ ...prev, status: statusOverride }));
    }

    if (!title || !hasContent) {
      setMessage({ type: 'error', text: 'Title and content are required.' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      const accessToken = await getAccessToken();

      const endpoint = editingId ? `/api/news/${editingId}` : '/api/news';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          content,
          status,
          is_global: form.is_global,
          tag_all_members: form.tag_all_members,
          trip_ids: form.is_global ? [] : form.trip_ids,
          member_ids: form.tag_all_members ? [] : form.member_ids,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to save news item');
      }

      setMessage({
        type: 'success',
        text: editingId
          ? `News item updated (${status}).`
          : `News item created (${status}).`,
      });
      resetForm();
      await loadData();
    } catch (err: unknown) {
      console.error('Failed to save news item:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save news item',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: NewsItem) => {
    const status: NewsStatus = item.is_archived
      ? 'archived'
      : item.is_published
        ? 'published'
        : 'draft';

    setEditingId(item.id);
    setForm({
      title: item.title,
      content: toEditorHtml(item.content),
      status,
      is_global: item.is_global,
      tag_all_members: item.tag_all_members,
      trip_ids: item.trip_tags.map((trip) => trip.id),
      member_ids: item.member_tags.map((member) => member.id),
    });
    setMessage(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (item: NewsItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) {
      return;
    }

    try {
      setDeletingId(item.id);
      setMessage(null);
      const accessToken = await getAccessToken();

      const response = await fetch(`/api/news/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to delete news item');
      }

      setMessage({ type: 'success', text: 'News item deleted.' });
      if (editingId === item.id) {
        resetForm();
      }
      await loadData();
    } catch (err: unknown) {
      console.error('Failed to delete news item:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete news item',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusAction = async (item: NewsItem, status: NewsStatus) => {
    try {
      setDeletingId(item.id);
      setMessage(null);
      const accessToken = await getAccessToken();

      const response = await fetch(`/api/news/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Failed to set status: ${status}`);
      }

      setMessage({ type: 'success', text: `News item marked ${status}.` });
      await loadData();
    } catch (err: unknown) {
      console.error('Failed to update status:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update status',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAsset(true);
      setMessage(null);
      const accessToken = await getAccessToken();
      const signResponse = await fetch('/api/news/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'create_signed_upload',
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        }),
      });

      const signPayload = (await signResponse.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          file_path?: string;
          token?: string;
          file_type?: string;
        };
        error?: string;
      };

      if (!signResponse.ok || !signPayload.success || !signPayload.data?.file_path || !signPayload.data?.token) {
        throw new Error(signPayload.error || 'Failed to prepare upload');
      }

      const { error: uploadError } = await supabase.storage
        .from('news-assets')
        .uploadToSignedUrl(signPayload.data.file_path, signPayload.data.token, file, {
          cacheControl: '3600',
          contentType: signPayload.data.file_type || file.type || undefined,
        });

      if (uploadError) {
        throw new Error(uploadError.message || 'Failed to upload file');
      }

      const registerResponse = await fetch('/api/news/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'register_upload',
          name: file.name,
          storage_path: signPayload.data.file_path,
          file_type: signPayload.data.file_type || file.type || 'application/octet-stream',
          file_size: file.size,
        }),
      });

      const payload = (await registerResponse.json().catch(() => ({}))) as {
        success?: boolean;
        data?: NewsAsset;
        error?: string;
      };

      if (!registerResponse.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to upload asset');
      }

      setAssets((prev) => [payload.data as NewsAsset, ...prev]);
      setMessage({ type: 'success', text: 'Asset uploaded.' });
    } catch (err: unknown) {
      console.error('Failed to upload asset:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to upload asset',
      });
    } finally {
      setUploadingAsset(false);
      if (assetUploadInputRef.current) {
        assetUploadInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAsset = async (asset: NewsAsset) => {
    if (!window.confirm(`Delete asset "${asset.name}"?`)) {
      return;
    }

    try {
      setDeletingAssetId(asset.id);
      setMessage(null);
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/news/assets/${asset.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to delete asset');
      }

      setAssets((prev) => prev.filter((item) => item.id !== asset.id));
      setMessage({ type: 'success', text: 'Asset deleted.' });
    } catch (err: unknown) {
      console.error('Failed to delete asset:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete asset',
      });
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleCopyAssetUrl = async (asset: NewsAsset) => {
    try {
      await navigator.clipboard.writeText(asset.file_url);
      setMessage({ type: 'success', text: `Copied URL for "${asset.name}"` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to copy URL' });
    }
  };

  const filteredMembers = members.filter((member) => {
    if (!memberSearch.trim()) return true;
    const searchLower = memberSearch.toLowerCase();
    const name = getMemberDisplayName(member).toLowerCase();
    return name.includes(searchLower);
  });

  const filteredAssets = assets.filter((asset) => {
    if (!assetSearch.trim()) return true;
    const searchLower = assetSearch.toLowerCase();
    return (
      asset.name.toLowerCase().includes(searchLower) ||
      asset.file_type.toLowerCase().includes(searchLower) ||
      asset.file_url.toLowerCase().includes(searchLower)
    );
  });

  const filteredImageAssets = filteredAssets.filter(isImageAsset);

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
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">News Management</h1>
        <p className="text-brand-cream/70">Create rich announcements, upload assets, and tag trips or riders.</p>
      </div>

      {message && (
        <Card className={message.type === 'error' ? 'border border-red-500/40' : 'border border-green-500/40'}>
          <CardContent className={`py-4 ${message.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
            {message.text}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5 text-brand-brown" /> : <Plus className="w-5 h-5 text-brand-brown" />}
                {editingId ? 'Edit News Item' : 'Create News Item'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Headline"
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-2 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-cream/90">Content</label>
                <RichTextEditor
                  ref={editorRef}
                  value={form.content}
                  onChange={(nextContent) => setForm((prev) => ({ ...prev, content: nextContent }))}
                  onRequestInsertImage={() => setAssetPickerOpen(true)}
                  placeholder="Write the update for members..."
                />
                <p className="text-xs text-brand-cream/50">
                  Toolbar supports text formatting, headings, alignment, links, and image insertion.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-cream/90">Targeting</p>
                <p className="text-xs text-brand-cream/55">
                  Global = team-wide news not attached to a specific trip. Trip tags = trip news. Rider-only = member-specific news.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.is_global}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          is_global: event.target.checked,
                          trip_ids: event.target.checked ? [] : prev.trip_ids,
                        }))
                      }
                      className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey"
                    />
                    <span className="text-sm text-brand-cream/80">Global (not trip-specific)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.tag_all_members}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          tag_all_members: event.target.checked,
                          member_ids: event.target.checked ? [] : prev.member_ids,
                        }))
                      }
                      className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey"
                    />
                    <span className="text-sm text-brand-cream/80">All Users (every member)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-cream/90">Tag Trips</p>
                <div className={`max-h-40 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-2 ${
                  form.is_global ? 'bg-brand-dark-grey/10 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/30'
                }`}>
                  {trips.map((trip) => {
                    const selected = form.trip_ids.includes(trip.id);
                    return (
                      <label key={trip.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60">
                        <span className="text-sm text-brand-cream/80 truncate">{trip.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              trip_ids: toggleSelection(prev.trip_ids, trip.id),
                            }))
                          }
                          className={`h-6 w-6 rounded border flex items-center justify-center ${
                            selected
                              ? 'border-brand-brown bg-brand-brown text-brand-black'
                              : 'border-brand-brown/30 text-brand-cream/50'
                          }`}
                        >
                          {selected && <Check className="w-4 h-4" />}
                        </button>
                      </label>
                    );
                  })}
                </div>
                {form.is_global && (
                  <p className="text-xs text-brand-cream/50">
                    Global posts are not tied to trip pages. They appear in the Global News feed for targeted members.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-cream/90">Tag Riders</p>
                <div className="relative">
                  <Search className="w-4 h-4 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search riders..."
                    className={`w-full rounded-lg border border-brand-brown/20 py-2 pl-10 pr-4 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none ${
                      form.tag_all_members ? 'bg-brand-dark-grey/20 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/50'
                    }`}
                  />
                </div>
                <div className={`max-h-56 overflow-y-auto rounded-lg border border-brand-brown/20 p-2 space-y-2 ${
                  form.tag_all_members ? 'bg-brand-dark-grey/10 opacity-60 pointer-events-none' : 'bg-brand-dark-grey/30'
                }`}>
                  {filteredMembers.map((member) => {
                    const selected = form.member_ids.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-brand-dark-grey/60">
                        <span className="text-sm text-brand-cream/80 truncate">{getMemberDisplayName(member)}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              member_ids: toggleSelection(prev.member_ids, member.id),
                            }))
                          }
                          className={`h-6 w-6 rounded border flex items-center justify-center ${
                            selected
                              ? 'border-brand-brown bg-brand-brown text-brand-black'
                              : 'border-brand-brown/30 text-brand-cream/50'
                          }`}
                        >
                          {selected && <Check className="w-4 h-4" />}
                        </button>
                      </label>
                    );
                  })}
                </div>
                {form.tag_all_members && (
                  <p className="text-xs text-brand-cream/50">
                    This update is targeted to every member account.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => handleSave('draft')} isLoading={saving} variant="outline">
                  Save Draft
                </Button>
                <Button onClick={() => handleSave('published')} isLoading={saving}>
                  <Send className="w-4 h-4" />
                  {editingId ? 'Publish Update' : 'Publish'}
                </Button>
                {editingId && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSave('archived')}
                    isLoading={saving}
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </Button>
                )}
                {editingId && (
                  <Button variant="ghost" onClick={resetForm}>
                    <X className="w-4 h-4" />
                    Cancel Edit
                  </Button>
                )}
              </div>
              <p className="text-xs text-brand-cream/50">
                Current editor status: <span className="uppercase">{form.status}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-brand-brown" />
                  Asset Library ({assets.length})
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => assetUploadInputRef.current?.click()}
                  isLoading={uploadingAsset}
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Asset
                </Button>
              </CardTitle>
              <input
                ref={assetUploadInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf,text/*,application/json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                className="hidden"
                onChange={handleAssetUpload}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-brand-cream/55">
                Supports images, videos, PDF, audio, text and common office files (max 250MB).
              </p>
              <div className="relative">
                <Search className="w-4 h-4 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(event) => setAssetSearch(event.target.value)}
                  placeholder="Search assets..."
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 py-2 pl-10 pr-4 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>

              {filteredAssets.length === 0 && (
                <p className="text-sm text-brand-cream/60 py-4">No assets yet.</p>
              )}

              <div className="max-h-[28rem] overflow-y-auto space-y-2 pr-1">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-3 space-y-2"
                  >
                    <div className="flex items-start gap-3">
                      {isImageAsset(asset) ? (
                        <img
                          src={asset.file_url}
                          alt={asset.name}
                          className="h-14 w-14 rounded object-cover border border-brand-brown/20"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded border border-brand-brown/20 bg-brand-dark-grey/60 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-brand-cream/60" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-brand-cream truncate">{asset.name}</p>
                        <p className="text-xs text-brand-cream/60">{asset.file_type} · {formatBytes(asset.file_size)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopyAssetUrl(asset)}>
                        <Copy className="w-4 h-4" />
                        Copy URL
                      </Button>
                      {isImageAsset(asset) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => editorRef.current?.insertImage(asset.file_url, asset.name)}
                        >
                          <ImageIcon className="w-4 h-4" />
                          Insert Image
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editorRef.current?.insertLink(asset.file_url, asset.name)}
                      >
                        <Link2 className="w-4 h-4" />
                        Insert Link
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteAsset(asset)}
                        isLoading={deletingAssetId === asset.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-brand-brown" />
                Existing News ({news.length})
              </CardTitle>
            </CardHeader>
          </Card>

          {news.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-brand-cream/70">
                No news items yet.
              </CardContent>
            </Card>
          )}

          {news.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                {!item.is_archived && !item.is_published && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusAction(item, 'published')}
                    isLoading={deletingId === item.id}
                  >
                    <Send className="w-4 h-4" />
                    Publish
                  </Button>
                )}
                {!item.is_archived && item.is_published && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusAction(item, 'draft')}
                    isLoading={deletingId === item.id}
                  >
                    Save As Draft
                  </Button>
                )}
                {!item.is_archived && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusAction(item, 'archived')}
                    isLoading={deletingId === item.id}
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(item)}
                  isLoading={deletingId === item.id}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
              <NewsCard item={item} compact />
            </div>
          ))}
        </div>
      </div>

      {assetPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border border-brand-brown/20 bg-brand-black shadow-2xl">
            <div className="flex items-center justify-between border-b border-brand-brown/20 px-5 py-4">
              <h3 className="text-lg font-semibold text-brand-cream">Insert Image From Asset Library</h3>
              <Button variant="ghost" size="sm" onClick={() => setAssetPickerOpen(false)}>
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(event) => setAssetSearch(event.target.value)}
                  placeholder="Search images..."
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 py-2 pl-10 pr-4 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>

              {filteredImageAssets.length === 0 ? (
                <p className="text-brand-cream/60 py-6 text-center">No image assets available.</p>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-1">
                  {filteredImageAssets.map((asset) => (
                    <div key={asset.id} className="rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-3 space-y-2">
                      <img
                        src={asset.file_url}
                        alt={asset.name}
                        className="h-36 w-full rounded object-cover border border-brand-brown/20"
                      />
                      <p className="text-sm font-semibold text-brand-cream truncate">{asset.name}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            editorRef.current?.insertImage(asset.file_url, asset.name);
                            setAssetPickerOpen(false);
                          }}
                        >
                          <ImageIcon className="w-4 h-4" />
                          Insert
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyAssetUrl(asset)}
                        >
                          <Copy className="w-4 h-4" />
                          Copy URL
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
