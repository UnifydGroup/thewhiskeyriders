'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackClientActivity } from '@/lib/activity/client';

const INTERACTION_DEBOUNCE_MS = 3500;
const MAX_LABEL_LENGTH = 120;

function normalizeEntityId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'interaction';
}

function getElementLabel(element: HTMLElement): string {
  const explicitLabel =
    element.getAttribute('data-activity-label') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title');

  if (explicitLabel) {
    return explicitLabel.slice(0, MAX_LABEL_LENGTH);
  }

  const text = element.textContent?.replace(/\s+/g, ' ').trim();
  if (text) {
    return text.slice(0, MAX_LABEL_LENGTH);
  }

  if (element instanceof HTMLAnchorElement && element.href) {
    return element.getAttribute('href') || element.href;
  }

  return element.tagName.toLowerCase();
}

export function AdminActivityTracker() {
  const pathname = usePathname();
  const lastEvents = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!pathname || !pathname.startsWith('/admin')) {
      return;
    }

    void trackClientActivity({
      action: 'view',
      entityType: 'admin_page',
      entityId: pathname,
      entityName: pathname,
      changes: {
        path: pathname,
      },
    });
  }, [pathname]);

  useEffect(() => {
    if (!pathname || !pathname.startsWith('/admin')) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const interactive = target.closest(
        'a, button, [role="button"], input[type="submit"], input[type="button"]'
      );
      if (!(interactive instanceof HTMLElement)) {
        return;
      }

      if (interactive.hasAttribute('data-no-activity')) {
        return;
      }

      const label = getElementLabel(interactive);
      const href =
        interactive instanceof HTMLAnchorElement ? (interactive.getAttribute('href') || null) : null;
      const dedupeKey = `${pathname}|${interactive.tagName}|${href || label}`;
      const now = Date.now();
      const lastAt = lastEvents.current.get(dedupeKey) || 0;

      if (now - lastAt < INTERACTION_DEBOUNCE_MS) {
        return;
      }

      lastEvents.current.set(dedupeKey, now);

      void trackClientActivity({
        action: 'interact',
        entityType: 'admin_interaction',
        entityId: href || normalizeEntityId(label),
        entityName: label,
        changes: {
          path: pathname,
          href,
          tag: interactive.tagName.toLowerCase(),
        },
      });
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, [pathname]);

  return null;
}
