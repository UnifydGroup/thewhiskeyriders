'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  Bell,
  Bike,
  Camera,
  CreditCard,
  FileText,
  Heart,
  MessageCircle,
  Newspaper,
  Tag,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BadgePatch } from '@/components/badges/BadgePatch';
import type { MemberNotification } from '@/lib/notifications/types';
import { cn } from '@/lib/utils';

const TYPE_VISUALS: Record<string, { icon: LucideIcon; tint: string }> = {
  tag: { icon: Tag, tint: 'bg-sky-950 text-sky-200' },
  comment: { icon: MessageCircle, tint: 'bg-indigo-950 text-indigo-200' },
  like: { icon: Heart, tint: 'bg-rose-950 text-rose-200' },
  gallery: { icon: Camera, tint: 'bg-sky-950 text-sky-200' },
  trip_update: { icon: Bike, tint: 'bg-brand-brown/30 text-brand-tan' },
  payment: { icon: CreditCard, tint: 'bg-green-950 text-green-200' },
  news: { icon: Newspaper, tint: 'bg-amber-950 text-amber-200' },
  new_profile: { icon: UserPlus, tint: 'bg-brand-brown/30 text-brand-tan' },
  form_submission: { icon: FileText, tint: 'bg-brand-brown/30 text-brand-tan' },
};

function NotificationIcon({ notification }: { notification: MemberNotification }) {
  if (notification.type === 'award') {
    const badgeName = notification.title.replace(/^New badge:\s*/i, '');
    const badgeType = typeof notification.metadata?.badge_type === 'string' ? notification.metadata.badge_type : 'achievement';
    return <BadgePatch name={badgeName} badgeType={badgeType} size={40} />;
  }

  const visual = TYPE_VISUALS[notification.type] ?? { icon: Bell, tint: 'bg-brand-brown/30 text-brand-tan' };
  const Icon = visual.icon;
  return (
    <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', visual.tint)}>
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

interface NotificationItemProps {
  notification: MemberNotification;
  onOpen: (notification: MemberNotification) => void;
  onDismiss?: (notification: MemberNotification) => void;
  compact?: boolean;
}

export function NotificationItem({ notification, onOpen, onDismiss, compact = false }: NotificationItemProps) {
  const time = formatDistanceToNowStrict(new Date(notification.created_at), { addSuffix: true });
  const body = (
    <>
      <NotificationIcon notification={notification} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug', notification.is_read ? 'text-brand-cream/80' : 'font-semibold text-brand-cream')}>
          {notification.title}
        </span>
        <span className={cn('block text-sm text-brand-cream/60', compact && 'line-clamp-2')}>{notification.message}</span>
        <span className="mt-0.5 block text-xs text-brand-cream/45">{time}</span>
      </span>
      {!notification.is_read && <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-brand-brown" aria-label="Unread" />}
    </>
  );

  const rowClass = cn(
    'flex flex-1 items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-brand-black/50',
    !notification.is_read && 'bg-brand-brown/10'
  );

  return (
    <div className="group flex items-start gap-1">
      {notification.link ? (
        <Link href={notification.link} onClick={() => onOpen(notification)} className={rowClass}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={() => onOpen(notification)} className={rowClass}>
          {body}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(notification)}
          aria-label="Dismiss notification"
          className="mt-3 rounded-md p-1.5 text-brand-cream/40 opacity-100 transition-opacity hover:bg-brand-black/50 hover:text-brand-cream sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
