'use client';

import { cn } from '@/lib/utils';
import type { TripType } from '@/lib/types/database';
import { TRIP_TYPES, TRIP_TYPE_DESCRIPTIONS, TRIP_TYPE_LABELS } from '@/lib/trip-type';

interface TripTypePickerProps {
  value: TripType;
  onChange: (value: TripType) => void;
  disabled?: boolean;
  name?: string;
}

/** Card-style choice between an official trip and a tweener, used in the trip builder. */
export function TripTypePicker({ value, onChange, disabled, name = 'trip_type' }: TripTypePickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Trip type">
      {TRIP_TYPES.map((type) => {
        const active = value === type;
        const tweener = type === 'tweener';
        return (
          <label
            key={type}
            className={cn(
              'relative flex cursor-pointer flex-col gap-1 rounded-lg p-4 transition-colors',
              tweener ? 'border-2 border-dashed' : 'border-2',
              active
                ? tweener
                  ? 'border-brand-tan bg-brand-tan/10'
                  : 'border-brand-brown bg-brand-brown/10'
                : 'border-brand-brown/20 hover:border-brand-brown/50',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <input
              type="radio"
              name={name}
              value={type}
              checked={active}
              onChange={() => onChange(type)}
              disabled={disabled}
              className="sr-only"
            />
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border-2',
                  active ? (tweener ? 'border-brand-tan' : 'border-brand-brown') : 'border-brand-cream/30'
                )}
              >
                {active && <span className={cn('h-2 w-2 rounded-full', tweener ? 'bg-brand-tan' : 'bg-brand-brown')} />}
              </span>
              <span className={cn('font-semibold', active ? (tweener ? 'text-brand-tan' : 'text-brand-brown') : 'text-brand-cream')}>
                {TRIP_TYPE_LABELS[type]}
              </span>
            </span>
            <span className="pl-6 text-xs text-brand-cream/60">{TRIP_TYPE_DESCRIPTIONS[type]}</span>
          </label>
        );
      })}
    </div>
  );
}
