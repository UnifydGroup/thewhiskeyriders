import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

export function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-brand-cream mb-2">Manage Trips</h1>
        <p className="text-brand-cream/70">Create and manage official trips and tweeners</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/trips/new?type=tweener">
          <Button variant="secondary" size="md" className="gap-2">
            <Plus className="w-5 h-5" />
            New Tweener
          </Button>
        </Link>
        <Link href="/admin/trips/new">
          <Button variant="primary" size="md" className="gap-2">
            <Plus className="w-5 h-5" />
            New Trip
          </Button>
        </Link>
      </div>
    </div>
  );
}
