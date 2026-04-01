'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Bike, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { getMemberDisplayName } from '@/lib/member-display';

export default function MemberTripsPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [memberTrips, setMemberTrips] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load members
      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, full_name, nickname')
        .order('full_name');

      setMembers(membersData || []);

      // Load trips (newest first)
      const { data: tripsData } = await supabase
        .from('trips')
        .select('id, name, start_date')
        .order('start_date', { ascending: false });
      setTrips(tripsData || []);

      // Load trip members
      const { data: tripMembersData } = await supabase.from('trip_members').select('trip_id, user_id');

      const memberTripsMap: any = {};
      (tripMembersData || []).forEach((tm) => {
        if (!memberTripsMap[tm.user_id]) {
          memberTripsMap[tm.user_id] = new Set();
        }
        memberTripsMap[tm.user_id].add(tm.trip_id);
      });

      setMemberTrips(memberTripsMap);
    } catch (err) {
      console.error('Load error:', err);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTrip = (memberId: string, tripId: string) => {
    const current = memberTrips[memberId] || new Set();
    const updated = new Set(current);

    if (updated.has(tripId)) {
      updated.delete(tripId);
    } else {
      updated.add(tripId);
    }

    setMemberTrips({
      ...memberTrips,
      [memberId]: updated,
    });
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Get original trip memberships
      const { data: originalTripMembers, error: originalTripMembersError } = await supabase
        .from('trip_members')
        .select('trip_id, user_id');

      if (originalTripMembersError) {
        throw originalTripMembersError;
      }

      const pairKey = (userId: string, tripId: string) => `${userId}::${tripId}`;

      const originalMembers = originalTripMembers || [];
      const originalKeys = new Set(
        originalMembers.map((tm) => pairKey(tm.user_id, tm.trip_id))
      );

      const currentPairs: { user_id: string; trip_id: string }[] = [];
      for (const [memberId, tripIds] of Object.entries(memberTrips)) {
        const tripSet = tripIds as Set<string>;
        for (const tripId of tripSet) {
          currentPairs.push({ user_id: memberId, trip_id: tripId });
        }
      }

      const currentKeys = new Set(
        currentPairs.map(({ user_id, trip_id }) => pairKey(user_id, trip_id))
      );

      // Find additions and deletions
      const toAdd: {
        user_id: string;
        trip_id: string;
        trip_role: 'captain' | 'kitty_man' | 'organiser' | 'member';
      }[] = currentPairs
        .filter(({ user_id, trip_id }) => !originalKeys.has(pairKey(user_id, trip_id)))
        .map(({ user_id, trip_id }) => ({ user_id, trip_id, trip_role: 'member' }));

      const toDelete = originalMembers.filter(
        ({ user_id, trip_id }) => !currentKeys.has(pairKey(user_id, trip_id))
      );

      // Delete removed memberships
      if (toDelete.length > 0) {
        const deleteResults = await Promise.all(
          toDelete.map(({ user_id, trip_id }) =>
            supabase
              .from('trip_members')
              .delete()
              .match({ user_id, trip_id })
          )
        );
        const deleteError = deleteResults.find((result) => result.error)?.error;
        if (deleteError) {
          throw deleteError;
        }
      }

      // Add new memberships
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase.from('trip_members').insert(toAdd);
        if (insertError) {
          throw insertError;
        }
      }

      setMessage({ type: 'success', text: 'Trip assignments saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setMessage({ type: 'error', text: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-cream mb-2 flex items-center gap-2">
          <Bike className="w-8 h-8 text-brand-brown" />
          Trip Attendance
        </h1>
        <p className="text-brand-cream/70">Check boxes to assign members to trips</p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded border flex gap-2 ${
            message.type === 'success'
              ? 'bg-green-900/20 border-green-600/50'
              : 'bg-red-900/20 border-red-600/50'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Trip Grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-brown/20">
              <th className="text-left py-3 px-4 text-brand-cream font-semibold">Member</th>
              {trips.map((trip) => (
                <th key={trip.id} className="text-center py-3 px-4 text-brand-cream font-semibold text-sm">
                  {trip.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-brand-brown/10 hover:bg-brand-dark-grey/50 transition-colors">
                <td className="py-3 px-4 text-brand-cream font-medium">{getMemberDisplayName(member)}</td>
                {trips.map((trip) => {
                  const isAssigned = Boolean(
                    memberTrips[member.id] && memberTrips[member.id].has(trip.id)
                  );
                  return (
                    <td key={trip.id} className="text-center py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => handleToggleTrip(member.id, trip.id)}
                        className="w-5 h-5 cursor-pointer accent-brand-brown"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-brown hover:bg-brand-brown/80 text-brand-black font-semibold flex items-center gap-2"
        >
          {saving ? (
            <>
              <Spinner size="sm" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Trip Assignments
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
