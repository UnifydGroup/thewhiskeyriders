'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { NewsCard } from '@/components/news/NewsCard';
import { Check, Edit2, Newspaper, Plus, Search, Trash2, X } from 'lucide-react';
import { getMemberDisplayName } from '@/lib/member-display';
import type { NewsItem } from '@/lib/news/types';

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

const emptyForm = {
  title: '',
  content: '',
  is_published: true,
  trip_ids: [] as string[],
  member_ids: [] as string[],
};

export default function AdminNewsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [trips, setTrips] = useState<Array<{ id: string; name: string; slug: string; status: string }>>([]);
  const [members, setMembers] = useState<
    Array<{ id: string; full_name: string | null; nickname: string | null; avatar_url: string | null; status: string }>
  >([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

      const [newsResponse, optionsResponse] = await Promise.all([
        fetch('/api/news?includeUnpublished=true&limit=200', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('/api/news/options', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const newsPayload = (await newsResponse.json().catch(() => ({}))) as NewsListPayload;
      const optionsPayload = (await optionsResponse.json().catch(() => ({}))) as NewsOptionsPayload;

      if (!newsResponse.ok || !newsPayload.success) {
        throw new Error(newsPayload.error || 'Failed to load news');
      }

      if (!optionsResponse.ok || !optionsPayload.success) {
        throw new Error(optionsPayload.error || 'Failed to load tag options');
      }

      setNews(newsPayload.data?.news || []);
      setTrips(optionsPayload.data?.trips || []);
      setMembers(optionsPayload.data?.members || []);
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

  const handleSave = async () => {
    const title = form.title.trim();
    const content = form.content.trim();

    if (!title || !content) {
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
          is_published: form.is_published,
          trip_ids: form.trip_ids,
          member_ids: form.member_ids,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to save news item');
      }

      setMessage({
        type: 'success',
        text: editingId ? 'News item updated.' : 'News item created.',
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
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      is_published: item.is_published,
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

  const filteredMembers = members.filter((member) => {
    if (!memberSearch.trim()) return true;
    const searchLower = memberSearch.toLowerCase();
    const name = getMemberDisplayName(member).toLowerCase();
    return name.includes(searchLower);
  });

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
        <p className="text-brand-cream/70">Create announcements and tag trips or riders.</p>
      </div>

      {message && (
        <Card className={message.type === 'error' ? 'border border-red-500/40' : 'border border-green-500/40'}>
          <CardContent className={`py-4 ${message.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
            {message.text}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
              <textarea
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Write the update for members..."
                className="w-full min-h-[140px] rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 px-4 py-3 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
              />
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) => setForm((prev) => ({ ...prev, is_published: event.target.checked }))}
                className="h-4 w-4 rounded border-brand-brown/40 bg-brand-dark-grey"
              />
              <span className="text-sm text-brand-cream/80">Publish now</span>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-brand-cream/90">Tag Trips</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-2 space-y-2">
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
                  className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 py-2 pl-10 pr-4 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-brand-brown/20 bg-brand-dark-grey/30 p-2 space-y-2">
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
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSave} isLoading={saving}>
                {editingId ? 'Update News' : 'Create News'}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>
                  <X className="w-4 h-4" />
                  Cancel Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
    </div>
  );
}
