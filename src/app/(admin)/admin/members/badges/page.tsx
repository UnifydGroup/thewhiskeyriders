'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Award, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { getMemberDisplayName, getMemberListName } from '@/lib/member-display';

type BadgeRecord = {
  id: string;
  name: string;
  description: string | null;
  badge_type: string;
  icon: string;
  trip_id: string | null;
};

type MemberRecord = {
  id: string;
  full_name: string | null;
  email?: string | null;
  nickname?: string | null;
  first_name?: string | null;
  surname?: string | null;
};

type TripRecord = {
  id: string;
  name: string;
  start_date: string | null;
};

type UserBadgeRecord = {
  id: string;
  user_id: string;
  badge_id: string;
  trip_id: string;
};

type FlashMessage = {
  type: 'success' | 'error';
  text: string;
};

export default function BadgeManagementPage() {
  const supabase = useMemo(() => createClient(), []);
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBadge, setNewBadge] = useState({
    name: '',
    description: '',
    badge_type: 'achievement',
    icon: '🏅',
    trip_id: '',
  });
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeRecord | null>(null);
  const [selectedMemberForBadge, setSelectedMemberForBadge] = useState('');
  const [selectedTripForAssignment, setSelectedTripForAssignment] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data: badgesData } = await supabase.from('badges').select('*');
      setBadges(badgesData || []);

      const { data: tripsData } = await supabase
        .from('trips')
        .select('id, name, start_date')
        .order('start_date', { ascending: false });
      setTrips(tripsData || []);

      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, first_name, surname, email')
        .order('nickname', { ascending: true });
      setMembers(membersData || []);

      const { data: userBadgesData } = await supabase.from('user_badges').select('*');
      setUserBadges(userBadgesData || []);
    } catch (err) {
      console.error('Load error:', err);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateBadge = async () => {
    if (!newBadge.name) {
      setMessage({ type: 'error', text: 'Badge name required' });
      return;
    }

    if ((newBadge.badge_type === 'trip' || newBadge.badge_type === 'role') && !newBadge.trip_id) {
      setMessage({ type: 'error', text: 'Please select a trip for trip/role badges' });
      return;
    }

    try {
      const payload = {
        name: newBadge.name,
        description: newBadge.description || null,
        badge_type: newBadge.badge_type,
        icon: newBadge.icon || '🏅',
        trip_id: newBadge.trip_id || null,
      };

      const { error } = await supabase.from('badges').insert([payload]);

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMessage({ type: 'success', text: 'Badge created successfully' });
      setNewBadge({ name: '', description: '', badge_type: 'achievement', icon: '🏅', trip_id: '' });
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Creation failed' });
    }
  };

  const handleDeleteBadge = async (badgeId: string) => {
    if (!confirm('Delete this badge?')) return;

    try {
      await supabase.from('user_badges').delete().eq('badge_id', badgeId);
      const { error } = await supabase.from('badges').delete().eq('id', badgeId);

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMessage({ type: 'success', text: 'Badge deleted' });
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleAssignBadge = async () => {
    if (!selectedBadge || !selectedMemberForBadge || !selectedTripForAssignment) {
      setMessage({ type: 'error', text: 'Select trip, badge and member' });
      return;
    }

    try {
      let badgeIdToAssign = selectedBadge.id;

      if (selectedBadge.trip_id !== selectedTripForAssignment) {
        const existingTripBadge = badges.find(
          (badge) =>
            badge.trip_id === selectedTripForAssignment &&
            badge.name === selectedBadge.name &&
            badge.badge_type === selectedBadge.badge_type
        );

        if (existingTripBadge) {
          badgeIdToAssign = existingTripBadge.id;
        } else {
          const { data: createdBadge, error: createBadgeError } = await supabase
            .from('badges')
            .insert({
              name: selectedBadge.name,
              description: selectedBadge.description,
              icon: selectedBadge.icon,
              badge_type: selectedBadge.badge_type,
              trip_id: selectedTripForAssignment,
            })
            .select()
            .single();

          if (createBadgeError || !createdBadge) {
            setMessage({
              type: 'error',
              text: createBadgeError?.message || 'Failed to attach badge to trip',
            });
            return;
          }

          badgeIdToAssign = createdBadge.id;
        }
      }

      const { error } = await supabase.from('user_badges').insert({
        user_id: selectedMemberForBadge,
        badge_id: badgeIdToAssign,
        trip_id: selectedTripForAssignment,
      });

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'Member already has this badge' });
        } else {
          setMessage({ type: 'error', text: error.message });
        }
        return;
      }

      setMessage({ type: 'success', text: 'Badge assigned' });
      setSelectedMemberForBadge('');
      setSelectedBadge(null);
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Assign failed' });
    }
  };

  const getTripName = (tripId: string | null) => {
    if (!tripId) return 'Global';
    const trip = trips.find((t) => t.id === tripId);
    return trip ? trip.name : 'Unknown Trip';
  };

  const assignableBadges = selectedTripForAssignment
    ? badges.filter((badge) => !badge.trip_id || badge.trip_id === selectedTripForAssignment)
    : [];

  const handleRemoveBadge = async (userBadgeId: string) => {
    try {
      const { error } = await supabase
        .from('user_badges')
        .delete()
        .eq('id', userBadgeId);

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMessage({ type: 'success', text: 'Badge removed' });
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Remove failed' });
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
          <Award className="w-8 h-8 text-brand-brown" />
          Badge Management
        </h1>
        <p className="text-brand-cream/70">Create badges and assign them to members</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Badge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-brand-cream flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Badge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Name</label>
              <Input
                placeholder="e.g., Peak Bagger"
                value={newBadge.name}
                onChange={(e) => setNewBadge({ ...newBadge, name: e.target.value })}
                className="bg-brand-black/50 border-brand-brown/20"
              />
            </div>

            <div>
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Description</label>
              <Input
                placeholder="What this badge represents"
                value={newBadge.description}
                onChange={(e) => setNewBadge({ ...newBadge, description: e.target.value })}
                className="bg-brand-black/50 border-brand-brown/20"
              />
            </div>

            <div>
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Type</label>
              <select
                value={newBadge.badge_type}
                onChange={(e) => setNewBadge({ ...newBadge, badge_type: e.target.value })}
                className="w-full bg-brand-black/50 border border-brand-brown/20 rounded px-3 py-2 text-brand-cream text-sm"
              >
                <option value="achievement">Achievement</option>
                <option value="trip">Trip Completion</option>
                <option value="role">Role</option>
              </select>
            </div>

            <div>
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Trip</label>
              <select
                value={newBadge.trip_id}
                onChange={(e) => setNewBadge({ ...newBadge, trip_id: e.target.value })}
                className="w-full bg-brand-black/50 border border-brand-brown/20 rounded px-3 py-2 text-brand-cream text-sm"
              >
                <option value="">Global / Not trip-specific</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleCreateBadge}
              className="w-full bg-brand-brown hover:bg-brand-brown/80 text-brand-black font-semibold"
            >
              Create Badge
            </Button>
          </CardContent>
        </Card>

        {/* Assign Badge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-brand-cream">Assign Badge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Select Trip</label>
              <select
                value={selectedTripForAssignment}
                onChange={(e) => {
                  setSelectedTripForAssignment(e.target.value);
                  setSelectedBadge(null);
                }}
                className="w-full bg-brand-black/50 border border-brand-brown/20 rounded px-3 py-2 text-brand-cream text-sm"
              >
                <option value="">Choose a trip...</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Select Badge</label>
              <select
                value={selectedBadge?.id || ''}
                onChange={(e) => {
                  const badge = assignableBadges.find((b) => b.id === e.target.value);
                  setSelectedBadge(badge ?? null);
                }}
                className="w-full bg-brand-black/50 border border-brand-brown/20 rounded px-3 py-2 text-brand-cream text-sm"
                disabled={!selectedTripForAssignment}
              >
                <option value="">
                  {selectedTripForAssignment ? 'Choose a badge...' : 'Select a trip first'}
                </option>
                {assignableBadges.map((badge) => (
                  <option key={badge.id} value={badge.id}>
                    {badge.name} {badge.trip_id ? `(for ${getTripName(badge.trip_id)})` : '(global)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Select Member</label>
              <select
                value={selectedMemberForBadge}
                onChange={(e) => setSelectedMemberForBadge(e.target.value)}
                className="w-full bg-brand-black/50 border border-brand-brown/20 rounded px-3 py-2 text-brand-cream text-sm"
              >
                <option value="">Choose a member...</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {getMemberListName(member)}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleAssignBadge}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              Assign Badge
            </Button>
          </CardContent>
        </Card>

        {/* Badges List */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-brand-cream">All Badges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {badges.length === 0 ? (
                <p className="text-brand-cream/50">No badges created yet</p>
              ) : (
                badges.map((badge) => {
                  const memberCount = userBadges.filter((ub) => ub.badge_id === badge.id).length;
                  return (
                    <div key={badge.id} className="p-3 bg-brand-black/30 rounded border border-brand-brown/10">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-brand-cream">{badge.name}</p>
                          <p className="text-brand-cream/50 text-sm">{badge.description}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs bg-brand-brown/20 px-2 py-1 rounded text-brand-cream/70">
                              {badge.badge_type}
                            </span>
                            <span className="text-xs bg-blue-900/30 px-2 py-1 rounded text-blue-300">
                              {getTripName(badge.trip_id)}
                            </span>
                            <span className="text-xs bg-brand-black/50 px-2 py-1 rounded text-brand-cream/70">
                              {memberCount} member{memberCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteBadge(badge.id)}
                          className="p-2 hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>

                      {/* Members with this badge */}
                      {memberCount > 0 && (
                        <div className="mt-3 pt-3 border-t border-brand-brown/10">
                          <p className="text-xs text-brand-cream/60 mb-2">Assigned to:</p>
                          <div className="flex flex-wrap gap-1">
                            {userBadges
                              .filter((ub) => ub.badge_id === badge.id)
                              .map((ub) => {
                                const member = members.find((m) => m.id === ub.user_id);
                                return (
                                  <span
                                    key={ub.id}
                                    className="text-xs bg-brand-brown/30 px-2 py-1 rounded text-brand-cream flex items-center gap-1 group"
                                  >
                                    {getMemberDisplayName(member)}
                                    <span className="text-brand-cream/60">· {getTripName(ub.trip_id)}</span>
                                    <button
                                      onClick={() => handleRemoveBadge(ub.id)}
                                      className="opacity-0 group-hover:opacity-100 ml-1"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
