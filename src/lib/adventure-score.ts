export type AdventureScoreInput = {
  completedTrips: number;
  badgeCount: number;
  uniqueCountries: number;
};

export const ADVENTURE_SCORE_WEIGHTS = {
  completedTrip: 12,
  badge: 7,
  country: 5,
} as const;

export const ADVENTURE_SCORE_EXPLANATION =
  'Adventure score = 12 points per completed trip + 7 points per badge + 5 points per unique country.';

export function calculateAdventureScore(input: AdventureScoreInput): number {
  const safeCompletedTrips = Math.max(0, input.completedTrips || 0);
  const safeBadgeCount = Math.max(0, input.badgeCount || 0);
  const safeUniqueCountries = Math.max(0, input.uniqueCountries || 0);

  return (
    safeCompletedTrips * ADVENTURE_SCORE_WEIGHTS.completedTrip +
    safeBadgeCount * ADVENTURE_SCORE_WEIGHTS.badge +
    safeUniqueCountries * ADVENTURE_SCORE_WEIGHTS.country
  );
}
