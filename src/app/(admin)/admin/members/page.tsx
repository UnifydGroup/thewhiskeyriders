/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { Search, Save, Trash2 } from 'lucide-react';
import type { Profile, UserRole } from '@/lib/types/database';

export default function AdminMembersPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Profile[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<{ [key: string]: UserRole }>({});

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (data) {
          setMembers(data);
          setFilteredMembers(data);
        }
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [supabase]);

  useEffect(() => {
    const filtered = members.filter((m) =>
      m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredMembers(filtered);
  }, [searchTerm, members]);

  const handleRoleChange = (id: string, role: UserRole) => {
    setEditRoles((prev) => ({
      ...prev,
      [id]: role,
    }));
  };

  const handleSaveRole = async (id: string) => {
    const newRole = editRoles[id];
    if (!newRole) return;

    try {
      // Supabase type system requires using a workaround for the role field
      // In production, this would use a stored procedure or custom endpoint
      const db = supabase.from('profiles');
      // Perform update on the database
      await db.update({ role: newRole } as any).eq('id', id);

      setMembers(
        members.map((m) =>
          m.id === id ? { ...m, role: newRole } : m
        )
      );
      setEditingId(null);
      setEditRoles((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      await supabase.from('profiles').delete().eq('id', id);
      setMembers(members.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Failed to delete member:', err);
    }
  };

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
        <h1 className="text-3xl font-bold text-brand-cream mb-2">Manage Members</h1>
        <p className="text-brand-cream/70">
          Total members: <strong>{members.length}</strong>
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-4 top-3 w-5 h-5 text-brand-cream/50" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      {filteredMembers.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-brown/20">
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Name</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Email</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Role</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Joined</th>
                    <th className="text-right py-3 px-4 text-brand-cream font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="border-b border-brand-brown/10 hover:bg-brand-dark-grey/50 transition-colors">
                      <td className="py-3 px-4 text-brand-cream font-medium">{member.full_name || '—'}</td>
                      <td className="py-3 px-4 text-brand-cream/70 text-xs break-all">{member.email}</td>
                      <td className="py-3 px-4">
                        {editingId === member.id ? (
                          <Select
                            value={editRoles[member.id] || member.role}
                            onChange={(e) =>
                              handleRoleChange(member.id, e.target.value as UserRole)
                            }
                            className="text-sm"
                          >
                            <option value="member">Member</option>
                            <option value="trip_admin">Trip Admin</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                          </Select>
                        ) : (
                          <Badge variant="primary">{member.role}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-brand-cream/70 text-xs">
                        {formatDate(member.created_at, 'MMM d, yyyy')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editingId === member.id ? (
                            <button
                              onClick={() => handleSaveRole(member.id)}
                              className="p-2 hover:bg-green-900/20 rounded transition-colors"
                            >
                              <Save className="w-4 h-4 text-green-600" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(member.id);
                                setEditRoles((prev) => ({
                                  ...prev,
                                  [member.id]: member.role,
                                }));
                              }}
                              className="px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-brown/10 rounded transition-colors"
                            >
                              Edit Role
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(member.id)}
                            className="p-2 hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70">No members found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
