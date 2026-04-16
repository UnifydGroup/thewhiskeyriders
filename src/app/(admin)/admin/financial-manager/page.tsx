'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, DollarSign, FolderOpen } from 'lucide-react';

interface Trip {
  id: string;
  name: string;
  start_date: string | null;
}

export default function FinancialManagerLandingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripFromQuery = params.get('trip_id') || params.get('tripId') || '';
    if (tripFromQuery) {
      router.replace(`/admin/trips/${tripFromQuery}/budget`);
      return;
    }

    const loadTrips = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('trips')
          .select('id, name, start_date');
        const sorted = (data ?? []).sort((a, b) => {
          const aTime = a.start_date ? new Date(a.start_date).getTime() : 0;
          const bTime = b.start_date ? new Date(b.start_date).getTime() : 0;
          return bTime - aTime;
        });
        setTrips(sorted);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, [router, supabase]);

  const canOpen = useMemo(() => selectedTrip.length > 0, [selectedTrip]);
  const today = useMemo(() => new Date(), []);
  const upcomingTrips = useMemo(
    () => trips.filter((trip) => trip.start_date && new Date(trip.start_date) >= today).length,
    [today, trips]
  );
  const selectedTripMeta = useMemo(
    () => trips.find((trip) => trip.id === selectedTrip) ?? null,
    [selectedTrip, trips]
  );

  const fmtDate = (date: string | null) => (
    date
      ? new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Date TBD'
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-2xl border border-brand-tan/25 bg-gradient-to-r from-brand-dark-grey via-brand-dark-grey to-brand-black p-6 md:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-tan/30 bg-brand-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-tan">
              <DollarSign className="h-3.5 w-3.5" />
              Financial Manager
            </div>
            <div>
              <h1 className="text-3xl font-bold text-brand-cream md:text-4xl">Trip Finance Workspace</h1>
              <p className="mt-1 text-sm text-brand-cream/60">
                Open a trip to manage budgets, categories, expenses, member contributions, and reconciliations in one flow.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs md:min-w-[260px]">
            <div className="rounded-lg border border-brand-tan/20 bg-brand-black/35 px-3 py-2">
              <p className="text-brand-cream/50 uppercase tracking-wide">Trips</p>
              <p className="mt-0.5 text-lg font-semibold text-brand-cream">{trips.length}</p>
            </div>
            <div className="rounded-lg border border-brand-tan/20 bg-brand-black/35 px-3 py-2">
              <p className="text-brand-cream/50 uppercase tracking-wide">Upcoming</p>
              <p className="mt-0.5 text-lg font-semibold text-brand-cream">{upcomingTrips}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey p-6 space-y-4">
          <label className="block text-sm font-semibold text-brand-cream">Choose Trip</label>
          <select
            value={selectedTrip}
            onChange={(e) => setSelectedTrip(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-brand-tan/30 bg-brand-black px-4 py-3 text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan disabled:opacity-50"
          >
            <option value="">{loading ? 'Loading trips…' : '-- Select trip --'}</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.name}</option>
            ))}
          </select>

          <div className="rounded-lg border border-brand-tan/15 bg-brand-black/35 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-brand-cream/50">Selected Trip</p>
            <p className="mt-0.5 text-base font-semibold text-brand-cream">
              {selectedTripMeta?.name ?? 'No trip selected'}
            </p>
            <p className="text-xs text-brand-cream/50">{fmtDate(selectedTripMeta?.start_date ?? null)}</p>
          </div>

          <button
            disabled={!canOpen}
            onClick={() => router.push(`/admin/trips/${selectedTrip}/budget`)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-tan px-5 py-2.5 font-semibold text-brand-black transition-colors hover:bg-brand-tan/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open Financial Manager
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-brand-tan/20 bg-brand-dark-grey p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-cream/60">Quick Access</h2>
          {trips.slice(0, 4).map((trip) => (
            <button
              key={trip.id}
              onClick={() => router.push(`/admin/trips/${trip.id}/budget`)}
              className="mb-2 flex w-full items-center justify-between rounded-lg border border-brand-tan/15 bg-brand-black/35 px-3 py-2 text-left transition-colors hover:border-brand-tan/35 hover:bg-brand-black/60"
            >
              <span>
                <span className="block text-sm font-medium text-brand-cream">{trip.name}</span>
                <span className="text-xs text-brand-cream/50">{fmtDate(trip.start_date)}</span>
              </span>
              <FolderOpen className="h-4 w-4 text-brand-tan/70" />
            </button>
          ))}
          {!loading && trips.length === 0 && (
            <p className="text-sm text-brand-cream/50">No trips available.</p>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-brand-cream/45">
            <CalendarDays className="h-3.5 w-3.5" />
            Most recent trips are shown first
          </div>
        </div>
      </div>
    </div>
  );
}
