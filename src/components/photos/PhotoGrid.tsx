'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import PhotoTagEditor from './PhotoTagEditor';
import PhotoLikeButton from './PhotoLikeButton';
import PhotoCommentsSection from './PhotoCommentsSection';
import {
  getTagSuggestions,
  PhotoTag,
  readSavedTagSuggestions,
  saveTagSuggestion,
  TagSuggestionsByType,
  TAG_TYPES,
  TagType,
} from './tagging';

interface Photo {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  media_type: 'image' | 'video';
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploaded_by: string;
  uploader_name?: string;
  url: string;
}

interface PhotoGridProps {
  photos: Photo[];
  tripId: string;
  isAdmin?: boolean;
  currentUserId?: string;
  publicView?: boolean;
  onPhotoDelete?: (photoId: string) => void;
  albumThumbnailPhotoUrl?: string | null;
  settingAlbumThumbnailPhotoId?: string | null;
  onSetAlbumThumbnail?: (photo: Photo) => Promise<void> | void;
}

interface TripMemberProfile {
  nickname: string | null;
}

interface TripMemberRow {
  profiles: TripMemberProfile | TripMemberProfile[] | null;
}

function isPhotoTag(value: unknown): value is PhotoTag {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PhotoTag>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.tag_type === 'string' &&
    typeof candidate.tag_value === 'string'
  );
}

function isVideoPhoto(photo: Pick<Photo, 'media_type'>) {
  return photo.media_type === 'video';
}

