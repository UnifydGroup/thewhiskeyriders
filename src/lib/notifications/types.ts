/** Categories a member can switch on or off (profiles.notification_preferences). */
export const NOTIFICATION_CATEGORIES = [
  { key: 'badges', label: 'Badges', description: 'When you earn a new badge' },
  { key: 'tags', label: 'Photo tags', description: 'When someone tags you in a photo' },
  { key: 'comments', label: 'Comments', description: 'Comments on your photos or photos you’re in' },
  { key: 'likes', label: 'Likes', description: 'When someone likes a photo you uploaded' },
  { key: 'trips', label: 'Trips', description: 'Being added to a trip, and updates on your trips' },
  { key: 'news', label: 'News', description: 'New posts for everyone, your trips, or tagged to you' },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]['key'];

export type NotificationPreferences = Partial<Record<NotificationCategory, boolean>>;

export interface MemberNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Filter tabs on the notifications page, mapped to stored `type` values. */
export const NOTIFICATION_FILTERS = [
  { key: 'all', label: 'All', types: null },
  { key: 'unread', label: 'Unread', types: null },
  { key: 'badges', label: 'Badges', types: ['award'] },
  { key: 'photos', label: 'Photos', types: ['tag', 'comment', 'like', 'gallery'] },
  { key: 'trips', label: 'Trips', types: ['trip_update', 'payment'] },
  { key: 'news', label: 'News', types: ['news'] },
] as const;

export type NotificationFilterKey = (typeof NOTIFICATION_FILTERS)[number]['key'];

export function isCategoryEnabled(preferences: unknown, category: NotificationCategory): boolean {
  if (!preferences || typeof preferences !== 'object') return true;
  const value = (preferences as Record<string, unknown>)[category];
  return value !== false;
}

export function normalizePreferences(value: unknown): Record<NotificationCategory, boolean> {
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map(({ key }) => [key, isCategoryEnabled(value, key)])
  ) as Record<NotificationCategory, boolean>;
}
