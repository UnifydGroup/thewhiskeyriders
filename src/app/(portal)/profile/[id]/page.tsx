'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { Mail, MapPin, Phone, Route, Trophy, Users } from 'lucide-react';
import type { BadgeType, Profile, Trip, TripRole } from '@/lib/types/database';
import TaggedPhotosSection from '@/components/photos/TaggedPhotosSection';
import { ADVENTURE_SCORE_EXPLANATION, calculateAdventureScore } from '@/lib/adventure-score';
import { WorldMap } from '@/components/map/WorldMap';
import { NewsCard } from '@/components/news/NewsCard';
import type { NewsItem } from '@/lib/news/types';

type MemberTripRecord = {
  trip_role: TripRole;
  joined_at: string | null;
  trips: Pick<Trip, 'id' | 'name' | 'destination' | 'country' | 'country_code' | 'slug' | 'status' | 'start_date' | 'end_date' | 'latitude' | 'longitude' | 'max_members' | 'cover_image_url' | 'description' | 'itinerary' | 'created_by' | 'created_at' | 'updated_at'> | null;
};

type MemberBadgeRecord = {
  awarded_at: string | null;
  badges: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    badge_type: BadgeType;
  } | null;
  trips: Pick<Trip, 'id' | 'name' | 'slug'> | null;
};

type MemberTripSummary = Trip & {
  trip_role: TripRole;
};

type MemberBadgeSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  badge_type: BadgeType;
  awarded_at: string | null;
  trip_name: string | null;
  trip_slug: string | null;
};

function getDisplayName(profile: Profile) {
  const fullName = [profile.first_name, profile.middle_name, profile.surname]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || profile.full_name || 'Rider';
}

function getPhone(profile: Profile) {
  return [profile.phone_country_code, profile.phone].filter(Boolean).join(' ') || 'Not provided';
}

function getBadgeVariant(type: BadgeType): 'primary' | 'secondary' | 'outline' {
  if (type === 'achievement') return 'primary';
  if (type === 'trip') return 'secondary';
  return 'outline';
}

