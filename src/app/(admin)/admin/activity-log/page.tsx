'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable } from '@/components/admin/DataTable';
import { Activity, Search, Download, Filter, Clock } from 'lucide-react';

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  });

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    filterActivities();
  }, [activities, searchQuery, actionFilter, dateFilter]);

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/activity-logs', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch activities');

      const data = await response.json();
      const activityList = data.data;

      setActivities(activityList);

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

      setStats({
        total: activityList.length,
        today: activityList.filter((a: any) => new Date(a.created_at) >= today).length,
        thisWeek: activityList.filter((a: any) => new Date(a.created_at) >= weekAgo).length,
        thisMonth: activityList.filter((a: any) => new Date(a.created_at) >= monthAgo).length,
      });
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterActivities = () => {
    let filtered = activities;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a: any) =>
          (a.user_id?.toLowerCase() || '').includes(query) ||
          (a.description?.toLowerCase() || '').includes(query) ||
          (a.ip_address?.toLowerCase() || '').includes(query)
      );
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter((a: any) => a.action === actionFilter);
    }

    // Date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === 'today') {
      filtered = filtered.filter((a: any) => new Date(a.created_at) >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((a: any) => new Date(a.created_at) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter((a: any) => new Date(a.created_at) >= monthAgo);
    }

    setFilteredActivities(filtered);
  };

  const getActionColor = (action: string) => {
    const colors: { [key: string]: string } = {
      'user.login': 'bg-blue-900/30 text-blue-400',
      'user.logout': 'bg-gray-900/30 text-gray-400',
      'trip.create': 'bg-purple-900/30 text-purple-400',
      'trip.update': 'bg-orange-900/30 text-orange-400',
      'trip.delete': 'bg-red-900/30 text-red-400',
      'payment.create': 'bg-green-900/30 text-green-400',
      'payment.update': 'bg-yellow-900/30 text-yellow-400',
      'payment.delete': 'bg-red-900/30 text-red-400',
      'member.invite': 'bg-indigo-900/30 text-indigo-400',
      'member.update': 'bg-cyan-900/30 text-cyan-400',
      'admin.action': 'bg-red-900/20 text-red-300',
    };
    return colors[action] || 'bg-gray-900/30 text-gray-400';
  };

  const formatAction = (action: string) => {
    return action
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (value: string) => (
        <div className="text-sm">
          <p className="font-medium">{new Date(value).toLocaleDateString()}</p>
          <p className="text-gray-400 text-xs">{new Date(value).toLocaleTimeString()}</p>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (value: string) => (
        <span className={`px-3 py-1 rounded text-xs font-medium ${getActionColor(value)}`}>
          {formatAction(value)}
        </span>
      ),
    },
    {
      key: 'user_id',
      label: 'User',
      render: (value: string) => (
        <span className="font-mono text-xs">{value ? value.substring(0, 8) + '...' : 'System'}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (value: string) => <span className="text-gray-300 text-sm">{value || 'N/A'}</span>,
    },
    {
      key: 'ip_address',
      label: 'IP Address',
      render: (value: string) => <span className="font-mono text-xs text-gray-400">{value || 'N/A'}</span>,
    },
  ];

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'User', 'Description', 'IP Address'],
      ...filteredActivities.map((a) => [
        new Date(a.created_at).toISOString(),
        formatAction(a.action),
        a.user_id || 'System',
        a.description || '',
        a.ip_address || '',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity size={32} className="text-purple-400" />
          <div>
            <h1 className="text-3xl font-bold">Activity Log</h1>
            <p className="text-gray-400">Monitor all user and system activities</p>
          </div>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download size={18} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Total Activities</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">Today</p>
          <p className="text-2xl font-bold">{stats.today}</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">This Week</p>
          <p className="text-2xl font-bold">{stats.thisWeek}</p>
        </Card>
        <Card className="p-4">
          <p className="text-gray-400 text-sm">This Month</p>
          <p className="text-2xl font-bold">{stats.thisMonth}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              type="text"
              placeholder="Search user ID, description, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </Card>

      {/* Action Filter */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActionFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              actionFilter === 'all'
                ? 'bg-blue-900/30 text-blue-400'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {['user.login', 'trip.create', 'trip.update', 'payment.create', 'member.invite', 'admin.action'].map(
            (action) => (
              <button
                key={action}
                onClick={() => setActionFilter(action)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  actionFilter === action
                    ? getActionColor(action) + ' border border-current'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {formatAction(action)}
              </button>
            )
          )}
        </div>
      </Card>

      {/* Activity Log Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-purple-400" />
            Recent Activities ({filteredActivities.length})
          </h2>
          {filteredActivities.length > 0 ? (
            <DataTable columns={columns} data={filteredActivities} rowKey="id" />
          ) : (
            <p className="text-gray-400 text-center py-8">No activities found</p>
          )}
        </div>
      </Card>
    </div>
  );
}
