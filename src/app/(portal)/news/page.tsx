'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NewsCard } from '@/components/news/NewsCard';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Newspaper, Search } from 'lucide-react';
import type { NewsItem } from '@/lib/news/types';
import { toSearchableNewsText } from '@/lib/news/content';

type NewsApiResponse = {
  success?: boolean;
  data?: {
    news?: NewsItem[];
  };
  error?: string;
};

export default function NewsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNews = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        const response = await fetch('/api/news?placement=global&limit=200', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const payload = (await response.json().catch(() => ({}))) as NewsApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load news');
        }

        setNews(payload.data?.news || []);
      } catch (err: unknown) {
        console.error('Failed to load news:', err);
        setError(err instanceof Error ? err.message : 'Failed to load news');
      } finally {
        setLoading(false);
      }
    };

    void loadNews();
  }, [supabase]);

  const filteredNews = news.filter((item) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    const tagsText = [
      ...item.trip_tags.map((trip) => trip.name),
      ...item.member_tags.map((member) => member.nickname || member.full_name || ''),
    ]
      .join(' ')
      .toLowerCase();

    return (
      item.title.toLowerCase().includes(searchLower) ||
      toSearchableNewsText(item.content).toLowerCase().includes(searchLower) ||
      tagsText.includes(searchLower)
    );
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
      <section className="relative overflow-hidden rounded-2xl border border-brand-brown/20 bg-gradient-to-br from-brand-black via-brand-dark-grey to-brand-brown/20 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-12 h-52 w-52 rounded-full bg-brand-brown/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-brand-tan/15 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-brown/40 bg-brand-brown/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-tan">
            <Newspaper className="h-4 w-4" />
            Member News
          </div>
          <h1 className="mt-4 text-3xl font-bold text-brand-cream sm:text-4xl">Latest Updates</h1>
          <p className="mt-3 max-w-2xl text-brand-cream/80">
            Announcements from the crew, tagged to trips and riders so you can jump straight to what matters.
          </p>
        </div>
      </section>

      <section>
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-brand-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, content, trip or rider..."
            className="w-full rounded-lg border border-brand-brown/20 bg-brand-dark-grey/50 py-2 pl-10 pr-4 text-brand-cream placeholder:text-brand-cream/40 focus:border-brand-brown focus:outline-none"
          />
        </div>
      </section>

      {error && (
        <Card className="border border-red-500/40">
          <CardContent className="py-6 text-red-300">{error}</CardContent>
        </Card>
      )}

      {!error && filteredNews.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-2">
              {news.length === 0 ? 'No news has been published yet.' : 'No news matches your search.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {filteredNews.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
