'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MemberNotification } from '@/lib/notifications/types';

const POLL_MS = 60_000;

interface Options {
  limit?: number;
  types?: readonly string[] | null;
  unreadOnly?: boolean;
  /** Poll for new notifications while the tab is visible. */
  poll?: boolean;
}

export function useNotifications({ limit = 20, types = null, unreadOnly = false, poll = true }: Options = {}) {
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const typeKey = types?.join(',') ?? '';

  const buildUrl = useCallback(
    (before?: string) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (unreadOnly) params.set('unread', 'true');
      if (typeKey) params.set('types', typeKey);
      if (before) params.set('before', before);
      return `/api/notifications?${params.toString()}`;
    },
    [limit, typeKey, unreadOnly]
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(buildUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load notifications.');
      const payload = await response.json();
      setNotifications(payload.data?.notifications ?? []);
      setUnreadCount(payload.data?.unread_count ?? 0);
      setHasMore(Boolean(payload.data?.has_more));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const loadMore = useCallback(async () => {
    const last = notifications[notifications.length - 1];
    if (!last) return;
    const response = await fetch(buildUrl(last.created_at), { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    setNotifications((previous) => [...previous, ...(payload.data?.notifications ?? [])]);
    setHasMore(Boolean(payload.data?.has_more));
  }, [buildUrl, notifications]);

  useEffect(() => {
    void refresh();
    if (!poll) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [poll, refresh]);

  const markRead = useCallback(async (notification: MemberNotification) => {
    if (notification.is_read) return;
    setNotifications((previous) => previous.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    await fetch(`/api/notifications/${notification.id}`, { method: 'PATCH' }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((previous) => previous.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => undefined);
  }, []);

  const dismiss = useCallback(async (notification: MemberNotification) => {
    setNotifications((previous) => previous.filter((n) => n.id !== notification.id));
    if (!notification.is_read) setUnreadCount((count) => Math.max(0, count - 1));
    await fetch(`/api/notifications/${notification.id}`, { method: 'DELETE' }).catch(() => undefined);
  }, []);

  return { notifications, unreadCount, hasMore, loading, error, refresh, loadMore, markRead, markAllRead, dismiss };
}
