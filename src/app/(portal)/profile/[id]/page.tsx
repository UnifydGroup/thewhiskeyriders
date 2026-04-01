'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { Mail, Phone } from 'lucide-react';
import type { Profile } from '@/lib/types/database';
import TaggedPhotosSection from '@/components/photos/TaggedPhotosSection';

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

export default function MemberProfilePage() {
  const params = useParams();
  const supabase = createClient();
  const memberId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', memberId).single();
        if (data) setProfile(data);
      } catch (err) {
        console.error('Failed to load profile:', err);
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
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream">{displayName}</h1>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <Avatar src={profile.avatar_url} alt={displayName} size="xl" />
              <div className="flex-1">
                <div className="space-y-3">
                  {profile.nickname && (
                    <p className="text-sm text-brand-gold">&quot;{profile.nickname}&quot;</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-brand-cream/60 text-sm">User ID:</span>
                    <span className="text-brand-cream/70 text-sm">{profile.user_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-brand-cream/60" />
                    <span className="text-brand-cream/70">{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-brand-cream/60" />
                    <span className="text-brand-cream/70">{getPhone(profile)}</span>
                  </div>
                  <div>
                    <Badge variant="secondary">{profile.role}</Badge>
                  </div>
                  {profile.bio && <p className="text-brand-cream/80">{profile.bio}</p>}
                  <p className="text-xs text-brand-cream/60">
                    Joined {formatDate(profile.created_at, 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Profile Details</h2>
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
              <CardTitle className="text-lg">Date of Birth</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">
                {profile.date_of_birth ? formatDate(profile.date_of_birth, 'MMM d, yyyy') : 'Not provided'}
              </p>
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
    </div>
  );
}
