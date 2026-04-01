'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable } from '@/components/admin/DataTable';
import { Plus, Download, Edit2, Trash2, FileText, Upload } from 'lucide-react';

type TripMember = {
  user_id: string;
  trip_role: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type TripDocument = {
  id: string;
  user_id: string | null;
  name: string;
  file_url: string;
  access_url?: string;
  file_type: string;
  created_at: string;
  assigned_user?: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const allowedTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export default function DocumentsManagementPage() {
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);
  const tripId = params.id as string;

  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const aName = a.profiles?.full_name || a.profiles?.email || a.user_id;
        const bName = b.profiles?.full_name || b.profiles?.email || b.user_id;
        return aName.localeCompare(bName);
      }),
    [members]
  );

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    return session.access_token;
  }, [supabase]);

  const fetchDocuments = useCallback(async () => {
    const token = await getAccessToken();
    const response = await fetch(`/api/trips/${tripId}/documents?limit=200&scope=admin`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Failed to fetch documents');
    }

    setDocuments(payload.data?.documents || []);
  }, [getAccessToken, tripId]);

  const fetchMembers = useCallback(async () => {
    const token = await getAccessToken();
    const response = await fetch(`/api/trips/${tripId}/members`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Failed to load trip members');
    }

    setMembers(payload.data?.members || []);
  }, [getAccessToken, tripId]);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([fetchDocuments(), fetchMembers()]);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to load documents'));
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [tripId, fetchDocuments, fetchMembers]);

  const resetForm = () => {
    setName('');
    setSelectedFile(null);
    setRecipientMode('all');
    setSelectedUserIds([]);
    setEditingId(null);
    setShowForm(false);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();

      if (!name.trim()) {
        throw new Error('Document name is required');
      }

      if (editingId) {
        const response = await fetch(`/api/trips/${tripId}/documents/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: name.trim() }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to update document');
        }

        await fetchDocuments();
        resetForm();
        return;
      }

      if (!selectedFile) {
        throw new Error('Please select a file to upload');
      }

      if (!allowedTypes.includes(selectedFile.type)) {
        throw new Error('Unsupported file type');
      }

      if (selectedFile.size > 25 * 1024 * 1024) {
        throw new Error('File is too large (max 25MB)');
      }

      if (recipientMode === 'specific' && selectedUserIds.length === 0) {
        throw new Error('Select at least one member');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', name.trim());
      formData.append('share_with_all', String(recipientMode === 'all'));
      if (recipientMode === 'specific') {
        formData.append('user_ids', JSON.stringify(selectedUserIds));
      }

      const response = await fetch(`/api/trips/${tripId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to upload document');
      }

      await fetchDocuments();
      resetForm();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Something went wrong'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?')) {
      return;
    }

    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/trips/${tripId}/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to delete document');
      }

      await fetchDocuments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete document'));
    }
  };

  const getFileIcon = (fileType: string) => {
    const normalizedType = (fileType || '').toLowerCase();
    if (normalizedType.includes('pdf')) return '📄';
    if (normalizedType.includes('image')) return '🖼️';
    if (normalizedType.includes('video')) return '🎥';
    if (normalizedType.includes('word') || normalizedType.includes('document')) return '📝';
    if (normalizedType.includes('sheet') || normalizedType.includes('excel')) return '📊';
    return '📎';
  };

  const columns = [
    {
      key: 'name',
      label: 'Document',
      render: (value: string, row: TripDocument) => (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getFileIcon(row.file_type)}</span>
          <span className="font-bold">{value}</span>
        </div>
      ),
    },
    {
      key: 'user_id',
      label: 'Recipients',
      render: (_value: string | null, row: TripDocument) => {
        if (!row.user_id) {
          return <span className="text-sm text-green-400">All trip members</span>;
        }

        const displayName = row.assigned_user?.full_name || row.assigned_user?.email || row.user_id;
        return <span className="text-sm text-gray-300">{displayName}</span>;
      },
    },
    {
      key: 'file_type',
      label: 'Type',
      render: (value: string) => <span className="text-gray-300 text-sm">{value || 'Unknown'}</span>,
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (value: string, row: TripDocument) => (
        <div className="flex gap-2">
          <a
            href={row.access_url || row.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-gray-700 rounded"
            title="Open document"
          >
            <Download size={16} className="text-green-400" />
          </a>
          <button
            onClick={() => {
              setName(row.name);
              setEditingId(value);
              setShowForm(true);
            }}
            className="p-1 hover:bg-gray-700 rounded"
            title="Edit document name"
          >
            <Edit2 size={16} className="text-blue-400" />
          </button>
          <button
            onClick={() => handleDeleteDocument(value)}
            className="p-1 hover:bg-gray-700 rounded"
            title="Delete document"
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Documents & Resources</h1>
          <p className="text-gray-400">Upload and target trip documents for specific members</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((prev) => !prev)}>
          <Plus size={18} className="mr-2" />
          Upload Document
        </Button>
      </div>

      {error && (
        <Card className="border border-red-500 bg-red-900/20">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      {showForm && (
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Document' : 'Upload New Document'}</h2>

          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Document Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Trip Itinerary"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>

            {!editingId && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">File Upload *</label>
                  <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-600 transition">
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="file-upload"
                      accept={allowedTypes.join(',')}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer block">
                      {selectedFile ? (
                        <div className="text-green-400">
                          <p className="font-medium">✓ {selectedFile.name}</p>
                          <p className="text-sm text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div>
                          <Upload size={24} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Click to choose a document</p>
                          <p className="text-xs text-gray-500 mt-1">PDF, images, Word, Excel (max 25MB)</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Who should receive this document?</label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recipient-mode"
                        checked={recipientMode === 'all'}
                        onChange={() => {
                          setRecipientMode('all');
                          setSelectedUserIds([]);
                        }}
                      />
                      <span>All trip members</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recipient-mode"
                        checked={recipientMode === 'specific'}
                        onChange={() => setRecipientMode('specific')}
                      />
                      <span>Specific members only</span>
                    </label>

                    {recipientMode === 'specific' && (
                      <div className="mt-3 border border-gray-700 rounded-lg max-h-56 overflow-y-auto p-3 space-y-2">
                        {sortedMembers.length === 0 && (
                          <p className="text-sm text-gray-400">No trip members found.</p>
                        )}

                        {sortedMembers.map((member) => {
                          const label = member.profiles?.full_name || member.profiles?.email || member.user_id;
                          const checked = selectedUserIds.includes(member.user_id);

                          return (
                            <label key={member.user_id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleUserSelection(member.user_id)}
                              />
                              <span className="text-sm text-gray-300">{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Upload'}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileText className="text-yellow-400" />
            Documents ({documents.length})
          </h2>
          {documents.length > 0 ? (
            <DataTable columns={columns} data={documents} rowKey="id" />
          ) : (
            <p className="text-gray-400 text-center py-8">No documents yet. Upload one to get started.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
