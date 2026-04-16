'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Bell, CheckCircle2, XCircle, RefreshCcw, Clock } from 'lucide-react';

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

function getMemberName(member: PendingMember) {
  return (
    member.nickname ||
    [member.first_name, member.middle_name, member.surname].filter(Boolean).join(' ').trim() ||
    member.email
  );
}

export default function AdminNotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPendingMembers = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, user_id, email, first_name, middle_name, surname, nickname, phone_country_code, phone, address_city, address_country, created_at, status'
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setPendingMembers((data as PendingMember[]) || []);
    } catch (err) {
      console.error('Failed to load pending members:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load notifications',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadPendingMembers();
  }, [loadPendingMembers]);

  const handleDecision = async (memberId: string, nextStatus: 'active' | 'archived') => {
    setProcessingMemberId(memberId);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      setPendingMembers((prev) => prev.filter((member) => member.id !== memberId));
      setMessage({
        type: 'success',
        text:
          nextStatus === 'active'
            ? 'Member approved and granted portal access.'
            : 'Signup request declined.',
      });
    } catch (err) {
      console.error('Failed to process signup request:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to process signup request',
      });
    } finally {
      setProcessingMemberId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-brand-cream mb-1">Notifications</h1>
          <p className="text-brand-cream/70">Review new member signup requests</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 w-full sm:w-auto"
          onClick={() => void loadPendingMembers()}
          disabled={loading}
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-brown" />
            Pending Signups ({pendingMembers.length})
          </CardTitle>
          <CardDescription>Admins must approve each request before member portal access is enabled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div
              className={`p-3 rounded-lg border text-sm ${
                message.type === 'error'
                  ? 'bg-red-900/20 border-red-500/30 text-red-100'
                  : 'bg-green-900/20 border-green-500/30 text-green-100'
              }`}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : pendingMembers.length === 0 ? (
            <div className="rounded-lg border border-brand-brown/20 bg-brand-black/30 p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3 text-brand-cream/50" />
              <p className="text-brand-cream font-medium">No pending signup requests</p>
              <p className="text-brand-cream/60 text-sm mt-1">New member requests will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingMembers.map((member) => {
                const isProcessing = processingMemberId === member.id;

                return (
                  <div
                    key={member.id}
                    className="rounded-lg border border-brand-brown/20 bg-brand-black/30 p-4"
                  >
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
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => void handleDecision(member.id, 'active')}
                          disabled={isProcessing}
                          isLoading={isProcessing}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => void handleDecision(member.id, 'archived')}
                          disabled={isProcessing}
                        >
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
