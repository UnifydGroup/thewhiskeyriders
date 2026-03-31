'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatDateShort } from '@/lib/utils';
import { Users, MapPin, Camera, Trophy } from 'lucide-react';
import type { Profile, Trip, TripMember } from '@/lib/types/database';
export default function DashboardPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
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
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }
  const upcomingTrips = trips.filter((t) => t.status === 'upcoming').slice(0, 1);
  const completedTrips = trips.filter((t) => t.status === 'completed').length;
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-cream mb-2">
          Welcome back, {profile?.full_name || 'Rider'}!
        </h1>
        <p className="text-brand-cream/70">
          {profile?.role === 'super_admin' || profile?.role === 'admin'
            ? 'You have admin privileges'
            : 'Your adventure dashboard'}
        </p>
      </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      {/* Upcoming Trip */}
      {upcomingTrips.length > 0 && (
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Your Trips */}
      {trips.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-brand-cream mb-4">Your Trips</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip) => (
              <Card key={trip.id} hoverable className="flex flex-col">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{trip.name}</CardTitle>
                  <CardDescription>{trip.destination}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-brand-cream/70 mb-4">
                    {formatDate(trip.start_date, 'MMM d')} - {formatDate(trip.end_date, 'MMM d, yyyy')}
                  </p>
                </CardContent>
                <div className="pt-4 border-t border-brand-brown/10">
                  <Badge variant={trip.status === 'upcoming' ? 'primary' : 'secondary'}>
                    {trip.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* Empty state */}
      {trips.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">You haven't joined any trips yet.</p>
            <p className="text-sm text-brand-cream/50">
              Check back soon or contact an admin to join a trip.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
