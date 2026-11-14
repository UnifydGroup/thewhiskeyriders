import type { SupabaseClient } from '@supabase/supabase-js';
import type { BadgeType, Trip } from '@/lib/types/database';

export type MemberBadgeSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  badge_type: BadgeType;
  awarded_at: string | null;
  trip_name: string | null;
  trip_slug: string | null;
};

export type BadgeCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  badge_type: BadgeType;
};

type MemberBadgeRecord = {
  awarded_at: string | null;
  badges: BadgeCatalogItem | null;
  trips: Pick<Trip, 'id' | 'name' | 'slug'> | null;
};

/** Badges a member has been awarded, most recent first. */
export async function loadMemberBadges(
  supabase: SupabaseClient,
  profileId: string
): Promise<MemberBadgeSummary[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('awarded_at, badges!badge_id(id, name, description, icon, badge_type), trips!trip_id(id, name, slug)')
    .eq('user_id', profileId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as unknown as MemberBadgeRecord[])
    .filter((entry) => entry.badges)
    .map((entry) => ({
      ...(entry.badges as BadgeCatalogItem),
      awarded_at: entry.awarded_at,
      trip_name: entry.trips?.name ?? null,
      trip_slug: entry.trips?.slug ?? null,
    }))
    .sort((a, b) => {
      const aTime = a.awarded_at ? new Date(a.awarded_at).getTime() : 0;
      const bTime = b.awarded_at ? new Date(b.awarded_at).getTime() : 0;
      return bTime - aTime;
    });
}

/** Every badge that can be earned. Returns an empty list if the catalogue can't be read. */
export async function loadBadgeCatalog(supabase: SupabaseClient): Promise<BadgeCatalogItem[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('id, name, description, icon, badge_type')
    .order('name');

  if (error) {
    return [];
  }

  return (data || []) as BadgeCatalogItem[];
}

export type BadgeShelfItem = {
  key: string;
  name: string;
  description: string | null;
  icon: string;
  badge_type: BadgeType;
  earned: boolean;
  /** How many times this badge was awarded (e.g. Trip Captain on 3 trips) */
  count: number;
  latestTripName: string | null;
  latestAwardedAt: string | null;
};

/**
 * Badges are stored once per trip ("Trip Captain" for Vietnam 2011, Romania 2025, ...).
 * Group them by name so a shelf shows each badge once, with how often it was earned,
 * followed by the badges not earned yet.
 */
export function buildBadgeShelf(earned: MemberBadgeSummary[], catalog: BadgeCatalogItem[]) {
  const keyOf = (badge: { name: string; badge_type: string }) => `${badge.badge_type}:${badge.name.trim().toLowerCase()}`;
  const earnedByKey = new Map<string, BadgeShelfItem>();

  // `earned` is newest first, so the first award seen per badge is the latest.
  earned.forEach((badge) => {
    const key = keyOf(badge);
    const existing = earnedByKey.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    earnedByKey.set(key, {
      key,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      badge_type: badge.badge_type,
      earned: true,
      count: 1,
      latestTripName: badge.trip_name,
      latestAwardedAt: badge.awarded_at,
    });
  });

  const lockedByKey = new Map<string, BadgeShelfItem>();
  catalog.forEach((badge) => {
    const key = keyOf(badge);
    if (earnedByKey.has(key) || lockedByKey.has(key)) return;
    lockedByKey.set(key, {
      key,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      badge_type: badge.badge_type,
      earned: false,
      count: 0,
      latestTripName: null,
      latestAwardedAt: null,
    });
  });

  const items = [...earnedByKey.values(), ...lockedByKey.values()];
  return { items, earnedCount: earnedByKey.size, total: items.length };
}
