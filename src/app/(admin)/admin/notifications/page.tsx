'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Bell, CheckCircle2, XCircle, RefreshCcw, Clock,
  ClipboardList, UserPlus, CheckCheck, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────
type PendingMember = {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  middle_name: string | null;
  surname: string | null;
  nickname: string | null;
  phone_country_code: string | null;
  phone: string | null;
  address_city: string | null;
  address_country: string | null;
  created_at: string | null;
  status: string;
};

type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function getMemberName(member: PendingMember) {
  return (
    member.nickname ||
    [member.first_name, member.middle_name, member.surname].filter(Boolean).join(' ').trim() ||
    member.email
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  form_submission: <ClipboardList size={14} className="text-[#B5621E]" />,
  new_profile:     <UserPlus size={14} className="text-blue-400" />,
  new_contact:     <UserPlus size={14} className="text-amber-400" />,
  system:          <Bell size={14} className="text-zinc-400" />,
};

// ─────────────────────────────────────────────────────────────────
export default function AdminNotificationsPage() {
  const supabase = useMemo(() => createClient(), []);

  // Pending signups
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingMembers, setPendingMembers]  = useState<PendingMember[]>([]);
  const [processingId, setProcessingId]     = useState<string | null>(null);

  // App notifications
  const [loadingNotifs, setLoadingNotifs]  = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [markingAll, setMarkingAll]        = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ── Auth token helper ─────────────────────────────────────────
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    });
  }, [supabase]);

  // ── Load pending signups ──────────────────────────────────────
  const loadPendingMembers = useCallback(async () => {
    setLoadingPending(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, email, first_name, middle_name, surname, nickname, phone_country_code, phone, address_city, address_country, created_at, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPendingMembers((data as PendingMember[]) || []);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to load pending signups');
    } finally {
      setLoadingPending(false);
    }
  }, [supabase]);

  // ── Load app notifications ────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const res  = await authFetch('/api/notifications?limit=50');
      const json = await res.json();
      setNotifications(json.success ? (json.data.notifications || []) : []);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoadingNotifs(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadPendingMembers();
    void loadNotifications();
  }, [loadPendingMembers, loadNotifications]);

  // ── Signup decision ───────────────────────────────────────────
  const handleDecision = async (memberId: string, nextStatus: 'active' | 'archived') => {
    setProcessingId(memberId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('status', 'pending');
      if (error) throw error;
      setPendingMembers(prev => prev.filter(m => m.id !== memberId));
      flash('success', nextStatus === 'active' ? 'Member approved.' : 'Signup request declined.');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to process request');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Mark single notification read ─────────────────────────────
  const markRead = async (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    await authFetch(`/api/notifications/${notifId}`, { method: 'PATCH' });
  };

  // ── Dismiss (delete) notification ────────────────────────────
  const dismiss = async (notifId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    await authFetch(`/api/notifications/${notifId}`, { method: 'DELETE' });
  };

  // ── Mark all read ─────────────────────────────────────────────
  const markAllRead = async () => {
    setMarkingAll(true);
    await authFetch('/api/notifications', { method: 'PATCH' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(false);
    flash('success', 'All notifications marked as read');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-brand-cream mb-1">Notifications</h1>
          <p className="text-brand-cream/70">New signups, form submissions, and system alerts</p>
        </div>
        <Button type="button" variant="outline" className="gap-2 w-full sm:w-auto"
          onClick={() => { void loadPendingMembers(); void loadNotifications(); }}
          disabled={loadingPending || loadingNotifs}>
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Flash message */}
      {message && (
        <div className={`p-3 rounded-lg border text-sm ${
          message.type === 'error'
            ? 'bg-red-900/20 border-red-500/30 text-red-100'
            : 'bg-green-900/20 border-green-500/30 text-green-100'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── App notifications ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-brown" />
              Activity
              {unreadCount > 0 && (
                <span className="bg-[#B5621E] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={markAllRead} disabled={markingAll}>
                <CheckCheck size={13} />
                Mark all read
              </Button>
            )}
          </div>
          <CardDescription>Form submissions, new profiles, and system events</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingNotifs ? (
            <div className="py-10 flex justify-center"><Spinner size="lg" /></div>
          ) : notifications.length === 0 ? (
            <div className="rounded-lg border border-brand-brown/20 bg-brand-black/30 p-6 text-center">
              <Bell className="w-8 h-8 mx-auto mb-3 text-brand-cream/30" />
              <p className="text-brand-cream font-medium">No notifications yet</p>
              <p className="text-brand-cream/60 text-sm mt-1">Form submissions and system events will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(notif => (
                <div key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                    notif.is_read
                      ? 'border-brand-brown/10 bg-brand-black/20 opacity-60'
                      : 'border-brand-brown/25 bg-brand-black/40'
                  }`}>

                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {NOTIF_ICONS[notif.type] ?? NOTIF_ICONS['system']}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-medium ${notif.is_read ? 'text-brand-cream/60' : 'text-brand-cream'}`}>
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B5621E] shrink-0 mt-0.5" />
                      )}
                    </div>
                    <p className="text-brand-cream/60 text-xs mt-0.5 leading-relaxed">{notif.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-brand-cream/30 text-xs">{timeAgo(notif.created_at)}</span>
                      {notif.link && (
                        <a href={notif.link}
                          className="text-xs text-[#B5621E] hover:text-[#C9B98A] transition-colors"
                          onClick={() => !notif.is_read && markRead(notif.id)}>
                          View →
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!notif.is_read && (
                      <button onClick={() => markRead(notif.id)}
                        title="Mark as read"
                        className="p-1.5 text-zinc-500 hover:text-[#C9B98A] transition-colors">
                        <CheckCheck size={13} />
                      </button>
                    )}
                    <button onClick={() => dismiss(notif.id)}
                      title="Dismiss"
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pending signups ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-brown" />
            Pending Signups ({pendingMembers.length})
          </CardTitle>
          <CardDescription>Admins must approve each request before member portal access is enabled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPending ? (
            <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
          ) : pendingMembers.length === 0 ? (
            <div className="rounded-lg border border-brand-brown/20 bg-brand-black/30 p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3 text-brand-cream/50" />
              <p className="text-brand-cream font-medium">No pending signup requests</p>
              <p className="text-brand-cream/60 text-sm mt-1">New member requests will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingMembers.map(member => {
                const isProcessing = processingId === member.id;
                return (
                  <div key={member.id}
                    className="rounded-lg border border-brand-brown/20 bg-brand-black/30 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="text-brand-cream font-semibold">{getMemberName(member)}</p>
                        <p className="text-brand-cream/70 text-sm">{member.email}</p>
                        <p className="text-brand-cream/60 text-xs mt-1">
                          {member.user_id || 'No WR ID yet'}
                          {(member.phone_country_code || member.phone) && (
                            <> · {[member.phone_country_code, member.phone].filter(Boolean).join(' ')}</>
                          )}
                          {(member.address_city || member.address_country) && (
                            <> · {[member.address_city, member.address_country].filter(Boolean).join(', ')}</>
                          )}
                          {member.created_at && (
                            <> · {timeAgo(member.created_at)}</>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => void handleDecision(member.id, 'active')}
                          disabled={isProcessing}
                          isLoading={isProcessing}>
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button type="button" variant="danger"
                          onClick={() => void handleDecision(member.id, 'archived')}
                          disabled={isProcessing}>
                          <XCircle className="w-4 h-4" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
