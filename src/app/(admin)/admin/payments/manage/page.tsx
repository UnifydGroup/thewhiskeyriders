import { redirect } from 'next/navigation';

type SearchParams = {
  trip_id?: string | string[];
  tripId?: string | string[];
};

export default function ManagePaymentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const rawTripId = searchParams?.trip_id ?? searchParams?.tripId;
  const tripId = Array.isArray(rawTripId) ? rawTripId[0] : rawTripId;

  if (tripId) {
    redirect(`/admin/financial-manager?trip_id=${encodeURIComponent(tripId)}`);
  }

  redirect('/admin/financial-manager');
}
