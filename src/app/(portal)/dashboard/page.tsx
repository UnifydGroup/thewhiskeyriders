'use client';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { formatDate, formatDateShort } from '@/lib/utils';
import { Users, MapPin, Camera, Trophy } from 'lucide-react';
import PaymentProgressCard from '@/components/dashboard/PaymentProgressCard';
import { getMemberDisplayName } from '@/lib/member-display';
import type { Profile, Trip, TripMember } from '@/lib/types/database';

export default function DashboardPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
          // Show password change modal if password hasn't been changed yet
          if (!profileData.password_changed) {
            setShowPasswordModal(true);
          }
        }

        // Get trips user is part of
        const { data: membersData } = await supabase
          .from('trip_members')
          .select('*')
          .eq('user_id', user.id);

        if (membersData) {
          setTripMembers(membersData);
          // Get trip details
          const tripIds = membersData.map((m) => m.trip_id);
          if (tripIds.length > 0) {
            const { data: tripsData } = await supabase
              .from('trips')
              .select('*')
              .in('id', tripIds)
              .order('start_date', { ascending: false });
            if (tripsData) {
              setTrips(tripsData);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  const handlePasswordChange = async (password: string) => {
    setChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      // Update profile state to reflect password_changed flag
      if (profile) {
        setProfile({ ...profile, password_changed: true });
      }

      setShowPasswordModal(false);
    } catch (err) {
      throw err;
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const upcomingTrips = trips.filter((t) => t.status === 'upcoming').slice(0, 1);
  const completedTrips = trips.filter((t) => t.status === 'completed').length;
  const tripRoleById = new Map(tripMembers.map((member) => [member.trip_id, member.trip_role]));

  return (
    <div className="space-y-8">
      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handlePasswordChange}
        isLoading={changingPassword}
      />

      {/* Welcome */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">
          Welcome back, {getMemberDisplayName(profile) || 'Rider'}!
        </h1>
        <p className="text-brand-cream/70">
          {profile?.role === 'super_admin' || profile?.role === 'admin'
            ? 'You have admin privileges'
            : 'Your adventure dashboard'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-brand-cream/70 text-sm font-medium mb-1">Trips Attended</p>
                    <p className="text-3xl font-bold text-brand-cream">{completedTrips}</p>
                  </div>
                  <div className="p-3 bg-brand-brown/20 rounded-lg">
                    <MapPin className="w-6 h-6 text-brand-brown" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-brand-cream/70 text-sm font-medium mb-1">Upcoming Trips</p>
                    <p className="text-3xl font-bold text-brand-cream">{trips.filter((t) => t.status === 'upcoming').length}</p>
                  </div>
                  <div className="p-3 bg-brand-brown/20 rounded-lg">
                    <Users className="w-6 h-6 text-brand-brown" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-brand-cream/70 text-sm font-medium mb-1">Photos</p>
                    <p className="text-3xl font-bold text-brand-cream">0</p>
                  </div>
                  <div className="p-3 bg-brand-brown/20 rounded-lg">
                    <Camera className="w-6 h-6 text-brand-brown" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-brand-cream/70 text-sm font-medium mb-1">Badges</p>
                    <p className="text-3xl font-bold text-brand-cream">0</p>
                  </div>
                  <div className="p-3 bg-brand-brown/20 rounded-lg">
                    <Trophy className="w-6 h-6 text-brand-brown" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Progress for Upcoming Trip */}
          {upcomingTrips.length > 0 && profile && (
            <PaymentProgressCard
              tripId={upcomingTrips[0].id}
              memberId={profile.id}
              tripName={upcomingTrips[0].name}
            />
          )}
        </div>

        <div className="space-y-6">
          {/* Upcoming Trip */}
          {upcomingTrips.length > 0 && (
            <Link href={`/trips/${upcomingTrips[0].slug}`} className="block">
              <Card hoverable>
                <CardHeader>
                  <CardTitle>Next Adventure</CardTitle>
                  <CardDescription>Your upcoming trip</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-brand-cream mb-2">
                        {upcomingTrips[0].name}
                      </h3>
                      <p className="text-brand-cream/70 mb-3">{upcomingTrips[0].destination}, {upcomingTrips[0].country}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="primary">
                        {formatDateShort(upcomingTrips[0].start_date)} - {formatDateShort(upcomingTrips[0].end_date)}
                      </Badge>
                      {upcomingTrips[0].status && (
                        <Badge variant="secondary">
                          {upcomingTrips[0].status}
                        </Badge>
                      )}
                      {tripRoleById.get(upcomingTrips[0].id) && (
                        <Badge variant="outline">
                          {tripRoleById.get(upcomingTrips[0].id)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Your Trips */}
          {trips.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Your Trips</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trips.map((trip) => (
                  <Link key={trip.id} href={`/trips/${trip.slug}`} className="block h-full">
                    <Card hoverable className="h-full flex flex-col">
                      <CardHeader>
                        <CardTitle className="line-clamp-1">{trip.name}</CardTitle>
                        <CardDescription>{trip.destination}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="text-sm text-brand-cream/70 mb-4">
                          {formatDate(trip.start_date, 'MMM d')} - {formatDate(trip.end_date, 'MMM d, yyyy')}
                        </p>
                      </CardContent>
                      <div className="pt-4 border-t border-brand-brown/10 flex flex-wrap gap-2">
                        <Badge variant={trip.status === 'upcoming' ? 'primary' : 'secondary'}>
                          {trip.status}
                        </Badge>
                        {tripRoleById.get(trip.id) && (
                          <Badge variant="outline">{tripRoleById.get(trip.id)}</Badge>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {trips.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-brand-cream/70 mb-4">You haven&apos;t joined any trips yet.</p>
                <p className="text-sm text-brand-cream/50">
                  Check back soon or contact an admin to join a trip.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
