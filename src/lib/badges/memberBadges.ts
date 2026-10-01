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
