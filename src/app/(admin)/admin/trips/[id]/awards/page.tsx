'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable } from '@/components/admin/DataTable';
import { Plus, Edit2, Trash2, BarChart2, Trophy } from 'lucide-react';

export default function AwardsManagementPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [awards, setAwards] = useState<any[]>([]);
  const [voteResults, setVoteResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    icon: '',
  });

  useEffect(() => {
    fetchAwards();
  }, [tripId]);

  const fetchAwards = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/awards`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch awards');

      const data = await response.json();
      setAwards(data.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVoteResults = async (awardId: string) => {
    try {
      const response = await fetch(`/api/trips/${tripId}/awards/${awardId}/vote`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch vote results');

      const data = await response.json();
      setVoteResults({ awardId, ...data.data });
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleAddAward = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/awards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to add award');

      setFormData({ title: '', description: '', icon: '' });
      setShowForm(false);
      fetchAwards();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleUpdateAward = async (awardId: string) => {
    try {
      const response = await fetch(`/api/trips/${tripId}/awards/${awardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update award');

      setFormData({ title: '', description: '', icon: '' });
      setEditingId(null);
      setShowForm(false);
      fetchAwards();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDeleteAward = async (awardId: string) => {
    if (!confirm('Delete this award? All votes will be removed.')) return;

    try {
      const response = await fetch(`/api/trips/${tripId}/awards/${awardId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete award');

      fetchAwards();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Award Title',
      render: (value: string, row: any) => (
        <div className="flex items-center gap-2">
          {row.icon && <span className="text-2xl">{row.icon}</span>}
          <span className="font-bold">{value}</span>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (value: string) => <span className="text-gray-300 text-sm">{value || 'N/A'}</span>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (value: string, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => fetchVoteResults(value)}
            className="p-1 hover:bg-gray-700 rounded"
            title="View votes"
          >
            <BarChart2 size={16} className="text-purple-400" />
          </button>
          <button
            onClick={() => {
              setFormData({
                title: row.title,
                description: row.description || '',
                icon: row.icon || '',
              });
              setEditingId(value);
              setShowForm(true);
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <Edit2 size={16} className="text-blue-400" />
          </button>
          <button
            onClick={() => handleDeleteAward(value)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        </div>
      ),
    },
  ];

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Awards & Recognition</h1>
          <p className="text-gray-400">Create and manage trip awards and voting results</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} className="mr-2" />
          Add Award
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Award' : 'Add New Award'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Award Title</label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Funniest Moment"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Emoji Icon</label>
              <Input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="😂 🏆 🎉"
                maxLength={2}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this award for?"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => (editingId ? handleUpdateAward(editingId) : handleAddAward())}
            >
              {editingId ? 'Update' : 'Add'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({ title: '', description: '', icon: '' });
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Vote Results */}
      {voteResults && (
        <Card className="p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BarChart2 className="text-purple-400" />
              Voting Results: {voteResults.title}
            </h2>
            <button
              onClick={() => setVoteResults(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {voteResults.results && voteResults.results.length > 0 ? (
            <div className="space-y-3">
              {voteResults.results
                .sort((a: any, b: any) => b.vote_count - a.vote_count)
                .map((result: any, idx: number) => (
                  <div key={result.recipient_id} className="flex items-center gap-4">
                    <div className="text-sm font-bold w-6 h-6 flex items-center justify-center bg-gradient-to-r from-yellow-600 to-yellow-400 text-black rounded-full">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{result.recipient_id}</p>
                      <div className="bg-gray-800 rounded-full h-2 w-full mt-1">
                        <div
                          className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-2 rounded-full"
                          style={{
                            width: `${
                              voteResults.results.length > 0
                                ? (result.vote_count /
                                    Math.max(...voteResults.results.map((r: any) => r.vote_count))) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{result.vote_count}</p>
                      <p className="text-gray-400 text-xs">votes</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No votes yet</p>
          )}
        </Card>
      )}

      {/* Awards Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-400" />
            Awards ({awards.length})
          </h2>
          {awards.length > 0 ? (
            <DataTable columns={columns} data={awards} rowKey="id" />
          ) : (
            <p className="text-gray-400 text-center py-8">No awards yet. Create one to get started!</p>
          )}
        </div>
      </Card>
    </div>
  );
}
