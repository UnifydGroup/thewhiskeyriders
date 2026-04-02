'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Newspaper } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NewsCard } from '@/components/news/NewsCard';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import type { NewsItem } from '@/lib/news/types';

type NewsItemApiResponse = {
  success?: boolean;
  data?: NewsItem;
  error?: string;
};

export default function NewsArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArticle = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        const response = await fetch(`/api/news/${id}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const payload = (await response.json().catch(() => ({}))) as NewsItemApiResponse;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || 'Article not found');
        }

        setItem(payload.data);
      } catch (err: unknown) {
        console.error('Failed to load article:', err);
        setError(err instanceof Error ? err.message : 'Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    void loadArticle();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/news" className="inline-flex items-center gap-2 text-brand-brown hover:text-brand-tan transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to News
      </Link>

      {error && (
        <Card className="border border-red-500/40">
          <CardContent className="py-8 text-red-300">{error}</CardContent>
        </Card>
      )}

      {!error && !item && (
        <Card>
          <CardContent className="py-10 text-center text-brand-cream/70">
            <Newspaper className="w-6 h-6 mx-auto mb-2 text-brand-brown/70" />
            Article not found.
          </CardContent>
        </Card>
      )}

      {item && <NewsCard item={item} />}
    </div>
  );
}

