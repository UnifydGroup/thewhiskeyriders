'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatDateShort } from '@/lib/utils';
import Link from 'next/link';
import { Edit2, Trash2, Plus } from 'lucide-react';
import type { Trip } from '@/lib/types/database';

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-cream mb-2">Manage Trips</h1>
          <p className="text-brand-cream/70">Create and manage motorcycle adventures</p>
        </div>
        <Link href="/admin/trips/new">
          <Button variant="primary" size="md" className="gap-2">
            <Plus className="w-5 h-5" />
            New Trip
          </Button>
        </Link>
      </div>

      {/* Trips Table */}
      {trips.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-brown/20">
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Name</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Destination</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Dates</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Status</th>
                    <th className="text-left py-3 px-4 text-brand-cream font-semibold">Members</th>
                    <th className="text-right py-3 px-4 text-brand-cream font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => (
                    <tr key={trip.id} className="border-b border-brand-brown/10 hover:bg-brand-dark-grey/50 transition-colors">
                      <td className="py-3 px-4 text-brand-cream font-medium">{trip.name}</td>
                      <td className="py-3 px-4 text-brand-cream/70">{trip.destination}</td>
                      <td className="py-3 px-4 text-brand-cream/70 text-xs">
                        {formatDateShort(trip.start_date)} - {formatDateShort(trip.end_date)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={trip.status === 'upcoming' ? 'primary' : 'secondary'}>
                          {trip.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-brand-cream/70">{trip.max_members || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/trips/${trip.slug}`}>
                            <button className="p-2 hover:bg-brand-brown/20 rounded transition-colors">
                              <Edit2 className="w-4 h-4 text-brand-brown" />
                            </button>
                          </Link>
                          <button
                            onClick={() => handleDelete(trip.id)}
                            className="p-2 hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">No trips yet</p>
            <Link href="/admin/trips/new">
              <Button variant="primary">Create First Trip</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
