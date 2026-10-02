/** A member (or legacy name tag) tagged in photos, with how many photos they're in. */
export interface TaggedPerson {
  /** Profile id, or `name:<lowercased name>` for old tags that stored a name */
  id: string;
  name: string;
  avatar_url: string | null;
  avatar_framing: unknown;
  photo_count: number;
}

const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProfileId(value: string): boolean {
  return PROFILE_ID_PATTERN.test(value.trim());
}

export function getPersonDisplayName(
  profile: { nickname: string | null; full_name: string | null },
  fallback: string
): string {
  return profile.nickname?.trim() || profile.full_name?.trim() || fallback;
}

/** Read `?person=a,b` from a URL search string into a list of person ids. */
export function parsePersonParam(value: string | null): string[] {
  return (value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
