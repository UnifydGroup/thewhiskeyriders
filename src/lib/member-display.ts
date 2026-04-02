/**
 * Utility functions for displaying member names with nickname support
 */

interface MemberProfile {
  full_name: string | null;
  nickname?: string | null;
}

/**
 * Get display name for a member
 * Returns nickname if available, otherwise full_name.
 * Full names should only be used when nickname is missing.
 */
export function getMemberDisplayName(
  member: MemberProfile | null | undefined,
  format: 'nickname-only' | 'nickname-with-name' | 'smart' = 'smart'
): string {
  if (!member) return 'Unknown';

  const nickname = member.nickname?.trim();
  const fullName = member.full_name?.trim();

  if (format === 'nickname-only') {
    return nickname || fullName || 'Unknown';
  }

  if (format === 'nickname-with-name') {
    if (nickname && fullName) {
      return `${nickname} (${fullName})`;
    }
    return nickname || fullName || 'Unknown';
  }

  // Smart format defaults to nickname-only for on-site display.
  return nickname || fullName || 'Unknown';
}

/**
 * Get name for lists/dropdowns
 * Defaults to nickname, falls back to full name when nickname is missing
 */
export function getMemberListName(member: MemberProfile | null | undefined): string {
  if (!member) return 'Unknown';

  const nickname = member.nickname?.trim();
  const fullName = member.full_name?.trim();

  return nickname || fullName || 'Unknown';
}

/**
 * Get short name for display in tight spaces
 * Returns just the nickname if available, otherwise first name from full_name
 */
export function getMemberShortName(member: MemberProfile | null | undefined): string {
  if (!member) return 'Unknown';

  const nickname = member.nickname?.trim();
  if (nickname) {
    return nickname;
  }

  const fullName = member.full_name?.trim();
  if (fullName) {
    // Extract first name (before first space)
    const firstName = fullName.split(' ')[0];
    return firstName || fullName;
  }

  return 'Unknown';
}
