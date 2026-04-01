import Link from 'next/link';
import { Edit2, FileText, Trash2 } from 'lucide-react';

interface TripsActionsProps {
  tripId: string;
  onDelete: (id: string) => void;
}

export function TripsActions({ tripId, onDelete }: TripsActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={`/admin/trips/${tripId}/documents`}>
        <button
          aria-label="Manage documents"
          title="Manage documents"
          className="p-2 hover:bg-brand-brown/20 rounded transition-colors"
        >
          <FileText className="w-4 h-4 text-brand-brown" />
        </button>
      </Link>
      <Link href={`/admin/trips/${tripId}`}>
        <button
          aria-label="Edit trip"
          title="Edit trip"
          className="p-2 hover:bg-brand-brown/20 rounded transition-colors"
        >
          <Edit2 className="w-4 h-4 text-brand-brown" />
        </button>
      </Link>
      <button
        aria-label="Delete trip"
        title="Delete trip"
        onClick={() => onDelete(tripId)}
        className="p-2 hover:bg-red-900/20 rounded transition-colors"
      >
        <Trash2 className="w-4 h-4 text-red-600" />
      </button>
    </div>
  );
}
