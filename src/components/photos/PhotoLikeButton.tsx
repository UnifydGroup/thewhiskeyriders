'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

interface PhotoLikeButtonProps {
  photoId: string;
  tripId: string;
  isAuthenticated: boolean;
}

export default function PhotoLikeButton({
  photoId,
  tripId,
  isAuthenticated,
}: PhotoLikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLikes();
  }, [photoId, tripId]);

  const fetchLikes = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/likes`);
      if (response.ok) {
        const data = await response.json();
        setLikeCount(data.count);
        setLiked(data.userLiked);
      }
    } catch (err) {
      console.error('Failed to fetch likes:', err);
    }
  };

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      alert('Please sign in to like photos');
      return;
    }

    setLoading(true);

    try {
      if (liked) {
        // Remove like
        const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/likes`, {
          method: 'DELETE',
        });

        if (response.ok) {
          const data = await response.json();
          setLiked(false);
          setLikeCount(typeof data?.count === 'number' ? data.count : Math.max(0, likeCount - 1));
        }
      } else {
        // Add like
        const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/likes`, {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          setLiked(true);
          setLikeCount(typeof data?.count === 'number' ? data.count : likeCount + 1);
        }
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleLike}
      disabled={loading || !isAuthenticated}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        liked
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : 'bg-brand-brown/20 text-brand-cream/70 hover:bg-brand-brown/30 hover:text-brand-cream'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Heart
        className={`w-5 h-5 transition-transform ${
          liked ? 'fill-current' : ''
        }`}
      />
      <span className="text-sm font-semibold">{likeCount}</span>
    </button>
  );
}
