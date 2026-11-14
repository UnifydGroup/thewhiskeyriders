import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonDisplayName, isProfileId, type TaggedPerson } from '@/lib/photos/people';

interface TagRow {
  id: string;
  photo_id: string;
  tag_type: string;
  tag_value: string;
}

interface PersonProfile {
  id: string;
  nickname: string | null;
  full_name: string | null;
  avatar_url: string | null;
  avatar_framing: unknown;
}

/**
 * GET /api/trips/[id]/photos/tags
 * Every tag on every photo in a trip, in one request, with person tags resolved to names,
 * plus the list of people tagged in the trip and how many photos each appears in.
 * Visibility follows the photos table's row-level security (trip members and admins),
 * because tags are joined through photos with the member's own session.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: viewer } = await supabase.from('profiles').select('status').eq('id', user.id).single();
    if (viewer?.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: tagRows, error } = await supabase
      .from('photo_tags')
      .select('id, photo_id, tag_type, tag_value, photos!inner(trip_id)')
      .eq('photos.trip_id', tripId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tags = ((tagRows ?? []) as unknown as TagRow[]).map(({ id, photo_id, tag_type, tag_value }) => ({
      id,
      photo_id,
      tag_type,
      tag_value,
    }));

    const personIds = Array.from(
      new Set(tags.filter((tag) => tag.tag_type === 'person' && isProfileId(tag.tag_value)).map((tag) => tag.tag_value))
    );

    const profilesById = new Map<string, PersonProfile>();
    if (personIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, full_name, avatar_url, avatar_framing')
        .in('id', personIds);
      ((profiles ?? []) as PersonProfile[]).forEach((profile) => profilesById.set(profile.id, profile));
    }

    const photosByPerson = new Map<string, Set<string>>();
    const resolvedTags = tags.map((tag) => {
      if (tag.tag_type !== 'person') return tag;
      const profile = profilesById.get(tag.tag_value);
      const personKey = profile ? profile.id : `name:${tag.tag_value.trim().toLowerCase()}`;
      const photoSet = photosByPerson.get(personKey) ?? new Set<string>();
      photoSet.add(tag.photo_id);
      photosByPerson.set(personKey, photoSet);
      return {
        ...tag,
        person_id: personKey,
        tag_value: profile ? getPersonDisplayName(profile, tag.tag_value) : tag.tag_value,
      };
    });

    const people: TaggedPerson[] = Array.from(photosByPerson.entries())
      .map(([key, photoIds]) => {
        const profile = profilesById.get(key);
        const legacyName = key.startsWith('name:')
          ? resolvedTags.find((tag) => tag.tag_type === 'person' && 'person_id' in tag && tag.person_id === key)?.tag_value
          : null;
        return {
          id: key,
          name: profile ? getPersonDisplayName(profile, key) : legacyName || 'Unknown',
          avatar_url: profile?.avatar_url ?? null,
          avatar_framing: profile?.avatar_framing ?? null,
          photo_count: photoIds.size,
        };
      })
      .sort((a, b) => b.photo_count - a.photo_count || a.name.localeCompare(b.name));

    return NextResponse.json({ tags: resolvedTags, people });
  } catch (error) {
    console.error('GET /api/trips/[id]/photos/tags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
