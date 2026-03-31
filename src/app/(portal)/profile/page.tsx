'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { Mail, Phone, AlertCircle } from 'lucide-react';
import type { Profile } from '@/lib/types/database';
export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
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
  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream">My Profile</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <Avatar
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                size="xl"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-brand-cream mb-2">
                  {profile.full_name || 'Rider'}
                </h2>
                <div className="space-y-2 text-sm text-brand-cream/70 mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="primary">{profile.role}</Badge>
                  <span className="text-xs text-brand-cream/60">
                    Joined {formatDate(profile.created_at, 'MMM d, yyyy')}
                  </span>
                </div>
                {profile.bio && (
                  <p className="text-brand-cream/80">{profile.bio}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Contact Info */}
      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">{profile.email}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Phone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-brand-cream/70">
                {profile.phone || 'Not provided'}
              </p>
            </CardContent>
          </Card>
          {profile.emergency_contact && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-brand-cream/70">{profile.emergency_contact}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Badges Section */}
      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Achievements</h2>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No badges yet</p>
            <p className="text-sm text-brand-cream/50">
              Complete trips and earn special badges!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
