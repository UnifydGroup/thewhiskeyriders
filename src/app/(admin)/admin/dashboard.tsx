'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import {
  Users,
  Calendar,
  DollarSign,
  Camera,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface DashboardStats {
  totalMembers: number;
  activeTrips: number;
  totalRevenue: number;
  totalPhotos: number;
  pendingPayments: number;
  upcomingTrips: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // This would be replaced with actual API calls
        // For now, we'll show placeholder data
        setStats({
          totalMembers: 45,
          activeTrips: 3,
          totalRevenue: 12500,
          totalPhotos: 1240,
          pendingPayments: 8,
          upcomingTrips: 5,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const statCards = [
    {
      icon: Users,
      label: 'Total Members',
      value: stats?.totalMembers || 0,
      color: 'bg-blue-500/10 border-blue-500/30',
      href: '/admin/members',
    },
    {
      icon: Calendar,
      label: 'Active Trips',
      value: stats?.activeTrips || 0,
      color: 'bg-purple-500/10 border-purple-500/30',
      href: '/admin/trips',
    },
    {
      icon: DollarSign,
      label: 'Revenue',
      value: `$${stats?.totalRevenue || 0}`,
      color: 'bg-green-500/10 border-green-500/30',
      href: '/admin/payments/manage',
    },
    {
      icon: Camera,
      label: 'Total Photos',
      value: stats?.totalPhotos || 0,
      color: 'bg-yellow-500/10 border-yellow-500/30',
      href: '/admin/galleries',
    },
  ];

  const alertCards = [
    {
      icon: AlertCircle,
      label: 'Pending Payments',
      value: stats?.pendingPayments || 0,
      color: 'text-red-400',
      href: '/admin/payments/manage?status=pending',
    },
    {
      icon: Clock,
      label: 'Upcoming Trips',
      value: stats?.upcomingTrips || 0,
      color: 'text-blue-400',
      href: '/admin/trips?status=upcoming',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Welcome back! Here's your portal overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.href} href={stat.href}>
              <Card
                className={`border ${stat.color} hover:border-opacity-100 transition-all cursor-pointer`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <Icon size={24} className="text-gray-500 opacity-50" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alertCards.map((alert) => {
          const Icon = alert.icon;
          return (
            <Link key={alert.href} href={alert.href}>
              <Card className="border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <Icon size={32} className={alert.color} />
                  <div className="flex-1">
                    <p className="text-gray-400 text-sm">{alert.label}</p>
                    <p className="text-2xl font-bold">{alert.value}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/admin/trips/new">
            <Button variant="secondary" className="w-full">
              <Calendar size={18} className="mr-2" />
              New Trip
            </Button>
          </Link>
          <Link href="/admin/members">
            <Button variant="secondary" className="w-full">
              <Users size={18} className="mr-2" />
              Manage Members
            </Button>
          </Link>
          <Link href="/admin/payments/manage">
            <Button variant="secondary" className="w-full">
              <DollarSign size={18} className="mr-2" />
              Payments
            </Button>
          </Link>
          <Link href="/admin/galleries">
            <Button variant="secondary" className="w-full">
              <Camera size={18} className="mr-2" />
              Galleries
            </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card>
        <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex items-center justify-between p-2 hover:bg-gray-800/30 rounded">
            <span>John Smith added to Morocco 2027 trip</span>
            <span className="text-xs text-gray-500">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-gray-800/30 rounded">
            <span>Payment received: $500 from Jane Doe</span>
            <span className="text-xs text-gray-500">4 hours ago</span>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-gray-800/30 rounded">
            <span>New gallery created: Day 2 Photos</span>
            <span className="text-xs text-gray-500">1 day ago</span>
          </div>
          <div className="flex items-center justify-between p-2 hover:bg-gray-800/30 rounded">
            <span>Trip status changed: Morocco 2027 → Active</span>
            <span className="text-xs text-gray-500">2 days ago</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
