'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ADVENTURE_SCORE_EXPLANATION, calculateAdventureScore } from '@/lib/adventure-score';
import type { BadgeType, Profile, TripRole, TripStatus } from '@/lib/types/database';
import { Compass, MapPin, Route, Search, Sparkles, Trophy, Users } from 'lucide-react';

type MemberProfile = Pick<
  Profile,
  'id' | 'full_name' | 'first_name' | 'middle_name' | 'surname' | 'nickname' | 'avatar_url' | 'bio' | 'role'
>;

type MemberTrip = {
  user_id: string;
  trip_role: TripRole;
  joined_at: string | null;
  trips: {
    id: string;
    name: string;
    destination: string;
    country: string;
    slug: string;
    status: TripStatus;
    start_date: string;
  } | null;
};

type MemberBadge = {
  user_id: string;
  awarded_at: string | null;
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string | null;
    badge_type: BadgeType;
  } | null;
  trips: {
    id: string;
    name: string;
  } | null;
};

type TripSummary = {
  id: string;
  name: string;
  destination: string;
  country: string;
  slug: string;
  status: TripStatus;
  start_date: string;
  trip_role: TripRole;
};

type BadgeSummary = {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  badge_type: BadgeType;
  trip_name: string | null;
  awarded_at: string | null;
};

type MemberSummary = {
  profile: MemberProfile;
  displayName: string;
  trips: TripSummary[];
  badges: BadgeSummary[];
  uniqueCountries: number;
  completedTrips: number;
  adventureScore: number;
};

const SORT_OPTIONS = [
  { value: 'adventure-score', label: 'Adventure score' },
  { value: 'name', label: 'Name' },
  { value: 'trip-count', label: 'Number of trips' },
] as const;

type MemberSort = (typeof SORT_OPTIONS)[number]['value'];
type SortDirection = 'asc' | 'desc';

function getDisplayName(profile: MemberProfile): string {
  const nickname = profile.nickname?.trim();
  if (nickname) {
    return nickname;
  }

  const assembled = [profile.first_name, profile.middle_name, profile.surname]
    .filter(Boolean)
    .join(' ')
    .trim();

  return assembled || profile.full_name || 'Rider';
}

function getTrailTitle(summary: MemberSummary): string {
  if (summary.badges.length >= 8) return 'Legend';
  if (summary.trips.length >= 5) return 'Road Veteran';
  if (summary.badges.length >= 4) return 'Badge Hunter';
  if (summary.trips.length >= 2) return 'Dust Chaser';
  return 'Fresh Rider';
}

function getBadgeVariant(type: BadgeType): 'primary' | 'secondary' | 'outline' {
  if (type === 'achievement') return 'primary';
  if (type === 'trip') return 'secondary';
  return 'outline';
}

