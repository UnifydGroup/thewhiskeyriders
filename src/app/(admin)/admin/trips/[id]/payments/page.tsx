import { redirect } from 'next/navigation';

type Params = {
  params: {
    id: string;
  };
};

export default function TripPaymentsRedirectPage({ params }: Params) {
  redirect(`/admin/financial-manager?trip_id=${encodeURIComponent(params.id)}`);
}
