'use client';

import { useEffect, useState } from 'react';
import { getCountdownParts } from '@/lib/trip-countdown';

const UNITS = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Mins' },
  { key: 'seconds', label: 'Secs' },
] as const;

export default function TripCountdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMs = target.getTime() - now;

  if (remainingMs <= 0) {
    return (
      <p className="rounded-lg border border-brand-brown/30 bg-brand-black/50 px-4 py-3 text-center text-lg font-semibold text-brand-cream">
        Wheels are rolling. Ride safe!
      </p>
    );
  }

  const parts = getCountdownParts(remainingMs);

  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label="Time until departure">
      {UNITS.map(({ key, label }) => (
        <div
          key={key}
          className="rounded-lg border border-brand-brown/30 bg-brand-dark-grey/90 px-1 py-2.5 text-center"
        >
          <p className="text-3xl font-extrabold leading-none text-brand-cream tabular-nums sm:text-4xl">
            {key === 'days' ? parts[key] : String(parts[key]).padStart(2, '0')}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-cream/60 sm:text-[11px]">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
