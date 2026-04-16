'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { DollarSign } from 'lucide-react';

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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="w-8 h-8 text-brand-tan" />
        <div>
          <h1 className="text-3xl font-bold text-brand-cream">Financial Manager</h1>
          <p className="text-brand-cream/50 text-sm">Select a trip to open the full financial planner and payments workspace</p>
        </div>
      </div>

      <div className="bg-brand-dark-grey border border-brand-tan/20 rounded-xl p-6 space-y-4">
        <label className="block text-sm font-semibold text-brand-cream">Trip</label>
        <select
          value={selectedTrip}
          onChange={(e) => setSelectedTrip(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3 bg-brand-black border border-brand-tan/30 rounded-lg text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-tan disabled:opacity-50"
        >
          <option value="">{loading ? 'Loading trips…' : '-- Choose a trip --'}</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{trip.name}</option>
          ))}
        </select>
        <button
          disabled={!canOpen}
          onClick={() => router.push(`/admin/trips/${selectedTrip}/budget`)}
          className="bg-brand-tan hover:bg-brand-tan/90 text-brand-black font-semibold py-2.5 px-5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Open Financial Manager
        </button>
      </div>
    </div>
  );
}
