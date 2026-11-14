'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { Mail, Phone, Edit, Trophy } from 'lucide-react';
import type { Profile } from '@/lib/types/database';
import TaggedPhotosSection from '@/components/photos/TaggedPhotosSection';
import { NewsCard } from '@/components/news/NewsCard';
import type { NewsItem } from '@/lib/news/types';
import { loadMemberBadges, type MemberBadgeSummary } from '@/lib/badges/memberBadges';
import { BadgePatch } from '@/components/badges/BadgePatch';
import { yearFromTripName } from '@/lib/badges/badgeArt';

function getDisplayName(profile: Profile) {
  const fullName = [profile.first_name, profile.middle_name, profile.surname]
    .filter(Boolean)
    .join(' ')
    .trim();
  return profile.nickname?.trim() || fullName || profile.full_name || 'Rider';
}

function getPhone(profile: Profile) {
  return [profile.phone_country_code, profile.phone].filter(Boolean).join(' ') || 'Not provided';
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taggedNews, setTaggedNews] = useState<NewsItem[]>([]);
  const [badges, setBadges] = useState<MemberBadgeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          setProfile(data);

          loadMemberBadges(supabase, data.id)
            .then(setBadges)
            .catch((badgeError) => console.error('Failed to load badges:', badgeError));

          if (session?.access_token) {
            const response = await fetch('/api/news?placement=rider&limit=20', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            const payload = await response.json().catch(() => ({}));
            if (response.ok && payload?.success) {
              setTaggedNews(payload?.data?.news || []);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [supabase]);

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
        <h1 className="text-3xl font-bold text-brand-cream">Profile</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70">Profile not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = getDisplayName(profile);
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream">My Profile</h1>
          <Button
            onClick={() => router.push('/profile/edit')}
            variant="primary"
            size="md"
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Profile
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <Avatar src={profile.avatar_url} framing={profile.avatar_framing} alt={displayName} size="xl" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-brand-cream mb-1">{displayName}</h2>
                {profile.nickname && (
                  <p className="text-sm text-brand-gold mb-3">
                    &quot;{profile.nickname}&quot;
                  </p>
                )}
                <div className="space-y-2 text-sm text-brand-cream/70 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-cream/60">User ID:</span>
                    <span>{profile.user_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{getPhone(profile)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="primary">{profile.role}</Badge>
                  <span className="text-xs text-brand-cream/60">
                    Joined {formatDate(profile.created_at, 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">First Name</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.first_name || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Middle Name</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.middle_name || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Surname</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.surname || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nickname</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.nickname || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Date of Birth</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">
                {profile.date_of_birth ? formatDate(profile.date_of_birth, 'MMM d, yyyy') : 'Not provided'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Phone Number</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{getPhone(profile)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.emergency_contact || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Emergency Contact Number</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">
                {profile.emergency_contact_number || 'Not provided'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.email}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Address</h2>
        <Card>
          <CardContent className="py-6">
            <p className="text-brand-cream/70 whitespace-pre-line">
              {formattedAddress || profile.address || 'Not provided'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Travel Documentation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Passport Number</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.passport_number || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Passport Expiry</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">
                {profile.passport_expiry ? formatDate(profile.passport_expiry, 'MMM d, yyyy') : 'Not provided'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Travel Gear</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shirt Size</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.shirt_size || 'Not provided'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shorts Size</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.shorts_size || 'Not provided'}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaggedPhotosSection profile={profile} />

      {taggedNews.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-brand-cream mb-4">News Tagged To You</h2>
          <div className="space-y-4">
            {taggedNews.map((item) => (
              <NewsCard key={item.id} item={item} compact />
            ))}
          </div>
        </div>
      )}

      <div id="badges" className="scroll-mt-24">
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Badges</h2>
        {badges.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="mx-auto mb-2 h-6 w-6 text-brand-brown/70" />
              <p className="text-brand-cream/70 mb-4">No badges yet</p>
              <p className="text-sm text-brand-cream/50">Complete trips and earn special badges!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {badges.map((badge) => (
              <Card key={`${badge.id}-${badge.trip_slug || 'global'}`} className="border-brand-brown/25">
                <CardContent className="flex items-center gap-4">
                  <BadgePatch
                    name={badge.name}
                    badgeType={badge.badge_type}
                    icon={badge.icon}
                    year={yearFromTripName(badge.trip_name)}
                    size={72}
                    className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-brand-cream">{badge.name}</p>
                    {badge.description && <p className="text-sm text-brand-cream/70">{badge.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-brand-cream/55">
                      {badge.awarded_at && <span>Awarded {formatDate(badge.awarded_at, 'MMM d, yyyy')}</span>}
                      {badge.trip_slug && (
                        <Link href={`/trips/${badge.trip_slug}`} className="text-brand-brown hover:text-brand-tan">
                          {badge.trip_name || 'View trip'}
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
