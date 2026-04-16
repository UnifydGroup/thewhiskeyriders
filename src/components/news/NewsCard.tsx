'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarDays, Newspaper, Tag, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { getMemberDisplayName } from '@/lib/member-display';
import type { NewsItem } from '@/lib/news/types';
import { getCompactPreview, sanitizeNewsHtml } from '@/lib/news/content';

interface NewsCardProps {
  item: NewsItem;
  compact?: boolean;
}

export function NewsCard({ item, compact = false }: NewsCardProps) {
  const publishedAt = item.published_at || item.created_at;
  const safeHtml = useMemo(() => sanitizeNewsHtml(item.content), [item.content]);
  const previewText = useMemo(() => getCompactPreview(item.content, 220), [item.content]);

  return (
    <Card className="border-brand-brown/20">
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <CardTitle className="text-xl flex items-start gap-2">
          <Newspaper className="w-5 h-5 text-brand-brown mt-0.5" />
          <span>{item.title}</span>
        </CardTitle>
        <div className="text-brand-cream/70 text-sm flex flex-wrap items-center gap-3">
          {publishedAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-4 h-4" />
              {formatDate(publishedAt, 'MMM d, yyyy h:mm a')}
            </span>
          )}
          {item.is_archived && (
            <Badge variant="outline">Archived</Badge>
          )}
          {!item.is_published && !item.is_archived && (
            <Badge variant="outline">Draft</Badge>
          )}
          {item.is_global && (
            <Badge variant="secondary">Global</Badge>
          )}
          {item.tag_all_members && (
            <Badge variant="secondary">All Users</Badge>
          )}
          {item.author && (
            <div className="inline-flex items-center gap-2">
              <Avatar
                src={item.author.avatar_url}
                alt={getMemberDisplayName(item.author) || 'Author'}
                size="sm"
              />
              <span>{getMemberDisplayName(item.author)}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {compact ? (
          <p className="text-brand-cream/80">{previewText}</p>
        ) : (
          <div
            className="text-brand-cream/80 space-y-3 [&_a]:text-brand-brown [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-brand-brown/60 [&_blockquote]:pl-3 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        )}

        {item.trip_tags.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-cream/50 mb-2 inline-flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Tagged Trips
            </p>
            <div className="flex flex-wrap gap-2">
              {item.trip_tags.map((trip) => (
                <Link key={trip.id} href={`/trips/${trip.slug}`}>
                  <Badge variant="outline" className="cursor-pointer hover:border-brand-brown/70">
                    {trip.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {item.member_tags.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-cream/50 mb-2 inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              Tagged Riders
            </p>
            <div className="flex flex-wrap gap-2">
              {item.member_tags.map((member) => (
                <Link key={member.id} href={`/profile/${member.id}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:opacity-90 inline-flex items-center gap-1">
                    <Avatar
                      src={member.avatar_url}
                      alt={getMemberDisplayName(member) || 'Member'}
                      size="sm"
                    />
                    {getMemberDisplayName(member)}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
