'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { isThisWeek, isToday, isYesterday } from 'date-fns';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useNotifications } from '@/components/notifications/useNotifications';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_FILTERS,
  type MemberNotification,
  type NotificationCategory,
  type NotificationFilterKey,
} from '@/lib/notifications/types';
import { cn } from '@/lib/utils';

function groupLabel(createdAt: string) {
  const date = new Date(createdAt);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'This week';
  return 'Earlier';
}

function groupNotifications(items: MemberNotification[]) {
  const groups: Array<{ label: string; items: MemberNotification[] }> = [];
  items.forEach((item) => {
    const label = groupLabel(item.created_at);
    const group = groups[groups.length - 1];
    if (group?.label === label) group.items.push(item);
    else groups.push({ label, items: [item] });
  });
  return groups;
}

function PreferencesPanel() {
  const [preferences, setPreferences] = useState<Record<NotificationCategory, boolean> | null>(null);
  const [saving, setSaving] = useState<NotificationCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications/preferences', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('load failed'))))
      .then((payload) => {
        if (!cancelled) setPreferences(payload.data?.preferences ?? null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your notification settings.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (key: NotificationCategory) => {
    if (!preferences) return;
    const nextValue = !preferences[key];
    setPreferences({ ...preferences, [key]: nextValue });
    setSaving(key);
    setError(null);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextValue }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setPreferences((current) => (current ? { ...current, [key]: !nextValue } : current));
      setError('Could not save that change. Try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="h-fit">
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-cream">What to notify me about</h2>
          <p className="text-sm text-brand-cream/60">Turned-off categories stop new notifications. Existing ones stay.</p>
        </div>
        {!preferences ? (
          error ? <p className="text-sm text-red-300">{error}</p> : <Spinner size="sm" />
        ) : (
          <ul className="space-y-1">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const id = `notify-${category.key}`;
              const enabled = preferences[category.key];
              return (
                <li key={category.key} className="flex items-center justify-between gap-4 rounded-lg px-1 py-2">
                  <label htmlFor={id} className="min-w-0 cursor-pointer">
                    <span className="block text-sm font-medium text-brand-cream">{category.label}</span>
                    <span className="block text-xs text-brand-cream/55">{category.description}</span>
                  </label>
                  <button
                    id={id}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => void toggle(category.key)}
                    disabled={saving === category.key}
                    className={cn(
                      'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-60',
                      enabled ? 'bg-brand-brown' : 'bg-brand-black border border-brand-brown/30'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-brand-cream shadow transition-transform',
                        enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {preferences && error && <p className="text-sm text-red-300">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilterKey>('all');
  const activeFilter = NOTIFICATION_FILTERS.find((item) => item.key === filter) ?? NOTIFICATION_FILTERS[0];
  const { notifications, unreadCount, hasMore, loading, error, loadMore, markRead, markAllRead, dismiss } = useNotifications({
    limit: 30,
    types: activeFilter.types,
    unreadOnly: filter === 'unread',
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadMore();
    setLoadingMore(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-cream sm:text-4xl">Notifications</h1>
          <p className="text-brand-cream/70">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button type="button" variant="outline" onClick={() => void markAllRead()} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div role="tablist" aria-label="Filter notifications" className="flex gap-2 overflow-x-auto pb-1">
            {NOTIFICATION_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  filter === item.key
                    ? 'border-brand-brown bg-brand-brown text-brand-cream'
                    : 'border-brand-brown/30 text-brand-cream/75 hover:border-brand-brown/60'
                )}
              >
                {item.label}
                {item.key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          <Card className="p-2 sm:p-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : error ? (
              <p className="py-12 text-center text-sm text-red-300">{error}</p>
            ) : notifications.length === 0 ? (
              <div className="py-14 text-center">
                <Bell className="mx-auto mb-3 h-8 w-8 text-brand-cream/30" />
                <p className="text-brand-cream/75">Nothing here yet.</p>
                <p className="mt-1 text-sm text-brand-cream/50">
                  Badges, photo tags, comments, trips and news will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupNotifications(notifications).map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h2 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-cream/50">
                      {group.label}
                    </h2>
                    {group.items.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onOpen={markRead}
                        onDismiss={dismiss}
                      />
                    ))}
                  </section>
                ))}
                {hasMore && (
                  <div className="flex justify-center pb-2">
                    <Button type="button" variant="outline" onClick={() => void handleLoadMore()} disabled={loadingMore}>
                      {loadingMore ? 'Loading…' : 'Show older'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <PreferencesPanel />
      </div>
    </div>
  );
}
