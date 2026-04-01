import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

export function PageHeader() {
  return (
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
  );
}
