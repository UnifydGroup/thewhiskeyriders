import { cn } from '@/lib/utils';
import { isTweener } from '@/lib/trip-type';

interface TripTypeBadgeProps {
  trip: { trip_type?: string | null } | null | undefined;
  /** Also render a badge for official trips (hidden by default so only tweeners stand out). */
  showOfficial?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * Calls out tweeners (shorter in-between rides) across the portal.
 * Official trips render nothing unless `showOfficial` is set.
 */
export function TripTypeBadge({ trip, showOfficial = false, size = 'xs', className }: TripTypeBadgeProps) {
  const tweener = isTweener(trip);
  if (!tweener && !showOfficial) return null;

  const sizing = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      title={tweener ? 'Tweener — a shorter in-between ride with a smaller crew' : 'Official Whiskey Riders trip'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider whitespace-nowrap',
        sizing,
        tweener
          ? 'border border-dashed border-brand-tan text-brand-tan bg-brand-tan/10'
          : 'border border-brand-brown/60 text-brand-brown bg-brand-brown/10',
        className
      )}
    >
      <span
        aria-hidden
        className={cn('inline-block rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-1 w-1', tweener ? 'bg-brand-tan' : 'bg-brand-brown')}
      />
      {tweener ? 'Tweener' : 'Official Trip'}
    </span>
  );
}
