import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function TripsEmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-brand-cream/70 mb-4">No trips yet</p>
        <Link href="/admin/trips/new">
          <Button variant="primary">Create First Trip</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
