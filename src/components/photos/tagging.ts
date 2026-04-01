export type TagType = 'trip' | 'year' | 'location' | 'person';
export type TagSuggestionsByType = Record<TagType, string[]>;

export interface PhotoTag {
  id: string;
  tag_type: TagType;
  tag_value: string;
  created_by?: string;
}

export const TAG_TYPES: { value: TagType; label: string }[] = [
  { value: 'trip', label: 'Trip' },
  { value: 'year', label: 'Year' },
  { value: 'location', label: 'Location' },
  { value: 'person', label: 'Person' },
];

const STATIC_TAG_SUGGESTIONS: Record<Exclude<TagType, 'person'>, string[]> = {
  trip: ['Morocco 2027', 'Vietnam 2011', 'India 2019', 'USA 2022', 'Cambodia 2024', 'Romania 2025'],
  year: ['2011', '2019', '2022', '2024', '2025', '2027'],
  location: ['Marrakech', 'Hanoi', 'Delhi', 'New York', 'Phnom Penh', 'Bucharest'],
};

const TAG_SUGGESTIONS_STORAGE_KEY = 'wr-photo-tag-suggestions-v1';
const MAX_SAVED_SUGGESTIONS_PER_TYPE = 50;

const EMPTY_TAG_SUGGESTIONS: TagSuggestionsByType = {
  trip: [],
  year: [],
  location: [],
  person: [],
};

function uniqueSuggestions(values: string[]): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  values.forEach((value) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    const normalized = trimmedValue.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    uniqueValues.push(trimmedValue);
  });

  return uniqueValues;
}

function isTagType(type: string): type is TagType {
  return type === 'trip' || type === 'year' || type === 'location' || type === 'person';
}

export function readSavedTagSuggestions(): TagSuggestionsByType {
  if (typeof window === 'undefined') {
    return EMPTY_TAG_SUGGESTIONS;
  }

  try {
    const rawValue = window.localStorage.getItem(TAG_SUGGESTIONS_STORAGE_KEY);
    if (!rawValue) {
      return EMPTY_TAG_SUGGESTIONS;
    }

    const parsed = JSON.parse(rawValue) as Partial<Record<string, unknown>>;
    const next: TagSuggestionsByType = {
      trip: [],
      year: [],
      location: [],
      person: [],
    };

    Object.entries(parsed).forEach(([type, values]) => {
      if (!isTagType(type) || !Array.isArray(values)) {
        return;
      }

      next[type] = uniqueSuggestions(
        values.filter((value): value is string => typeof value === 'string')
      ).slice(0, MAX_SAVED_SUGGESTIONS_PER_TYPE);
    });

    return next;
  } catch {
    return EMPTY_TAG_SUGGESTIONS;
  }
}

export function saveTagSuggestion(type: TagType, value: string): TagSuggestionsByType {
  const trimmedValue = value.trim();
  const current = readSavedTagSuggestions();

  if (!trimmedValue) {
    return current;
  }

  const next: TagSuggestionsByType = {
    ...current,
    [type]: uniqueSuggestions([trimmedValue, ...current[type]]).slice(
      0,
      MAX_SAVED_SUGGESTIONS_PER_TYPE
    ),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(TAG_SUGGESTIONS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  return next;
}

export function getTagSuggestions(
  type: TagType,
  personSuggestions: string[] = [],
  savedSuggestions: string[] = []
): string[] {
  if (type === 'person') {
    return uniqueSuggestions([...personSuggestions, ...savedSuggestions]);
  }

  return uniqueSuggestions([...STATIC_TAG_SUGGESTIONS[type], ...savedSuggestions]);
}
