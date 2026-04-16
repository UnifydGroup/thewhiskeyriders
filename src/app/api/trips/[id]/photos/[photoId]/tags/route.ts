import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type Role = 'super_admin' | 'admin' | 'trip_admin' | 'member';
type TagType = 'trip' | 'year' | 'location' | 'person';

const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];
const ALLOWED_TAG_TYPES: TagType[] = ['trip', 'year', 'location', 'person'];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TripMemberProfile {
  id: string;
  nickname: string | null;
  full_name: string | null;
}

interface TripMemberRow {
  profiles: TripMemberProfile | TripMemberProfile[] | null;
}

interface PhotoRecord {
  id: string;
  trip_id: string;
  uploaded_by: string;
}

interface PhotoTagRow {
  id: string;
  photo_id: string;
  tag_type: TagType;
  tag_value: string;
}

function trimToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getDisplayName(profile: Pick<TripMemberProfile, 'nickname' | 'full_name'>, fallback: string) {
  return trimToNull(profile.nickname) ?? trimToNull(profile.full_name) ?? fallback;
}

function getProfileFromRow(row: TripMemberRow): TripMemberProfile | null {
  const profileValue = row.profiles;
  if (!profileValue) {
    return null;
  }

  return Array.isArray(profileValue) ? (profileValue[0] ?? null) : profileValue;
}

async function getUserAndRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, role: null as Role | null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return {
    user,
    role: (profile?.role as Role | undefined) ?? null,
  };
}

async function isTripMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tripId: string
) {
  const { data: member, error } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return false;
  }

  return Boolean(member);
}

async function canAccessTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: Role | null,
  tripId: string
) {
  if (role && ADMIN_ROLES.includes(role)) {
    return true;
  }

  return isTripMember(supabase, userId, tripId);
}

function canEditPhoto(role: Role | null, userId: string, uploadedBy: string) {
  if (role && ADMIN_ROLES.includes(role)) {
    return true;
  }

  return userId === uploadedBy;
}

async function getPhotoForTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  photoId: string
) {
  const { data: photo, error } = await supabase
    .from('photos')
    .select('id, trip_id, uploaded_by')
    .eq('id', photoId)
    .single();

  if (error || !photo || photo.trip_id !== tripId) {
    return null;
  }

  return photo as PhotoRecord;
}

async function resolvePersonTagForTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  rawTagValue: string
) {
  const { data, error } = await supabase
    .from('trip_members')
    .select('profiles:user_id(id, nickname, full_name)')
    .eq('trip_id', tripId);

  if (error) {
    throw new Error(error.message);
  }

  const byId = new Map<string, TripMemberProfile>();
  const byNickname = new Map<string, TripMemberProfile>();

  ((data ?? []) as TripMemberRow[]).forEach((row) => {
    const profile = getProfileFromRow(row);
    if (!profile || !profile.id) {
      return;
    }

    byId.set(profile.id, profile);

    const nickname = trimToNull(profile.nickname);
    if (nickname) {
      byNickname.set(normalize(nickname), profile);
    }
  });

  const trimmed = rawTagValue.trim();
  const exactById = byId.get(trimmed);
  if (exactById) {
    return {
      personId: exactById.id,
      displayName: getDisplayName(exactById, trimmed),
    };
  }

  const byNick = byNickname.get(normalize(trimmed));
  if (byNick) {
    return {
      personId: byNick.id,
      displayName: getDisplayName(byNick, trimmed),
    };
  }

  return null;
}

