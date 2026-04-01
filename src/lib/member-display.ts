/**
 * Utility functions for displaying member names with nickname support
 */

interface MemberProfile {
  full_name: string | null;
  nickname?: string | null;
}

/**
 * Get display name for a member
 * Returns nickname if available, otherwise full_name
 * Format: "Nickname (Full Name)" or just "Nickname"
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

  // Smart format: use nickname if available, but fall back to full name
  if (nickname) {
    return nickname;
  }
  return fullName || 'Unknown';
}

/**
 * Get name for lists/dropdowns
 * Returns "Nickname - Full Name" format for clarity
 */
export function getMemberListName(member: MemberProfile | null | undefined): string {
  if (!member) return 'Unknown';

  const nickname = member.nickname?.trim();
  const fullName = member.full_name?.trim();

  if (nickname && fullName && nickname !== fullName) {
    return `${nickname} - ${fullName}`;
  }

  return fullName || nickname || 'Unknown';
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