export default function PhotoGrid({
  photos,
  tripId,
  isAdmin = false,
  currentUserId,
  publicView = false,
  onPhotoDelete,
  albumThumbnailPhotoUrl = null,
  settingAlbumThumbnailPhotoId = null,
  onSetAlbumThumbnail,
}: PhotoGridProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [bulkTagType, setBulkTagType] = useState<TagType>('person');
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [bulkTagLoading, setBulkTagLoading] = useState(false);
  const [bulkTagError, setBulkTagError] = useState<string | null>(null);
  const [bulkTagMessage, setBulkTagMessage] = useState<string | null>(null);
  const [tagsByPhotoId, setTagsByPhotoId] = useState<Record<string, PhotoTag[]>>({});
  const [tagDataLoading, setTagDataLoading] = useState(false);
  const [memberNameSuggestions, setMemberNameSuggestions] = useState<string[]>([]);
  const [savedTagSuggestions, setSavedTagSuggestions] = useState<TagSuggestionsByType>({
    trip: [],
    year: [],
    location: [],
    person: [],
  });

  const supabase = useMemo(() => createClient(), []);
  const editablePhotoIds = useMemo(
    () =>
      new Set(
        photos
          .filter((photo) => isAdmin || currentUserId === photo.uploaded_by)
          .map((photo) => photo.id)
      ),
    [currentUserId, isAdmin, photos]
  );
  const canBulkTag = editablePhotoIds.size > 0;
  const allowTagging = !publicView;
  const showComments = !publicView;

  useEffect(() => {
    setSavedTagSuggestions(readSavedTagSuggestions());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchMemberNames = async () => {
      if (!allowTagging) {
        setMemberNameSuggestions([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('trip_members')
          .select('profiles:user_id(nickname)')
          .eq('trip_id', tripId);

        if (error || cancelled) {
          return;
        }

        const names = new Set<string>();
        const rows = (data ?? []) as TripMemberRow[];

        rows.forEach((row) => {
          const profileValue = row.profiles;
          const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;

          if (!profile) {
            return;
          }

          if (profile.nickname?.trim()) {
            names.add(profile.nickname.trim());
          }

        });

        setMemberNameSuggestions(Array.from(names).sort((a, b) => a.localeCompare(b)));
      } catch (err) {
        console.error('Failed to load trip members for tag suggestions:', err);
      }
    };

    fetchMemberNames();

    return () => {
      cancelled = true;
    };
  }, [allowTagging, supabase, tripId]);

  useEffect(() => {
    let cancelled = false;

    const fetchPhotoTags = async () => {
      if (!allowTagging) {
        setTagsByPhotoId({});
        setTagDataLoading(false);
        return;
      }

      if (photos.length === 0) {
        setTagsByPhotoId({});
        return;
      }

      setTagDataLoading(true);

      try {
        const tagEntries = await Promise.all(
          photos.map(async (photo) => {
            const response = await fetch(`/api/trips/${tripId}/photos/${photo.id}/tags`, {
              credentials: 'include',
            });

            if (!response.ok) {
              return [photo.id, [] as PhotoTag[]] as const;
            }

            const data: unknown = await response.json();
            const tags = Array.isArray(data) ? data.filter(isPhotoTag) : [];

            return [photo.id, tags] as const;
          })
        );

        if (cancelled) {
          return;
        }

        const nextTagsByPhotoId: Record<string, PhotoTag[]> = {};
        tagEntries.forEach(([photoId, tags]) => {
          nextTagsByPhotoId[photoId] = tags;
        });

        setTagsByPhotoId(nextTagsByPhotoId);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load photo tags for filtering:', err);
        }
      } finally {
        if (!cancelled) {
          setTagDataLoading(false);
        }
      }
    };

    fetchPhotoTags();

    return () => {
      cancelled = true;
    };
  }, [allowTagging, photos, tripId]);

  useEffect(() => {
    const validPhotoIds = new Set(photos.map((photo) => photo.id));
    setSelectedPhotoIds((previous) => previous.filter((photoId) => validPhotoIds.has(photoId)));
  }, [photos]);

  const uploaderOptions = useMemo(() => {
    const uploaderNames = photos
      .map((photo) => photo.uploader_name || 'Unknown')
      .filter((name, index, list) => list.indexOf(name) === index);

    return uploaderNames.sort((a, b) => a.localeCompare(b));
  }, [photos]);

  const personTagOptions = useMemo(() => {
    const names = new Set<string>();

    Object.values(tagsByPhotoId).forEach((tags) => {
      tags.forEach((tag) => {
        if (tag.tag_type === 'person' && tag.tag_value.trim()) {
          names.add(tag.tag_value.trim());
        }
      });
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tagsByPhotoId]);

  const filteredPhotos = useMemo(() => {
    const loweredQuery = searchQuery.trim().toLowerCase();

    return photos.filter((photo) => {
      const photoTags = tagsByPhotoId[photo.id] || [];
      const tagValues = photoTags.map((tag) => tag.tag_value).join(' ');
      const searchableContent = [
        photo.caption || '',
        photo.uploader_name || '',
        new Date(photo.created_at).toLocaleDateString(),
        tagValues,
      ]
        .join(' ')
        .toLowerCase();

      const matchesQuery = !loweredQuery || searchableContent.includes(loweredQuery);
      const matchesUploader =
        uploaderFilter === 'all' || (photo.uploader_name || 'Unknown') === uploaderFilter;
      const matchesPerson =
        !allowTagging ||
        personFilter === 'all' ||
        photoTags.some((tag) => tag.tag_type === 'person' && tag.tag_value === personFilter);

      return matchesQuery && matchesUploader && matchesPerson;
    });
  }, [allowTagging, photos, personFilter, searchQuery, tagsByPhotoId, uploaderFilter]);

  useEffect(() => {
    if (selectedPhotoIdx !== null && selectedPhotoIdx >= filteredPhotos.length) {
      setSelectedPhotoIdx(null);
    }
  }, [filteredPhotos.length, selectedPhotoIdx]);

  const bulkSuggestions = useMemo(() => {
    const suggestions = getTagSuggestions(
      bulkTagType,
      memberNameSuggestions,
      savedTagSuggestions[bulkTagType]
    );

    if (!bulkTagValue.trim()) {
      return suggestions.slice(0, 8);
    }

    const loweredValue = bulkTagValue.toLowerCase();
    return suggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(loweredValue))
      .slice(0, 8);
  }, [bulkTagType, bulkTagValue, memberNameSuggestions, savedTagSuggestions]);

  const togglePhotoSelection = (photoId: string) => {
    if (!editablePhotoIds.has(photoId)) {
      return;
    }

    setSelectedPhotoIds((previous) =>
      previous.includes(photoId)
        ? previous.filter((existingId) => existingId !== photoId)
        : [...previous, photoId]
    );
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this photo? This action cannot be undone.'
      )
    ) {
      return;
    }

    setDeletingId(photoId);

    try {
      const response = await fetch(`/api/trips/${tripId}/photos?photoId=${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error || 'Failed to delete photo');
      }

      setSelectedPhotoIds((previous) => previous.filter((selectedId) => selectedId !== photoId));
      setTagsByPhotoId((previous) => {
        const next = { ...previous };
        delete next[photoId];
        return next;
      });
      onPhotoDelete?.(photoId);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete photo');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkTagApply = async (valueOverride?: string) => {
    const finalValue = (valueOverride ?? bulkTagValue).trim();

    if (!finalValue) {
      setBulkTagError('Please enter a tag value before applying.');
      return;
    }

    if (selectedPhotoIds.length === 0) {
      setBulkTagError('Please select at least one photo.');
      return;
    }

    setBulkTagLoading(true);
    setBulkTagError(null);
    setBulkTagMessage(null);

    try {
      const results = await Promise.all(
        selectedPhotoIds.map(async (photoId) => {
          const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tag_type: bulkTagType,
              tag_value: finalValue,
            }),
          });

          let data: unknown = null;
          try {
            data = await response.json();
          } catch {
            data = null;
          }

          if (response.ok && isPhotoTag(data)) {
            return { status: 'added' as const, photoId, tag: data };
          }

          if (response.status === 409) {
            return { status: 'duplicate' as const, photoId };
          }

          const message =
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error
              : 'Failed to add tag';

          return { status: 'failed' as const, photoId, message };
        })
      );

      const addedResults = results.filter(
        (result): result is { status: 'added'; photoId: string; tag: PhotoTag } =>
          result.status === 'added'
      );
      const duplicateCount = results.filter((result) => result.status === 'duplicate').length;
      const failedResults = results.filter(
        (result): result is { status: 'failed'; photoId: string; message: string } =>
          result.status === 'failed'
      );

      if (addedResults.length > 0) {
        setTagsByPhotoId((previous) => {
          const next = { ...previous };

          addedResults.forEach(({ photoId, tag }) => {
            const existingTags = next[photoId] || [];
            const alreadyExists = existingTags.some((existingTag) => existingTag.id === tag.id);
            if (!alreadyExists) {
              next[photoId] = [...existingTags, tag];
            }
          });

          return next;
        });
      }

      if (addedResults.length > 0 || duplicateCount > 0) {
        setSavedTagSuggestions(saveTagSuggestion(bulkTagType, finalValue));
      }

      const summaryParts = [`Added to ${addedResults.length} item(s)`];
      if (duplicateCount > 0) {
        summaryParts.push(`${duplicateCount} duplicate(s) skipped`);
      }
      if (failedResults.length > 0) {
        summaryParts.push(`${failedResults.length} failed`);
      }

      setBulkTagMessage(summaryParts.join(' • '));
      setBulkTagValue('');

      if (failedResults.length > 0) {
        setBulkTagError(failedResults[0].message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bulk tagging failed';
      setBulkTagError(message);
    } finally {
      setBulkTagLoading(false);
    }
  };

  const handlePhotoTagAdded = (photoId: string, tag: PhotoTag) => {
    setSavedTagSuggestions(saveTagSuggestion(tag.tag_type, tag.tag_value));

    setTagsByPhotoId((previous) => {
      const existingTags = previous[photoId] || [];
      if (existingTags.some((existingTag) => existingTag.id === tag.id)) {
        return previous;
      }

      return {
        ...previous,
        [photoId]: [...existingTags, tag],
      };
    });
  };

  const handlePhotoTagRemoved = (photoId: string, tagId: string) => {
    setTagsByPhotoId((previous) => ({
      ...previous,
      [photoId]: (previous[photoId] || []).filter((tag) => tag.id !== tagId),
    }));
  };

  const searchPlaceholder = allowTagging
    ? 'Search by caption, uploader, date, or tag'
    : 'Search by caption, uploader, or date';

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-brand-cream/70">No media uploaded yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wider text-brand-cream/60 mb-1 block">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-base sm:text-sm text-brand-cream placeholder:text-brand-cream/40 focus:outline-none focus:border-brand-brown"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-brand-cream/60 mb-1 block">
              Uploader
            </label>
            <select
              value={uploaderFilter}
              onChange={(event) => setUploaderFilter(event.target.value)}
              className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-base sm:text-sm text-brand-cream focus:outline-none focus:border-brand-brown"
            >
              <option value="all">All uploaders</option>
              {uploaderOptions.map((uploaderName) => (
                <option key={uploaderName} value={uploaderName}>
                  {uploaderName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {allowTagging && (
            <div>
              <label className="text-xs uppercase tracking-wider text-brand-cream/60 mb-1 block">
                Tagged Person
              </label>
              <select
                value={personFilter}
                onChange={(event) => setPersonFilter(event.target.value)}
                className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-base sm:text-sm text-brand-cream focus:outline-none focus:border-brand-brown"
              >
                <option value="all">All people</option>
                {personTagOptions.map((personName) => (
                  <option key={personName} value={personName}>
                    {personName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className={`text-sm text-brand-cream/70 ${allowTagging ? 'md:col-span-2' : 'md:col-span-3'}`}>
            Showing {filteredPhotos.length} of {photos.length} item{photos.length !== 1 ? 's' : ''}
            {allowTagging && tagDataLoading ? ' (loading tags...)' : ''}
          </p>
        </div>

        {(searchQuery || uploaderFilter !== 'all' || (allowTagging && personFilter !== 'all')) && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setUploaderFilter('all');
                if (allowTagging) {
                  setPersonFilter('all');
                }
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {allowTagging && canBulkTag && (
        <div className="mb-6 p-4 rounded-lg border border-brand-brown/25 bg-brand-brown/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-brand-cream/80">
              {selectedPhotoIds.length} item{selectedPhotoIds.length !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedPhotoIds(
                    filteredPhotos
                      .filter((photo) => editablePhotoIds.has(photo.id))
                      .map((photo) => photo.id)
                  )
                }
                disabled={filteredPhotos.length === 0}
              >
                Select All Filtered
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPhotoIds([])}
                disabled={selectedPhotoIds.length === 0}
              >
                Clear Selection
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2">
            <select
              value={bulkTagType}
              onChange={(event) => setBulkTagType(event.target.value as TagType)}
              className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-base sm:text-sm text-brand-cream focus:outline-none focus:border-brand-brown"
              disabled={bulkTagLoading}
            >
              {TAG_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={bulkTagValue}
              onChange={(event) => setBulkTagValue(event.target.value)}
              placeholder="Tag value"
              list={bulkTagType === 'person' ? `${tripId}-bulk-person-suggestions` : undefined}
              className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-base sm:text-sm text-brand-cream placeholder:text-brand-cream/40 focus:outline-none focus:border-brand-brown"
              disabled={bulkTagLoading}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleBulkTagApply();
                }
              }}
            />

            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleBulkTagApply()}
              disabled={bulkTagLoading || selectedPhotoIds.length === 0 || !bulkTagValue.trim()}
            >
              {bulkTagLoading ? 'Applying...' : 'Apply Tag'}
            </Button>
          </div>

          {bulkTagType === 'person' && memberNameSuggestions.length > 0 && (
            <datalist id={`${tripId}-bulk-person-suggestions`}>
              {memberNameSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          )}

          {bulkSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bulkSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setBulkTagValue(suggestion)}
                  disabled={bulkTagLoading}
                  className="text-xs px-2 py-1 bg-brand-brown/20 hover:bg-brand-brown/40 text-brand-cream rounded transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {bulkTagMessage && <p className="text-xs text-green-400">{bulkTagMessage}</p>}
          {bulkTagError && <p className="text-xs text-red-400">{bulkTagError}</p>}
        </div>
      )}

      {filteredPhotos.length === 0 ? (
        <div className="text-center py-12 border border-brand-brown/20 rounded-lg">
          <p className="text-brand-cream/70">No photos match the current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {filteredPhotos.map((photo, idx) => {
            const isSelected = selectedPhotoIds.includes(photo.id);
            const isCurrentAlbumThumbnail =
              Boolean(albumThumbnailPhotoUrl) && photo.url === albumThumbnailPhotoUrl;
            return (
              <div
                key={photo.id}
                className="group relative bg-brand-brown/20 rounded-lg overflow-hidden aspect-square cursor-pointer"
                onClick={() => setSelectedPhotoIdx(idx)}
              >
                {isVideoPhoto(photo) ? (
                  <video
                    src={photo.url}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <Image
                    src={photo.url}
                    alt={photo.caption || 'Trip photo'}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  />
                )}

                {isVideoPhoto(photo) && (
                  <div className="absolute bottom-2 right-2 z-10 rounded bg-brand-black/75 px-2 py-1 text-[10px] uppercase tracking-wide text-brand-cream">
                    Video
                  </div>
                )}

                {canBulkTag && editablePhotoIds.has(photo.id) && (
                  <label
                    className="absolute top-2 left-2 z-10 bg-brand-black/70 rounded p-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePhotoSelection(photo.id)}
                      className="w-4 h-4"
                    />
                  </label>
                )}

                {isCurrentAlbumThumbnail && (
                  <div className="absolute bottom-2 left-2 z-10 rounded bg-brand-black/75 px-2 py-1 text-[10px] uppercase tracking-wide text-brand-cream">
                    Album Cover
                  </div>
                )}

                {/* Info overlay — always visible on mobile, hover-only on desktop */}
                <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div className="w-full">
                    {photo.caption && (
                      <p className="text-xs text-brand-cream/90 line-clamp-2 mb-2">{photo.caption}</p>
                    )}
                    <p className="text-xs text-brand-cream/70">by {photo.uploader_name}</p>
                    {onSetAlbumThumbnail && (
                      <div className="mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isCurrentAlbumThumbnail && !isVideoPhoto(photo)) {
                              void onSetAlbumThumbnail(photo);
                            }
                          }}
                          disabled={
                            isVideoPhoto(photo) ||
                            isCurrentAlbumThumbnail ||
                            settingAlbumThumbnailPhotoId === photo.id
                          }
                        >
                          {isVideoPhoto(photo)
                            ? 'Image Only'
                            : isCurrentAlbumThumbnail
                            ? 'Current Album Cover'
                            : settingAlbumThumbnailPhotoId === photo.id
                              ? 'Saving...'
                              : 'Set As Album Cover'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete button — always visible on mobile, hover-only on desktop */}
                {(isAdmin || currentUserId === photo.uploaded_by) && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeletePhoto(photo.id);
                    }}
                    disabled={deletingId === photo.id}
                    className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-600 active:bg-red-700 text-white p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedPhotoIdx !== null && filteredPhotos[selectedPhotoIdx] && (
        <PhotoDetailModal
          key={filteredPhotos[selectedPhotoIdx].id}
          photo={filteredPhotos[selectedPhotoIdx]}
          allPhotos={filteredPhotos}
          currentIndex={selectedPhotoIdx}
          tripId={tripId}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          personSuggestions={memberNameSuggestions}
          savedTagSuggestions={savedTagSuggestions}
          initialTags={tagsByPhotoId[filteredPhotos[selectedPhotoIdx].id] || []}
          allowTagging={allowTagging}
          showComments={showComments}
          onPrev={() => setSelectedPhotoIdx(Math.max(0, selectedPhotoIdx - 1))}
          onNext={() =>
            setSelectedPhotoIdx(Math.min(filteredPhotos.length - 1, selectedPhotoIdx + 1))
          }
          onClose={() => setSelectedPhotoIdx(null)}
          onTagAdded={handlePhotoTagAdded}
          onTagRemoved={handlePhotoTagRemoved}
        />
      )}
    </div>
  );
}

interface PhotoDetailModalProps {
  photo: Photo;
  allPhotos: Photo[];
  currentIndex: number;
  tripId: string;
  isAdmin?: boolean;
  currentUserId?: string;
  personSuggestions: string[];
  savedTagSuggestions: TagSuggestionsByType;
  initialTags: PhotoTag[];
  allowTagging: boolean;
  showComments: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onTagAdded: (photoId: string, tag: PhotoTag) => void;
  onTagRemoved: (photoId: string, tagId: string) => void;
}

function PhotoDetailModal({
  photo,
  allPhotos,
  currentIndex,
  tripId,
  isAdmin = false,
  currentUserId,
  personSuggestions,
  savedTagSuggestions,
  initialTags,
  allowTagging,
  showComments,
  onPrev,
  onNext,
  onClose,
  onTagAdded,
  onTagRemoved,
}: PhotoDetailModalProps) {
  const [tags, setTags] = useState<PhotoTag[]>(initialTags);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  // Touch-swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();
  }, [supabase]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onPrev, onNext, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger on primarily horizontal swipes (dx > dy * 1.5 and sufficient distance)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onNext();
      else onPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-brand-black border border-brand-brown/20 rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="sticky top-0 bg-brand-black border-b border-brand-brown/20 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-brand-cream">
              {isVideoPhoto(photo) ? 'Video' : 'Photo'} {currentIndex + 1} of {allPhotos.length}
            </h3>
            {photo.caption && <p className="text-xs text-brand-cream/70 mt-0.5 line-clamp-1">{photo.caption}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-brand-cream/60 hover:text-brand-cream text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 flex flex-col">
          {/* Media */}
          <div className="relative w-full bg-brand-black/50 flex items-center justify-center p-2 sm:p-4 flex-shrink-0">
            {photo.url && isVideoPhoto(photo) && (
              <video
                src={photo.url}
                className="max-w-full max-h-[45vh] sm:max-h-[60vh] object-contain"
                controls
                autoPlay
                playsInline
                preload="metadata"
              />
            )}
            {photo.url && !isVideoPhoto(photo) && (
              <img
                src={photo.url}
                alt={photo.caption || 'Trip photo'}
                className="max-w-full max-h-[45vh] sm:max-h-[60vh] object-contain"
              />
            )}
          </div>

          <div className="border-t border-brand-brown/20 p-4 space-y-6">
            <div className="text-sm text-brand-cream/70">
              <p>
                Uploaded by <span className="text-brand-cream">{photo.uploader_name}</span>
              </p>
              <p>{new Date(photo.created_at).toLocaleDateString()}</p>
              {photo.mime_type && <p>{photo.mime_type}</p>}
              {photo.width && photo.height && <p>{photo.width} × {photo.height} pixels</p>}
            </div>

            {allowTagging && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-brand-cream">Tags</h4>
                <PhotoTagEditor
                  photoId={photo.id}
                  tripId={tripId}
                  tags={tags}
                  personSuggestions={personSuggestions}
                  savedTagSuggestions={savedTagSuggestions}
                  canEdit={currentUserId === photo.uploaded_by || isAdmin}
                  onTagAdded={(tag) => {
                    setTags((previous) => [...previous, tag]);
                    onTagAdded(photo.id, tag);
                  }}
                  onTagRemoved={(tagId) => {
                    setTags((previous) => previous.filter((tag) => tag.id !== tagId));
                    onTagRemoved(photo.id, tagId);
                  }}
                />
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-brand-cream mb-2">Likes</h4>
              <PhotoLikeButton
                photoId={photo.id}
                tripId={tripId}
                isAuthenticated={isAuthenticated}
              />
            </div>

            {showComments && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-brand-cream">Comments</h4>
                <PhotoCommentsSection
                  photoId={photo.id}
                  tripId={tripId}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            )}
          </div>
        </div>

        {/* Navigation footer */}
        <div className="bg-brand-black border-t border-brand-brown/20 px-4 py-3 flex-shrink-0">
          <div className="flex gap-2 justify-between">
            <Button
              variant="outline"
              onClick={onPrev}
              disabled={currentIndex === 0}
              size="sm"
              className="flex-1 min-h-[44px]"
            >
              ← Prev
            </Button>
            <span className="text-xs text-brand-cream/40 self-center px-2 hidden sm:block select-none">
              swipe to navigate
            </span>
            <Button
              variant="primary"
              onClick={onNext}
              disabled={currentIndex === allPhotos.length - 1}
              size="sm"
              className="flex-1 min-h-[44px]"
            >
              Next →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
