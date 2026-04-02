'use client';

import Link from 'next/link';
import { CalendarDays, Newspaper, Tag, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { getMemberDisplayName } from '@/lib/member-display';
import type { NewsItem } from '@/lib/news/types';

interface NewsCardProps {
  item: NewsItem;
  compact?: boolean;
}

function getPreviewText(content: string, compact: boolean): string {
  if (!compact) return content;
  const trimmed = content.trim();
  if (trimmed.length <= 220) return trimmed;
  return `${trimmed.slice(0, 220)}...`;
}

export function NewsCard({ item, compact = false }: NewsCardProps) {
  const publishedAt = item.published_at || item.created_at;
  const previewText = getPreviewText(item.content, compact);

  return (
    <Card className="border-brand-brown/20">
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <CardTitle className="text-xl flex items-start gap-2">
          <Newspaper className="w-5 h-5 text-brand-brown mt-0.5" />
          <span>{item.title}</span>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-3">
          {publishedAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-4 h-4" />
              {formatDate(publishedAt, 'MMM d, yyyy h:mm a')}
            </span>
          )}
          {!item.is_published && (
            <Badge variant="outline">Draft</Badge>
          )}
          {item.author && (
            <span className="inline-flex items-center gap-2">
              <Avatar
                src={item.author.avatar_url}
                alt={getMemberDisplayName(item.author) || 'Author'}
                size="sm"
              />
              <span>{getMemberDisplayName(item.author)}</span>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={compact ? 'text-brand-cream/80' : 'text-brand-cream/80 whitespace-pre-wrap'}>
          {previewText}
        </p>

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
