'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Award, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { getMemberDisplayName, getMemberListName } from '@/lib/member-display';

export default function BadgeManagementPage() {
  const supabase = createClient();
  const [badges, setBadges] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBadge, setNewBadge] = useState({ name: '', description: '', badge_type: 'achievement', icon: '🏅' });
  const [message, setMessage] = useState<any>(null);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [selectedMemberForBadge, setSelectedMemberForBadge] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: badgesData } = await supabase.from('badges').select('*');
      setBadges(badgesData || []);

      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'member');
      setMembers(membersData || []);

      const { data: userBadgesData } = await supabase.from('user_badges').select('*');
      setUserBadges(userBadgesData || []);
    } catch (err) {
      console.error('Load error:', err);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBadge = async () => {
    if (!newBadge.name) {
      setMessage({ type: 'error', text: 'Badge name required' });
      return;
    }

    try {
      const { error } = await supabase.from('badges').insert([newBadge]);

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMessage({ type: 'success', text: 'Badge created successfully' });
      setNewBadge({ name: '', description: '', badge_type: 'achievement', icon: '🏅' });
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
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
    } catch (err) {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleAssignBadge = async () => {
    if (!selectedBadge || !selectedMemberForBadge) {
      setMessage({ type: 'error', text: 'Select badge and member' });
      return;
    }

    try {
      const { error } = await supabase.from('user_badges').insert({
        user_id: selectedMemberForBadge,
        badge_id: selectedBadge.id,
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
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Assign failed' });
    }
  };

  const handleRemoveBadge = async (userId: string, badgeId: string) => {
    try {
      const { error } = await supabase
        .from('user_badges')
        .delete()
        .match({ user_id: userId, badge_id: badgeId });

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMessage({ type: 'success', text: 'Badge removed' });
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
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
              <label className="block text-brand-cream/70 text-sm font-medium mb-1">Select Badge</label>
              <select
                value={selectedBadge?.id || ''}
                onChange={(e) => {
                  const badge = badges.find((b) => b.id === e.target.value);
                  setSelectedBadge(badge);
                }}
                className="w-full bg-brand-black/50 border border-brand-brown/20 rounded px-3 py-2 text-brand-cream text-sm"
              >
                <option value="">Choose a badge...</option>
                {badges.map((badge) => (
                  <option key={badge.id} value={badge.id}>
                    {badge.name}
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
                                    key={ub.user_id}
                                    className="text-xs bg-brand-brown/30 px-2 py-1 rounded text-brand-cream flex items-center gap-1 group"
                                  >
                                    {getMemberDisplayName(member)}
                                    <button
                                      onClick={() => handleRemoveBadge(ub.user_id, badge.id)}
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
