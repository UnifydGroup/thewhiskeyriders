'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';
import type { Trip } from '@/lib/types/database';
import { PageHeader } from './PageHeader';
import { TripsTable } from './TripsTable';
import { TripsEmptyState } from './TripsEmptyState';

export default function AdminTripsPage() {
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const { data } = await supabase
          .from('trips')
          .select('*')
          .order('start_date', { ascending: false });
        if (data) {
          setTrips(data);
        }
      } catch (err) {
        console.error('Failed to load trips:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTrips();
  }, [supabase]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this trip?')) return;
    try {
      await supabase.from('trips').delete().eq('id', id);
      setTrips(trips.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader />
      {trips.length > 0 ? <TripsTable trips={trips} onDelete={handleDelete} /> : <TripsEmptyState />}
    </div>
  );
}
