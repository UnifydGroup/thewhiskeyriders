import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDateShort } from '@/lib/utils';
import type { Trip } from '@/lib/types/database';
import { TripsActions } from './TripsActions';

interface TripsTableProps {
  trips: Trip[];
  onDelete: (id: string) => void;
}

export function TripsTable({ trips, onDelete }: TripsTableProps) {
  return (
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
                <tr
                  key={trip.id}
                  className="border-b border-brand-brown/10 hover:bg-brand-dark-grey/50 transition-colors"
                >
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
                  <td className="py-3 px-4">
                    <TripsActions tripId={trip.id} onDelete={onDelete} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
