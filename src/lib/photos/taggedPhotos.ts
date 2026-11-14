import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types/database';

export interface TaggedPhoto {
  id: string;
  trip_id: string;
  caption: string | null;
  created_at: string;
  url: string;
  media_type: 'image' | 'video';
  mime_type: string | null;
  trip_name: string;
  trip_slug: string;
  matched_tag: string;
  thumbnail_framing: unknown;
}

interface PhotoTagRow {
  photo_id: string;
  tag_value: string;
}

interface PhotoRow {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string | null;
  media_type: 'image' | 'video';
  mime_type: string | null;
  thumbnail_framing?: unknown;
  created_at: string;
}

interface TripRow {
  id: string;
  name: string;
  slug: string;
}

type TaggedPhotoProfile = Pick<Profile, 'id' | 'first_name' | 'middle_name' | 'surname' | 'full_name' | 'nickname'>;

function getCandidateNames(profile: TaggedPhotoProfile): string[] {
  const fullFromParts = [profile.first_name, profile.middle_name, profile.surname]
    .filter(Boolean)
    .join(' ')
    .trim();

  const candidates = [fullFromParts, profile.full_name || '', profile.nickname || '']
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return Array.from(new Set(candidates));
}

function getMatchedTagDisplay(profile: TaggedPhotoProfile, rawTagValue: string): string {
  if (rawTagValue === profile.id) {
    const preferred = profile.nickname?.trim() || profile.full_name?.trim();
    return preferred || rawTagValue;
  }

  return rawTagValue;
}

/**
 * Load every photo a member is tagged in, newest first.
 * Matches person tags by profile id, plus legacy tags that stored the member's name.
 */
export async function loadTaggedPhotos(
  supabase: SupabaseClient,
  profile: TaggedPhotoProfile
): Promise<TaggedPhoto[]> {
  const tagRows: PhotoTagRow[] = [];
  const seenTags = new Set<string>();

  const addRows = (rows: Array<{ photo_id: string; tag_value: string }> | null) => {
    (rows || []).forEach((row) => {
      if (!row.photo_id || !row.tag_value) {
        return;
      }

      const key = `${row.photo_id}:${row.tag_value}`;
      if (seenTags.has(key)) {
        return;
      }

      seenTags.add(key);
      tagRows.push({
        photo_id: row.photo_id,
        tag_value: row.tag_value,
      });
    });
  };

  const { data: idTags, error: idTagsError } = await supabase
    .from('photo_tags')
    .select('photo_id, tag_value')
    .eq('tag_type', 'person')
    .eq('tag_value', profile.id);

  if (idTagsError) {
    throw new Error(idTagsError.message);
  }

  addRows(idTags as Array<{ photo_id: string; tag_value: string }> | null);

  const candidateNames = getCandidateNames(profile);
  if (candidateNames.length > 0) {
    const legacyTagResponses = await Promise.all(
      candidateNames.map(async (name) =>
        supabase
          .from('photo_tags')
          .select('photo_id, tag_value')
          .eq('tag_type', 'person')
          .ilike('tag_value', name)
      )
    );

    legacyTagResponses.forEach(({ data }) => {
      addRows(data as Array<{ photo_id: string; tag_value: string }> | null);
    });
  }

  const uniquePhotoIds = Array.from(new Set(tagRows.map((tag) => tag.photo_id)));
  if (uniquePhotoIds.length === 0) {
    return [];
  }

  const { data: photosData, error: photosError } = await supabase
    .from('photos')
    .select('id, trip_id, storage_path, caption, media_type, mime_type, thumbnail_framing, created_at')
    .in('id', uniquePhotoIds)
    .order('created_at', { ascending: false });

  if (photosError) {
    throw new Error(photosError.message);
  }

  const typedPhotos = (photosData || []) as PhotoRow[];
  const tripIds = Array.from(new Set(typedPhotos.map((photo) => photo.trip_id)));

  const { data: tripsData, error: tripsError } = await supabase
    .from('trips')
    .select('id, name, slug')
    .in('id', tripIds);

  if (tripsError) {
    throw new Error(tripsError.message);
  }

  const tripsById = new Map<string, TripRow>();
  (tripsData || []).forEach((trip) => {
    tripsById.set(trip.id, trip as TripRow);
  });

  const firstTagByPhotoId = new Map<string, string>();
  tagRows.forEach((row) => {
    if (!firstTagByPhotoId.has(row.photo_id)) {
      firstTagByPhotoId.set(row.photo_id, getMatchedTagDisplay(profile, row.tag_value));
    }
  });

  return typedPhotos
    .map((photo): TaggedPhoto | null => {
      const trip = tripsById.get(photo.trip_id);
      if (!trip) {
        return null;
      }

      const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path);

      return {
        id: photo.id,
        trip_id: photo.trip_id,
        caption: photo.caption,
        created_at: photo.created_at,
        url: data.publicUrl,
        media_type: photo.media_type === 'video' ? 'video' : 'image',
        mime_type: photo.mime_type || null,
        trip_name: trip.name,
        trip_slug: trip.slug,
        matched_tag: firstTagByPhotoId.get(photo.id) || '',
        thumbnail_framing: photo.thumbnail_framing ?? null,
      };
    })
    .filter((photo): photo is TaggedPhoto => Boolean(photo));
}
