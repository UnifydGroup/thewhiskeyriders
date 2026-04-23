import { redirect } from 'next/navigation';

/**
 * The /trips/[slug]/payments route is not used directly.
 * Payment information is displayed in the Payments tab of the trip detail page.
 * Redirect to the trip overview which includes the payments tab.
 */
export default function PaymentsRedirectPage({ params }: { params: { slug: string } }) {
  redirect(`/trips/${params.slug}#payments`);
}
