'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useNotifications } from '@/components/notifications/useNotifications';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { notifications, unreadCount, loading, error, markRead, markAllRead, refresh } = useNotifications({ limit: 8 });

  // Close when navigating, clicking outside or pressing Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    setOpen((value) => !value);
    if (!open) void refresh();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-brand-cream transition-colors hover:bg-brand-brown/20"
      >
        <Bell className={cn('h-5 w-5', unreadCount > 0 && 'animate-[wiggle_1s_ease-in-out_1]')} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-brand-black bg-brand-brown px-1 text-[10px] font-extrabold text-brand-cream tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-[4.5rem] z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-xl border border-brand-brown/30 bg-brand-dark-grey shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between border-b border-brand-brown/20 px-4 py-3">
            <p className="font-semibold text-brand-cream">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-brown hover:text-brand-tan"
              >
                <CheckCheck className="h-4 w-4" /> Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-brand-cream/60">Loading…</p>
            ) : error ? (
              <p className="px-3 py-8 text-center text-sm text-red-300">{error}</p>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-brand-cream/30" />
                <p className="text-sm text-brand-cream/70">You&apos;re all caught up.</p>
                <p className="mt-1 text-xs text-brand-cream/50">Badges, tags, comments, trips and news will show up here.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onOpen={markRead} compact />
              ))
            )}
          </div>

          <Link
            href="/notifications"
            className="border-t border-brand-brown/20 px-4 py-3 text-center text-sm font-semibold text-brand-brown hover:bg-brand-black/40 hover:text-brand-tan"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
