'use client';

import { cn } from '@/lib/utils';
import type { TripTypeFilterValue } from '@/lib/trip-type';

interface TripTypeFilterProps {
  value: TripTypeFilterValue;
  onChange: (value: TripTypeFilterValue) => void;
  counts?: { all: number; trip: number; tweener: number };
  className?: string;
}

const OPTIONS: { value: TripTypeFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'trip', label: 'Official Trips' },
  { value: 'tweener', label: 'Tweeners' },
];

/** Pill toggle for filtering lists by official trips vs tweeners. */
export function TripTypeFilter({ value, onChange, counts, className }: TripTypeFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by trip type"
      className={cn('inline-flex flex-wrap items-center gap-1 rounded-full border border-brand-brown/20 bg-brand-dark-grey/60 p-1', className)}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        const count = counts?.[opt.value];
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? opt.value === 'tweener'
                  ? 'bg-brand-tan text-brand-black'
                  : 'bg-brand-brown text-brand-black'
                : 'text-brand-cream/70 hover:text-brand-cream'
            )}
          >
            {opt.label}
            {count !== undefined && <span className={cn('ml-1.5', active ? 'opacity-70' : 'opacity-50')}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
