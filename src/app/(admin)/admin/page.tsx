'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { BarChart3, Users, Bike, DollarSign } from 'lucide-react';

interface TripMilestone {
  trip_id: string;
  milestone_date: string;
  accumulated_amount: number;
}

interface TripMember {
  trip_id: string;
  user_id: string;
}

interface MemberPayment {
  trip_id: string;
  member_id: string;
  amount: number;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalMembers: 0,
    pendingPayments: 0,
    upcomingTrips: 0,
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadStats = async () => {
      try {
        // Get trip count
        const { count: tripCount } = await supabase
          .from('trips')
          .select('*', { count: 'exact', head: true });
        // Get member count
        const { count: memberCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        // Get pending payments amount to the current milestone (active/upcoming trips)
        let pendingOutstandingAmount = 0;
        const { data: trackedTrips, error: trackedTripsError } = await supabase
          .from('trips')
          .select('id')
          .in('status', ['active', 'upcoming']);
        if (trackedTripsError) throw trackedTripsError;

        const trackedTripIds = (trackedTrips || []).map((trip) => trip.id);
        if (trackedTripIds.length > 0) {
          const today = new Date();
          const [
            { data: milestones, error: milestonesError },
            { data: tripMembers, error: tripMembersError },
            { data: memberPayments, error: memberPaymentsError },
          ] = await Promise.all([
            supabase
              .from('payment_schedule_milestones')
              .select('trip_id, milestone_date, accumulated_amount')
              .in('trip_id', trackedTripIds)
              .order('milestone_date', { ascending: true }),
            supabase
              .from('trip_members')
              .select('trip_id, user_id')
              .in('trip_id', trackedTripIds),
            supabase
              .from('member_payments')
              .select('trip_id, member_id, amount')
              .in('trip_id', trackedTripIds),
          ]);

          if (milestonesError) throw milestonesError;
          if (tripMembersError) throw tripMembersError;
          if (memberPaymentsError) throw memberPaymentsError;

          const expectedByTrip = new Map<string, number>();
          for (const milestone of (milestones || []) as TripMilestone[]) {
            if (new Date(milestone.milestone_date) <= today) {
              expectedByTrip.set(milestone.trip_id, Number(milestone.accumulated_amount));
            }
          }

          const paidByMemberByTrip = new Map<string, number>();
          for (const payment of (memberPayments || []) as MemberPayment[]) {
            const key = `${payment.trip_id}:${payment.member_id}`;
            paidByMemberByTrip.set(key, (paidByMemberByTrip.get(key) || 0) + Number(payment.amount));
          }

          for (const member of (tripMembers || []) as TripMember[]) {
            const expectedAmount = expectedByTrip.get(member.trip_id) || 0;
            if (expectedAmount <= 0) continue;

            const paidAmount = paidByMemberByTrip.get(`${member.trip_id}:${member.user_id}`) || 0;
            pendingOutstandingAmount += Math.max(0, expectedAmount - paidAmount);
          }
        }
        // Get upcoming trips count
        const { count: upcomingCount } = await supabase
          .from('trips')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'upcoming');
        setStats({
          totalTrips: tripCount || 0,
          totalMembers: memberCount || 0,
          pendingPayments: pendingOutstandingAmount,
          upcomingTrips: upcomingCount || 0,
        });
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [supabase]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-brand-cream mb-2">Admin Dashboard</h1>
        <p className="text-brand-cream/70">Manage Whiskey Riders</p>
      </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Total Trips</p>
                <p className="text-3xl font-bold text-brand-cream">{stats.totalTrips}</p>
              </div>
              <div className="p-3 bg-brand-brown/20 rounded-lg">
                <Bike className="w-6 h-6 text-brand-brown" />
              </div>
            </div>
            <Link href="/admin/trips">
              <Button variant="ghost" size="sm" className="w-full">
                View Trips
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Members</p>
                <p className="text-3xl font-bold text-brand-cream">{stats.totalMembers}</p>
              </div>
              <div className="p-3 bg-brand-brown/20 rounded-lg">
                <Users className="w-6 h-6 text-brand-brown" />
              </div>
            </div>
            <Link href="/admin/members">
              <Button variant="secondary" size="sm" className="w-full">
                Manage Members
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Pending Payments</p>
                <p className="text-3xl font-bold text-brand-cream">
                  ${stats.pendingPayments.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="p-3 bg-brand-brown/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-brand-brown" />
              </div>
            </div>
            <Link href="/admin/payments/manage">
              <Button variant="outline" size="sm" className="w-full">
                Review Payments
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Upcoming Trips</p>
                <p className="text-3xl font-bold text-brand-cream">{stats.upcomingTrips}</p>
              </div>
              <div className="p-3 bg-brand-brown/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-brand-brown" />
              </div>
            </div>
            <Link href="/admin/trips?status=upcoming">
              <Button variant="ghost" size="sm" className="w-full">
                See Upcoming
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Tools</CardTitle>
          <CardDescription>Manage all aspects of Whiskey Riders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-brand-cream/70">
              Use the navigation menu to manage trips, members, and payments. All changes are logged for audit purposes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
