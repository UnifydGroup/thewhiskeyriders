'use client';

import { useState, useEffect } from 'react';
import { Send, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

interface Comment {
  id: string;
  photo_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

interface PhotoCommentsSectionProps {
  photoId: string;
  tripId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  isAuthenticated: boolean;
}

export default function PhotoCommentsSection({
  photoId,
  tripId,
  currentUserId,
  isAdmin = false,
  isAuthenticated,
}: PhotoCommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
  }, [photoId, tripId]);

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/comments`);

      if (response.ok) {
        const data = await response.json();
        setComments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) {
      setError('Please enter a comment');
      return;
    }

    if (!isAuthenticated) {
      setError('Please sign in to comment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add comment');
      }

      const comment = await response.json();
      setComments([...comments, comment]);
      setNewComment('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content: editContent }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update comment');
      }

      const updatedComment = await response.json();
      setComments(comments.map((c) => (c.id === commentId ? updatedComment : c)));
      setEditingId(null);
      setEditContent('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update comment';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/trips/${tripId}/photos/${photoId}/comments?commentId=${commentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    } finally {
      setLoading(false);
    }
  };

  const canEditComment = (comment: Comment) => {
    return currentUserId === comment.user_id || isAdmin;
  };

  return (
    <div className="space-y-4">
      {/* Add comment form */}
      {isAuthenticated && (
        <form onSubmit={handleAddComment} className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, 500))}
            placeholder="Add a comment..."
            disabled={loading}
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-brand-cream placeholder:text-brand-cream/40 focus:outline-none focus:border-brand-brown resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-cream/50">
              {newComment.length}/500
            </span>
            <Button
              type="submit"
              disabled={loading || !newComment.trim()}
              size="sm"
              variant="primary"
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Post
            </Button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      )}

      {!isAuthenticated && (
        <div className="text-center py-4 text-sm text-brand-cream/60">
          Sign in to comment on this photo
        </div>
      )}

      {/* Comments list */}
      {loadingComments ? (
        <div className="text-center py-4 text-sm text-brand-cream/60">
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-4 text-sm text-brand-cream/60">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-brand-brown/10 rounded-lg p-3 border border-brand-brown/20">
              {editingId === comment.id ? (
                // Edit mode
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value.slice(0, 500))}
                    maxLength={500}
                    rows={2}
                    className="w-full px-2 py-1 bg-brand-black border border-brand-brown/20 rounded text-brand-cream text-sm resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleEditComment(comment.id)}
                      disabled={loading}
                      className="text-sm px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent('');
                      }}
                      disabled={loading}
                      className="text-sm px-2 py-1 bg-brand-brown/20 hover:bg-brand-brown/30 text-brand-cream rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-brand-cream">
                        {comment.author_name}
                      </p>
                      <p className="text-xs text-brand-cream/50">
                        {formatDate(comment.created_at, 'MMM d, yyyy h:mm a')}
                        {comment.updated_at !== comment.created_at && ' (edited)'}
                      </p>
                    </div>
                    {canEditComment(comment) && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="p-1 text-brand-cream/60 hover:text-brand-cream transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 text-brand-cream/60 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-brand-cream/90 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