export default function MemberProfilePage() {
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);
  const memberId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberTrips, setMemberTrips] = useState<MemberTripSummary[]>([]);
  const [memberBadges, setMemberBadges] = useState<MemberBadgeSummary[]>([]);
  const [taggedNews, setTaggedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const [{ data: profileData }, { data: tripsData }, { data: badgesData }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', memberId).single(),
          supabase
            .from('trip_members')
            .select('trip_role, joined_at, trips!trip_id(*)')
            .eq('user_id', memberId),
          supabase
            .from('user_badges')
            .select('awarded_at, badges!badge_id(id, name, description, icon, badge_type), trips!trip_id(id, name, slug)')
            .eq('user_id', memberId),
        ]);

        if (profileData) {
          setProfile(profileData as Profile);
        }

        const tripRecords = ((tripsData || []) as MemberTripRecord[])
          .filter((entry) => entry.trips)
          .map((entry) => ({
            ...(entry.trips as Trip),
            trip_role: entry.trip_role,
          }))
          .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        setMemberTrips(tripRecords);

        const badgeRecords = ((badgesData || []) as MemberBadgeRecord[])
          .filter((entry) => entry.badges)
          .map((entry) => ({
            ...(entry.badges as Omit<MemberBadgeSummary, 'awarded_at' | 'trip_name' | 'trip_slug'>),
            awarded_at: entry.awarded_at,
            trip_name: entry.trips?.name ?? null,
            trip_slug: entry.trips?.slug ?? null,
          }))
          .sort((a, b) => {
            const aTime = a.awarded_at ? new Date(a.awarded_at).getTime() : 0;
            const bTime = b.awarded_at ? new Date(b.awarded_at).getTime() : 0;
            return bTime - aTime;
          });
        setMemberBadges(badgeRecords);

        if (session?.access_token) {
          const response = await fetch(`/api/news?placement=rider&memberId=${memberId}&limit=20`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          const payload = await response.json().catch(() => ({}));
          if (response.ok && payload?.success) {
            setTaggedNews(payload?.data?.news || []);
          }
        }
      } catch (err) {
        console.error('Failed to load member profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [memberId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-brand-cream">Member</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70">Member not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = getDisplayName(profile);
  const nickname = profile.nickname?.trim() || 'No nickname';
  const uniqueCountries = new Set(memberTrips.map((trip) => trip.country)).size;
  const completedTrips = memberTrips.filter((trip) => trip.status === 'completed').length;
  const adventureScore = calculateAdventureScore({
    completedTrips,
    badgeCount: memberBadges.length,
    uniqueCountries,
  });

  const formattedAddress = [
    profile.address_line1,
    profile.address_line2,
    [profile.address_city, profile.address_state].filter(Boolean).join(', '),
    [profile.address_postcode, profile.address_country].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-brand-brown/20 bg-gradient-to-br from-brand-black via-brand-dark-grey to-brand-brown/20 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-12 h-52 w-52 rounded-full bg-brand-brown/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-brand-tan/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar src={profile.avatar_url} alt={displayName} size="xl" />
            <div>
              <h1 className="text-3xl font-bold text-brand-cream sm:text-4xl">{displayName}</h1>
              <p className="mt-1 text-brand-tan">&quot;{nickname}&quot;</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-brand-cream/75">
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {getPhone(profile)}
                </span>
              </div>
              <div className="mt-3">
                <Badge variant="secondary">{profile.role}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:min-w-64">
            <Card className="border-brand-brown/25 bg-brand-black/40 p-3">
              <CardContent className="p-0">
                <p className="text-[11px] uppercase tracking-wider text-brand-cream/60">Trips</p>
                <p className="text-xl font-bold text-brand-cream">{memberTrips.length}</p>
              </CardContent>
            </Card>
            <Card className="border-brand-brown/25 bg-brand-black/40 p-3">
              <CardContent className="p-0">
                <p className="text-[11px] uppercase tracking-wider text-brand-cream/60">Countries</p>
                <p className="text-xl font-bold text-brand-cream">{uniqueCountries}</p>
              </CardContent>
            </Card>
            <Card className="border-brand-brown/25 bg-brand-black/40 p-3">
              <CardContent className="p-0">
                <p className="text-[11px] uppercase tracking-wider text-brand-cream/60">Badges</p>
                <p className="text-xl font-bold text-brand-cream">{memberBadges.length}</p>
              </CardContent>
            </Card>
            <Card className="border-brand-brown/25 bg-brand-black/40 p-3">
              <CardContent className="p-0">
                <p className="text-[11px] uppercase tracking-wider text-brand-cream/60">Adventure</p>
                <p className="text-xl font-bold text-brand-cream">{adventureScore}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-brown" />
              Rider Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorldMap
              trips={memberTrips}
              compact
              showStats
              memberMode
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-brand-brown" />
              Adventure Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-bold text-brand-cream">{adventureScore}</p>
            <p className="text-sm text-brand-cream/70">{ADVENTURE_SCORE_EXPLANATION}</p>
            <div className="space-y-2 text-sm text-brand-cream/80">
              <p>Completed Trips: {completedTrips}</p>
              <p>Badges: {memberBadges.length}</p>
              <p>Countries Visited: {uniqueCountries}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-brand-cream">Badges</h2>
        {memberBadges.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="mx-auto mb-2 h-6 w-6 text-brand-brown/70" />
              <p className="text-brand-cream/70">No badges earned yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {memberBadges.map((badge) => (
              <Card key={`${badge.id}-${badge.trip_name || 'global'}`} className="border-brand-brown/25">
                <CardContent className="space-y-2 pt-6">
                  <div className="flex items-center gap-2">
                    <Badge variant={getBadgeVariant(badge.badge_type)}>
                      <span className="mr-1">{badge.icon}</span>
                      {badge.name}
                    </Badge>
                    {badge.trip_name && (
                      <span className="text-xs text-brand-cream/60">{badge.trip_name}</span>
                    )}
                  </div>
                  {badge.description && <p className="text-sm text-brand-cream/70">{badge.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-brand-cream/55">
                    {badge.awarded_at && <span>Awarded {formatDate(badge.awarded_at, 'MMM d, yyyy')}</span>}
                    {badge.trip_slug && (
                      <Link href={`/trips/${badge.trip_slug}`} className="text-brand-brown hover:text-brand-tan">
                        View trip
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-brand-cream">Profile Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-lg">First Name</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{profile.first_name || 'Not provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Middle Name</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{profile.middle_name || 'Not provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Surname</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{profile.surname || 'Not provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Date of Birth</CardTitle></CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">
                {profile.date_of_birth ? formatDate(profile.date_of_birth, 'MMM d, yyyy') : 'Not provided'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Email</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{profile.email || 'Not provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Phone Number</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{getPhone(profile)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Emergency Contact</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{profile.emergency_contact || 'Not provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Emergency Contact Number</CardTitle></CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.emergency_contact_number || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Address</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-brand-cream/70">{formattedAddress || profile.address || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Shirt Size</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{profile.shirt_size || 'Not provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Shorts Size</CardTitle></CardHeader>
            <CardContent><p className="text-brand-cream/70">{profile.shorts_size || 'Not provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Member Since</CardTitle></CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">
                {profile.created_at ? formatDate(profile.created_at, 'MMM d, yyyy') : 'Not provided'}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-brand-cream">Trip History</h2>
        {memberTrips.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-brand-brown/70" />
              <p className="text-brand-cream/70">No trips found for this rider yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {memberTrips.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.slug}`}>
                <Card hoverable className="h-full">
                  <CardContent className="space-y-2 pt-6">
                    <p className="text-lg font-semibold text-brand-cream">{trip.name}</p>
                    <p className="text-sm text-brand-cream/70">{trip.destination}, {trip.country}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{trip.trip_role}</Badge>
                      <Badge variant={trip.status === 'completed' ? 'secondary' : 'primary'}>{trip.status}</Badge>
                    </div>
                    <p className="text-xs text-brand-cream/55">Started {formatDate(trip.start_date, 'MMM d, yyyy')}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {taggedNews.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold text-brand-cream">News Tagged To This Rider</h2>
          <div className="space-y-4">
            {taggedNews.map((item) => (
              <NewsCard key={item.id} item={item} compact />
            ))}
          </div>
        </section>
      )}

      <TaggedPhotosSection profile={profile} />
    </div>
  );
}
