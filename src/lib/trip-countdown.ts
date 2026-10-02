import type { Trip } from '@/lib/types/database';

/** The moment a trip's countdown runs to: `countdown_target_at` if set, else midnight on `start_date`. */
export function getCountdownTargetDate(trip: Pick<Trip, 'start_date' | 'countdown_target_at'>): Date | null {
  if (trip.countdown_target_at) {
    const explicitDate = new Date(trip.countdown_target_at);
    if (!Number.isNaN(explicitDate.getTime())) {
      return explicitDate;
    }
  }

  const fallbackDate = new Date(`${trip.start_date}T00:00:00`);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

export function getCountdownParts(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}
