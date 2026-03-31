'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { BarChart3, Users, Bike, DollarSign } from 'lucide-react';
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
        // Get pending payments count
        const { count: pendingCount } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        // Get upcoming trips count
        const { count: upcomingCount } = await supabase
          .from('trips')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'upcoming');
        setStats({
          totalTrips: tripCount || 0,
          totalMembers: memberCount || 0,
          pendingPayments: pendingCount || 0,
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
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Total Trips</p>
                <p className="text-3xl font-bold text-brand-cream">{stats.totalTrips}</p>
              </div>
              <div className="p-3 bg-brand-brown/20 rounded-lg">
                <Bike className="w-6 h-6 text-brand-brown" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Members</p>
                <p className="text-3xl font-bold text-brand-cream">{stats.totalMembers}</p>
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
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Pending Payments</p>
                <p className="text-3xl font-bold text-brand-cream">{stats.pendingPayments}</p>
              </div>
              <div className="p-3 bg-brand-brown/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-brand-brown" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-brand-cream/70 text-sm font-medium mb-1">Upcoming Trips</p>
                <p className="text-3xl font-bold text-brand-cream">{stats.upcomingTrips}</p>
              </div>
              <div className="p-3 bg-brand-brown/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-brand-brown" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-brand-cream mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/trips/new">
            <Button variant="primary" size="md" className="w-full">
              Create Trip
            </Button>
          </Link>
          <Link href="/admin/members">
            <Button variant="secondary" size="md" className="w-full">
              Manage Members
            </Button>
          </Link>
          <Link href="/admin/payments">
            <Button variant="outline" size="md" className="w-full">
              Upload Payments
            </Button>
          </Link>
          <Link href="/admin/trips">
            <Button variant="ghost" size="md" className="w-full">
              View Trips
            </Button>
          </Link>
        </div>
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