export default function MembersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<MemberSort>('adventure-score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const [{ data: profilesData }, { data: tripsData }, { data: badgesData }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, first_name, middle_name, surname, nickname, avatar_url, bio, role')
            .eq('status', 'active')
            .order('nickname', { ascending: true }),
          supabase
            .from('trip_members')
            .select(
              'user_id, trip_role, joined_at, trips!trip_id(id, name, destination, country, slug, status, start_date)'
            ),
          supabase
            .from('user_badges')
            .select('user_id, awarded_at, badges!badge_id(id, name, icon, description, badge_type), trips!trip_id(id, name)'),
        ]);

        const profiles = (profilesData || []) as MemberProfile[];
        const memberTrips = (tripsData || []) as MemberTrip[];
        const memberBadges = (badgesData || []) as MemberBadge[];

        const tripsByUser = new Map<string, TripSummary[]>();
        const seenTripKeys = new Set<string>();

        for (const item of memberTrips) {
          if (!item.trips) continue;
          const key = `${item.user_id}:${item.trips.id}`;
          if (seenTripKeys.has(key)) continue;
          seenTripKeys.add(key);

          const existing = tripsByUser.get(item.user_id) || [];
          existing.push({
            ...item.trips,
            trip_role: item.trip_role,
          });
          tripsByUser.set(item.user_id, existing);
        }

        const badgesByUser = new Map<string, BadgeSummary[]>();
        const seenBadgeKeys = new Set<string>();

        for (const item of memberBadges) {
          if (!item.badges) continue;
          const tripName = item.trips?.name ?? null;
          const key = `${item.user_id}:${item.badges.id}:${tripName ?? 'global'}`;
          if (seenBadgeKeys.has(key)) continue;
          seenBadgeKeys.add(key);

          const existing = badgesByUser.get(item.user_id) || [];
          existing.push({
            ...item.badges,
            trip_name: tripName,
            awarded_at: item.awarded_at,
          });
          badgesByUser.set(item.user_id, existing);
        }

        const summaries = profiles.map((profile) => {
          const trips = (tripsByUser.get(profile.id) || []).sort((a, b) => {
            return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
          });
          const badges = badgesByUser.get(profile.id) || [];
          const uniqueCountries = new Set(trips.map((trip) => trip.country).filter(Boolean)).size;
          const completedTrips = trips.filter((trip) => trip.status === 'completed').length;
          const adventureScore = calculateAdventureScore({
            completedTrips,
            badgeCount: badges.length,
            uniqueCountries,
          });
          return {
            profile,
            displayName: getDisplayName(profile),
            trips,
            badges,
            uniqueCountries,
            completedTrips,
            adventureScore,
          };
        });

        setMembers(summaries);
      } catch (err) {
        console.error('Failed to load members directory:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [supabase]);

  const filteredMembers = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    const directionFactor = sortDirection === 'asc' ? 1 : -1;

    return members
      .filter((member) => {
        if (!searchText) return true;

        const searchable = [
          member.displayName,
          getDisplayName(member.profile),
          member.profile.full_name || '',
          member.profile.bio || '',
          ...member.trips.map((trip) => `${trip.name} ${trip.destination} ${trip.country}`),
          ...member.badges.map((badge) => badge.name),
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(searchText);
      })
      .sort((a, b) => {
        let primaryComparison = 0;

        if (sortBy === 'name') {
          primaryComparison = getDisplayName(a.profile).localeCompare(getDisplayName(b.profile)) * directionFactor;
        } else if (sortBy === 'trip-count') {
          primaryComparison = (a.trips.length - b.trips.length) * directionFactor;
        } else {
          primaryComparison = (a.adventureScore - b.adventureScore) * directionFactor;
        }

        if (primaryComparison !== 0) return primaryComparison;

        if (b.adventureScore !== a.adventureScore) return b.adventureScore - a.adventureScore;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [members, search, sortBy, sortDirection]);

  const stats = useMemo(() => {
    const memberCount = members.length;
    const totalBadges = members.reduce((sum, member) => sum + member.badges.length, 0);
    const totalTrips = members.reduce((sum, member) => sum + member.trips.length, 0);
    const uniqueCountries = new Set(
      members.flatMap((member) => member.trips.map((trip) => trip.country)).filter(Boolean)
    ).size;

    return { memberCount, totalBadges, totalTrips, uniqueCountries };
  }, [members]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-brand-brown/20 bg-gradient-to-br from-brand-black via-brand-dark-grey to-brand-brown/25 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-brand-brown/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-brand-tan/15 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-brown/40 bg-brand-brown/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-tan">
            <Sparkles className="h-4 w-4" />
            Riders Directory
          </div>
          <h1 className="mt-4 text-3xl font-bold text-brand-cream sm:text-4xl">Meet the Crew</h1>
          <p className="mt-3 max-w-2xl text-brand-cream/80">
            See who is riding with us, where they have already been, and what they have earned along the way.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="border-brand-brown/25 bg-brand-black/40 p-4">
              <CardContent className="p-0">
                <p className="text-xs uppercase tracking-wide text-brand-cream/60">Members</p>
                <p className="mt-1 text-2xl font-bold text-brand-cream">{stats.memberCount}</p>
              </CardContent>
            </Card>
            <Card className="border-brand-brown/25 bg-brand-black/40 p-4">
              <CardContent className="p-0">
                <p className="text-xs uppercase tracking-wide text-brand-cream/60">Trips Logged</p>
                <p className="mt-1 text-2xl font-bold text-brand-cream">{stats.totalTrips}</p>
              </CardContent>
            </Card>
            <Card className="border-brand-brown/25 bg-brand-black/40 p-4">
              <CardContent className="p-0">
                <p className="text-xs uppercase tracking-wide text-brand-cream/60">Countries</p>
                <p className="mt-1 text-2xl font-bold text-brand-cream">{stats.uniqueCountries}</p>
              </CardContent>
            </Card>
            <Card className="border-brand-brown/25 bg-brand-black/40 p-4">
              <CardContent className="p-0">
                <p className="text-xs uppercase tracking-wide text-brand-cream/60">Badges Awarded</p>
                <p className="mt-1 text-2xl font-bold text-brand-cream">{stats.totalBadges}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cream/50" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search riders, trips, countries, badges..."
              className="w-full rounded-lg border border-brand-brown/25 bg-brand-black/45 py-2.5 pl-10 pr-4 text-sm text-brand-cream placeholder:text-brand-cream/45 focus:border-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-brown/20"
            />
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto">
            <div>
              <label htmlFor="members-sort" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-cream/60">
                Sort by
              </label>
              <select
                id="members-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as MemberSort)}
                className="w-full rounded-lg border border-brand-brown/25 bg-brand-black/45 px-3 py-2.5 text-sm text-brand-cream focus:border-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-brown/20"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-brand-dark-grey text-brand-cream">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="members-sort-direction" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-cream/60">
                Order
              </label>
              <select
                id="members-sort-direction"
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as SortDirection)}
                className="w-full rounded-lg border border-brand-brown/25 bg-brand-black/45 px-3 py-2.5 text-sm text-brand-cream focus:border-brand-brown focus:outline-none focus:ring-2 focus:ring-brand-brown/20"
              >
                <option value="asc" className="bg-brand-dark-grey text-brand-cream">Ascending</option>
                <option value="desc" className="bg-brand-dark-grey text-brand-cream">Descending</option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-sm text-brand-cream/60">
          Showing {filteredMembers.length} of {members.length} members
        </p>
        <p className="text-xs text-brand-cream/45">{ADVENTURE_SCORE_EXPLANATION}</p>
      </section>

      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-brand-brown/70" />
            <p className="text-brand-cream/80">No members matched this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((member) => (
            <Link key={member.profile.id} href={`/profile/${member.profile.id}`} className="group block h-full">
              <Card hoverable className="h-full border-brand-brown/25 bg-gradient-to-b from-brand-dark-grey to-brand-black/70">
                <CardContent className="p-0">
                  <div className="flex items-start gap-4 p-6 pb-4">
                    <Avatar src={member.profile.avatar_url} alt={member.displayName} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-brand-cream">{member.displayName}</p>
                      <p className="mt-1 inline-flex rounded-full bg-brand-brown/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-tan">
                        {getTrailTitle(member)}
                      </p>
                      {member.profile.bio && (
                        <p className="mt-2 text-sm text-brand-cream/70">
                          {member.profile.bio.length > 115
                            ? `${member.profile.bio.slice(0, 115).trim()}...`
                            : member.profile.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-brand-brown/15 p-6 pt-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="border-brand-brown/50 text-brand-tan">
                        <Users className="mr-1 inline h-3 w-3" />
                        {member.trips.length} trips
                      </Badge>
                      <Badge variant="outline" className="border-brand-brown/50 text-brand-tan">
                        <Trophy className="mr-1 inline h-3 w-3" />
                        {member.badges.length} badges
                      </Badge>
                      <Badge variant="outline" className="border-brand-brown/50 text-brand-tan">
                        <Compass className="mr-1 inline h-3 w-3" />
                        {member.uniqueCountries} countries
                      </Badge>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-cream/60">
                        Where they&apos;ve been
                      </p>
                      {member.trips.length === 0 ? (
                        <p className="text-sm text-brand-cream/55">No trips logged yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {member.trips.map((trip) => (
                            <Badge key={trip.id} variant="secondary" className="max-w-full truncate bg-brand-tan/90">
                              <MapPin className="mr-1 inline h-3 w-3" />
                              {trip.destination}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-cream/60">
                        Badge shelf
                      </p>
                      {member.badges.length === 0 ? (
                        <p className="text-sm text-brand-cream/55">No badges yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {member.badges.slice(0, 4).map((badge) => (
                            <Badge key={`${badge.id}:${badge.trip_name || 'global'}`} variant={getBadgeVariant(badge.badge_type)}>
                              <span className="mr-1">{badge.icon}</span>
                              {badge.name}
                            </Badge>
                          ))}
                          {member.badges.length > 4 && (
                            <Badge variant="outline" className="border-brand-brown/40 text-brand-cream/70">
                              +{member.badges.length - 4} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <div className="mb-1 flex items-center justify-between text-xs text-brand-cream/60">
                        <span className="inline-flex items-center gap-1">
                          <Route className="h-3.5 w-3.5" />
                          Adventure score
                        </span>
                        <span>{member.adventureScore}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-brand-black/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-brown via-brand-tan to-brand-brown transition-all duration-500"
                          style={{ width: `${Math.min(100, member.adventureScore)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