async function mapPersonTagDisplayValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tags: PhotoTagRow[]
) {
  const personIds = Array.from(
    new Set(
      tags
        .filter((tag) => tag.tag_type === 'person' && isUuid(tag.tag_value))
        .map((tag) => tag.tag_value)
    )
  );

  if (personIds.length === 0) {
    return tags;
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nickname, full_name')
    .in('id', personIds);

  const profilesById = new Map<string, TripMemberProfile>();
  (profiles ?? []).forEach((profile) => {
    if (profile.id) {
      profilesById.set(profile.id, profile as TripMemberProfile);
    }
  });

  return tags.map((tag) => {
    if (tag.tag_type !== 'person') {
      return tag;
    }

    const profile = profilesById.get(tag.tag_value);
    if (!profile) {
      return tag;
    }

    return {
      ...tag,
      person_id: tag.tag_value,
      tag_value: getDisplayName(profile, tag.tag_value),
    };
  });
}

/**
 * GET /api/trips/[id]/photos/[photoId]/tags
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id: tripId, photoId } = await context.params;
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const photo = await getPhotoForTrip(supabase, tripId, photoId);
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const hasAccess = await canAccessTrip(supabase, user.id, role, tripId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: tags, error: tagsError } = await supabase
      .from('photo_tags')
      .select('id, photo_id, tag_type, tag_value')
      .eq('photo_id', photoId)
      .order('id', { ascending: true });

    if (tagsError) {
      return NextResponse.json({ error: tagsError.message }, { status: 500 });
    }

    const mappedTags = await mapPersonTagDisplayValues(
      supabase,
      ((tags ?? []) as PhotoTagRow[]).filter((tag) =>
        ALLOWED_TAG_TYPES.includes(tag.tag_type as TagType)
      )
    );

    return NextResponse.json(mappedTags);
  } catch (error) {
    console.error('GET /api/trips/[id]/photos/[photoId]/tags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/trips/[id]/photos/[photoId]/tags
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id: tripId, photoId } = await context.params;
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const photo = await getPhotoForTrip(supabase, tripId, photoId);
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const hasAccess = await canAccessTrip(supabase, user.id, role, tripId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!canEditPhoto(role, user.id, photo.uploaded_by)) {
      return NextResponse.json({ error: 'You can only tag your own photos' }, { status: 403 });
    }

    const body = await request.json();
    const tagType = typeof body?.tag_type === 'string' ? (body.tag_type as TagType) : null;
    const rawTagValue = typeof body?.tag_value === 'string' ? body.tag_value.trim() : '';

    if (!tagType || !ALLOWED_TAG_TYPES.includes(tagType)) {
      return NextResponse.json({ error: 'Invalid tag type' }, { status: 400 });
    }

    if (!rawTagValue) {
      return NextResponse.json({ error: 'Tag value is required' }, { status: 400 });
    }

    let storedTagValue = rawTagValue;
    let displayTagValue = rawTagValue;

    if (tagType === 'person') {
      const resolved = await resolvePersonTagForTrip(supabase, tripId, rawTagValue);
      if (!resolved) {
        return NextResponse.json(
          { error: 'Please select a valid nickname from this trip.' },
          { status: 400 }
        );
      }

      storedTagValue = resolved.personId;
      displayTagValue = resolved.displayName;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('photo_tags')
      .select('id')
      .eq('photo_id', photoId)
      .eq('tag_type', tagType)
      .eq('tag_value', storedTagValue)
      .limit(1);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingRows && existingRows.length > 0) {
      return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('photo_tags')
      .insert({
        photo_id: photoId,
        tag_type: tagType,
        tag_value: storedTagValue,
      })
      .select('id, photo_id, tag_type, tag_value')
      .single();

    if (insertError || !inserted) {
      if (insertError?.code === '23505') {
        return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
      }

      return NextResponse.json({ error: insertError?.message || 'Failed to add tag' }, { status: 500 });
    }

    if (tagType === 'person') {
      return NextResponse.json({
        ...inserted,
        person_id: storedTagValue,
        tag_value: displayTagValue,
      });
    }

    return NextResponse.json(inserted);
  } catch (error) {
    console.error('POST /api/trips/[id]/photos/[photoId]/tags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/trips/[id]/photos/[photoId]/tags?tagId=...
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id: tripId, photoId } = await context.params;
    const supabase = await createClient();

    const { user, role } = await getUserAndRole(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const photo = await getPhotoForTrip(supabase, tripId, photoId);
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const hasAccess = await canAccessTrip(supabase, user.id, role, tripId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!canEditPhoto(role, user.id, photo.uploaded_by)) {
      return NextResponse.json({ error: 'You can only edit tags on your own photos' }, { status: 403 });
    }

    const tagId = request.nextUrl.searchParams.get('tagId')?.trim();
    if (!tagId) {
      return NextResponse.json({ error: 'Missing tagId' }, { status: 400 });
    }

    const { data: existingTag, error: tagError } = await supabase
      .from('photo_tags')
      .select('id')
      .eq('id', tagId)
      .eq('photo_id', photoId)
      .single();

    if (tagError || !existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase.from('photo_tags').delete().eq('id', tagId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/trips/[id]/photos/[photoId]/tags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
