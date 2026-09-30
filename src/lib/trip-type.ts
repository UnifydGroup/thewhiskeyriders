import type { TripType } from '@/lib/types/database';

export const TRIP_TYPES: TripType[] = ['trip', 'tweener'];

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  trip: 'Official Trip',
  tweener: 'Tweener',
};

export const TRIP_TYPE_DESCRIPTIONS: Record<TripType, string> = {
  trip: 'A full Whiskey Riders trip.',
  tweener: 'A shorter in-between ride, usually with a smaller crew.',
};

export type TripTypeFilterValue = 'all' | TripType;

/** Normalise whatever is stored/returned into a valid TripType (default 'trip'). */
export function getTripType(trip: { trip_type?: string | null } | null | undefined): TripType {
  return trip?.trip_type === 'tweener' ? 'tweener' : 'trip';
}

export function isTweener(trip: { trip_type?: string | null } | null | undefined): boolean {
  return getTripType(trip) === 'tweener';
}

export function parseTripType(value: unknown): TripType | null {
  return value === 'trip' || value === 'tweener' ? value : null;
}

export function matchesTripTypeFilter(
  trip: { trip_type?: string | null } | null | undefined,
  filter: TripTypeFilterValue
): boolean {
  return filter === 'all' || getTripType(trip) === filter;
}

export function countByTripType<T extends { trip_type?: string | null }>(trips: T[]) {
  let trip = 0;
  let tweener = 0;
  for (const t of trips) {
    if (isTweener(t)) tweener++;
    else trip++;
  }
  return { trip, tweener, all: trip + tweener };
}
