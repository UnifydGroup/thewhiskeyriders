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
import { Mail } from 'lucide-react';
import type { Profile } from '@/lib/types/database';

export default function MemberProfilePage() {
  const params = useParams();
  const supabase = createClient();
  const memberId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', memberId)
          .single();

        if (data) {
          setProfile(data);
        }
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

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream">
          {profile.full_name || 'Rider'}
        </h1>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <Avatar
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                size="xl"
              />
              <div className="flex-1">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-brand-cream/60" />
                    <span className="text-brand-cream/70">{profile.email}</span>
                  </div>
                  <div>
                    <Badge variant="secondary">{profile.role}</Badge>
                  </div>
                  {profile.bio && (
                    <p className="text-brand-cream/80">{profile.bio}</p>
                  )}
                  <p className="text-xs text-brand-cream/60">
                    Joined {formatDate(profile.created_at, 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trip History */}
      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Trip History</h2>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No trips shared yet</p>
            <p className="text-sm text-brand-cream/50">
              This rider's trip history will appear here
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Achievements</h2>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No badges yet</p>
            <p className="text-sm text-brand-cream/50">
              Badges earned from trip participation will show here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
