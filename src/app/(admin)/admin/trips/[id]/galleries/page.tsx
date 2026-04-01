import { redirect } from 'next/navigation';

export default async function TripGalleriesRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/galleries?tripId=${id}`);
}
