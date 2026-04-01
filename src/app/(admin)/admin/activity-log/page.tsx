'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable } from '@/components/admin/DataTable';
import { Activity, Download, Search, Clock } from 'lucide-react';

interface ActivityUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface ActivityRow {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user: ActivityUser | null;
}

interface ActivityStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface ActivityApiPayload {
  activities: ActivityRow[];
  stats: ActivityStats;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-900/30 text-blue-300',
  logout: 'bg-zinc-900/40 text-zinc-300',
  create: 'bg-emerald-900/30 text-emerald-300',
  update: 'bg-amber-900/30 text-amber-300',
  delete: 'bg-red-900/30 text-red-300',
  view: 'bg-indigo-900/30 text-indigo-300',
  interact: 'bg-purple-900/30 text-purple-300',
  upload: 'bg-cyan-900/30 text-cyan-300',
  download: 'bg-sky-900/30 text-sky-300',
  vote: 'bg-fuchsia-900/30 text-fuchsia-300',
  comment: 'bg-orange-900/30 text-orange-300',
  like: 'bg-pink-900/30 text-pink-300',
  bulkupload: 'bg-teal-900/30 text-teal-300',
};

function formatAction(action: string): string {
  return action
    .split('_')
    .flatMap((chunk) => chunk.split('.'))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function truncate(value: string, max = 96): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function formatActivitySummary(row: ActivityRow): string {
  const entity = row.entity_name || row.entity_id;
  const entityType = row.entity_type.replace(/_/g, ' ');
  return `${formatAction(row.action)} ${entityType}: ${entity}`;
}

function getString(change: Record<string, unknown> | null, key: string): string | null {
  if (!change) return null;
  const value = change[key];
  return typeof value === 'string' ? value : null;
}

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [stats, setStats] = useState<ActivityStats>({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  });

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await fetch('/api/activity-logs?limit=500', { cache: 'no-store' });
        if (!response.ok) {
          let errorMessage = `Request failed (${response.status})`;
          try {
            const errorBody = (await response.json()) as { error?: string };
            if (errorBody?.error) {
              errorMessage = errorBody.error;
            }
          } catch {
            // Ignore JSON parse failures and keep generic error.
          }
          throw new Error(errorMessage);
        }

        const payload = (await response.json()) as { data?: ActivityApiPayload };
        const activityList = payload.data?.activities || [];

        setActivities(activityList);
        setStats(
          payload.data?.stats || {
            total: activityList.length,
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
          }
        );
      } catch (fetchError) {
        console.error('Failed to load activity logs:', fetchError);
        setError(
          fetchError instanceof Error
            ? `Unable to load activity logs: ${fetchError.message}`
            : 'Unable to load activity logs.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchActivities();
  }, []);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(activities.map((activity) => activity.action))).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    let filtered = activities;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((activity) => {
        const searchParts = [
          activity.user?.full_name || '',
          activity.user?.email || '',
          activity.user_id,
          activity.entity_type,
          activity.entity_id,
          activity.entity_name || '',
          activity.ip_address || '',
          JSON.stringify(activity.changes || {}),
        ]
          .join(' ')
          .toLowerCase();

        return searchParts.includes(query);
      });
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter((activity) => activity.action === actionFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

      filtered = filtered.filter((activity) => {
        const created = new Date(activity.created_at);
        if (dateFilter === 'today') return created >= today;
        if (dateFilter === 'week') return created >= weekAgo;
        if (dateFilter === 'month') return created >= monthAgo;
        return true;
      });
    }

    return filtered;
  }, [activities, searchQuery, actionFilter, dateFilter]);

  const columns = [
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (value: string) => (
        <div className="text-sm">
          <p className="font-medium text-brand-cream">
            {new Date(value).toLocaleDateString()}
          </p>
          <p className="text-brand-cream/60 text-xs">
            {new Date(value).toLocaleTimeString()}
          </p>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (value: string) => (
        <span
          className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${
            ACTION_COLORS[value] || 'bg-zinc-900/40 text-zinc-300'
          }`}
        >
          {formatAction(value)}
        </span>
      ),
    },
    {
      key: 'user_id',
      label: 'User',
      render: (_: string, row: ActivityRow) => (
        <div className="text-sm">
          <p className="font-medium text-brand-cream">
            {row.user?.full_name || row.user?.email || `${row.user_id.slice(0, 8)}...`}
          </p>
          <p className="text-brand-cream/60 text-xs">{row.user?.email || row.user_id}</p>
        </div>
      ),
    },
    {
      key: 'entity_type',
      label: 'Activity',
      render: (_: string, row: ActivityRow) => {
        const path = getString(row.changes, 'path');
        const href = getString(row.changes, 'href');
        return (
          <div className="text-sm max-w-md">
            <p className="text-brand-cream">{truncate(formatActivitySummary(row))}</p>
            {path ? <p className="text-xs text-brand-cream/60">Path: {truncate(path)}</p> : null}
            {href ? <p className="text-xs text-brand-cream/60">Target: {truncate(href)}</p> : null}
          </div>
        );
      },
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (value: string | null) => (
        <span className="font-mono text-xs text-brand-cream/70">{value || 'N/A'}</span>
      ),
    },
  ];

  const handleExport = () => {
    const csvRows = [
      ['timestamp', 'action', 'user_name', 'user_email', 'entity_type', 'entity_id', 'entity_name', 'ip_address'],
      ...filteredActivities.map((activity) => [
        new Date(activity.created_at).toISOString(),
        activity.action,
        activity.user?.full_name || '',
        activity.user?.email || '',
        activity.entity_type,
        activity.entity_id,
        activity.entity_name || '',
        activity.ip_address || '',
      ]),
    ];

    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Activity size={30} className="text-brand-brown" />
          <div>
            <h1 className="text-3xl font-bold text-brand-cream">Admin Activity Log</h1>
            <p className="text-brand-cream/70">Track logins and admin interactions</p>
          </div>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download size={18} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-brand-cream/60 text-sm">Total Events</p>
          <p className="text-2xl font-bold text-brand-cream">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-brand-cream/60 text-sm">Today</p>
          <p className="text-2xl font-bold text-brand-cream">{stats.today}</p>
        </Card>
        <Card className="p-4">
          <p className="text-brand-cream/60 text-sm">Last 7 Days</p>
          <p className="text-2xl font-bold text-brand-cream">{stats.thisWeek}</p>
        </Card>
        <Card className="p-4">
          <p className="text-brand-cream/60 text-sm">This Month</p>
          <p className="text-2xl font-bold text-brand-cream">{stats.thisMonth}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-cream/50" />
            <Input
              type="text"
              placeholder="Search users, entities, IP, or metadata..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
          >
            <option value="all">All Actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {formatAction(action)}
              </option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-brand-cream">
            <Clock size={20} className="text-brand-brown" />
            Recent Activity ({filteredActivities.length})
          </h2>
          <DataTable columns={columns} data={filteredActivities} rowKey="id" emptyMessage="No activity events found" />
        </div>
      </Card>
    </div>
  );
}
