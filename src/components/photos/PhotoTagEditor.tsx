'use client';

import { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getTagSuggestions, TAG_TYPES, TagSuggestionsByType, TagType, PhotoTag } from './tagging';

interface PhotoTagEditorProps {
  photoId: string;
  tripId: string;
  tags: PhotoTag[];
  canEdit: boolean;
  personSuggestions?: string[];
  savedTagSuggestions?: TagSuggestionsByType;
  onTagAdded?: (tag: PhotoTag) => void;
  onTagRemoved?: (tagId: string) => void;
}

export default function PhotoTagEditor({
  photoId,
  tripId,
  tags,
  canEdit,
  personSuggestions = [],
  savedTagSuggestions = { trip: [], year: [], location: [], person: [] },
  onTagAdded,
  onTagRemoved,
}: PhotoTagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<TagType>('location');
  const [tagValue, setTagValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSuggestions = useMemo(
    () => getTagSuggestions(selectedType, personSuggestions, savedTagSuggestions[selectedType]),
    [personSuggestions, savedTagSuggestions, selectedType]
  );

  const suggestions = useMemo(() => {
    if (!tagValue.trim()) {
      return availableSuggestions;
    }

    const loweredValue = tagValue.toLowerCase();
    return availableSuggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(loweredValue)
    );
  }, [availableSuggestions, tagValue]);

  const handleTypeChange = (type: TagType) => {
    setSelectedType(type);
    setTagValue('');
  };

  const handleAddTag = async (value?: string) => {
    const finalValue = value || tagValue;

    if (!finalValue.trim()) {
      setError('Please enter a tag value');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trips/${tripId}/photos/${photoId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_type: selectedType,
          tag_value: finalValue.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add tag');
      }

      onTagAdded?.(data);
      setTagValue('');
      setIsAdding(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add tag';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/trips/${tripId}/photos/${photoId}/tags?tagId=${tagId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove tag');
      }

      onTagRemoved?.(tagId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove tag';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Display tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              <Badge variant="outline" className="bg-brand-brown/20 border-brand-brown/50">
                <span className="text-xs uppercase tracking-wider text-brand-tan">
                  {tag.tag_type}:
                </span>
                <span className="ml-1">{tag.tag_value}</span>
              </Badge>
              {canEdit && (
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  disabled={loading}
                  className="text-brand-cream/40 hover:text-brand-cream/70 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add tag form */}
      {canEdit && (
        <div>
          {!isAdding ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Tag
            </Button>
          ) : (
            <div className="space-y-3 p-3 bg-brand-brown/10 rounded-lg border border-brand-brown/20">
              {/* Type selector */}
              <div className="flex gap-2 flex-wrap">
                {TAG_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleTypeChange(type.value)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedType === type.value
                        ? 'bg-brand-brown text-brand-black'
                        : 'bg-brand-brown/20 text-brand-cream hover:bg-brand-brown/30'
                    }`}
                    disabled={loading}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Value input */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  placeholder={`Enter ${TAG_TYPES.find((t) => t.value === selectedType)?.label.toLowerCase()}...`}
                  disabled={loading}
                  list={selectedType === 'person' ? `${photoId}-person-suggestions` : undefined}
                  className="w-full px-3 py-2 bg-brand-black border border-brand-brown/20 rounded text-brand-cream placeholder:text-brand-cream/40 focus:outline-none focus:border-brand-brown"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag();
                    }
                  }}
                />
                {selectedType === 'person' && availableSuggestions.length > 0 && (
                  <datalist id={`${photoId}-person-suggestions`}>
                    {availableSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 5).map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleAddTag(suggestion)}
                        disabled={loading}
                        className="text-xs px-2 py-1 bg-brand-brown/20 hover:bg-brand-brown/40 text-brand-cream rounded transition-colors disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleAddTag()}
                  disabled={loading || !tagValue.trim()}
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setTagValue('');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
