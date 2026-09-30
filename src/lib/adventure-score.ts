export type AdventureScoreInput = {
  completedTrips: number;
  /** Completed tweeners (shorter in-between rides). Worth half an official trip. */
  completedTweeners?: number;
  badgeCount: number;
  uniqueCountries: number;
};

export const ADVENTURE_SCORE_WEIGHTS = {
  completedTrip: 12,
  completedTweener: 6,
  badge: 7,
  country: 5,
} as const;

export const ADVENTURE_SCORE_EXPLANATION =
  'Adventure score = 12 points per completed trip + 6 points per completed tweener + 7 points per badge + 5 points per unique country.';

export function calculateAdventureScore(input: AdventureScoreInput): number {
  const safeCompletedTrips = Math.max(0, input.completedTrips || 0);
  const safeCompletedTweeners = Math.max(0, input.completedTweeners || 0);
  const safeBadgeCount = Math.max(0, input.badgeCount || 0);
  const safeUniqueCountries = Math.max(0, input.uniqueCountries || 0);

  return (
    safeCompletedTrips * ADVENTURE_SCORE_WEIGHTS.completedTrip +
    safeCompletedTweeners * ADVENTURE_SCORE_WEIGHTS.completedTweener +
    safeBadgeCount * ADVENTURE_SCORE_WEIGHTS.badge +
    safeUniqueCountries * ADVENTURE_SCORE_WEIGHTS.country
  );
}
