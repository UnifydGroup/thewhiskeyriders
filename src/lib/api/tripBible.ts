import { supabase } from '@/lib/api/helpers';
import { resolveReceiptAccessUrl } from '@/lib/api/receiptStorage';

const MISSING_BUCKET_SEGMENT = '/storage/v1/object/public/documents/';
const WORKING_BUCKET_SEGMENT = '/storage/v1/object/public/photos/';
const DOCUMENT_STORAGE_BUCKETS = ['photos', 'whiskey-riders', 'documents'];

function normalizeDocumentUrl(fileUrl: string): string {
  if (fileUrl.includes(MISSING_BUCKET_SEGMENT)) {
    return fileUrl.replace(MISSING_BUCKET_SEGMENT, WORKING_BUCKET_SEGMENT);
  }
  return fileUrl;
}

function extractStorageReference(fileUrl: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(fileUrl);
    const markers = ['/storage/v1/object/public/', '/storage/v1/object/sign/', '/storage/v1/object/authenticated/'];
    for (const marker of markers) {
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex === -1) continue;
      const suffix = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
      const slashIndex = suffix.indexOf('/');
      if (slashIndex <= 0) continue;
      const bucket = suffix.slice(0, slashIndex).trim();
      const path = suffix.slice(slashIndex + 1).trim().replace(/^\/+/, '');
      if (bucket && path) return { bucket, path };
    }
  } catch {
    return null;
  }
  return null;
}

async function resolveDocumentAccessUrl(fileUrl: string): Promise<string> {
  const normalized = normalizeDocumentUrl(fileUrl);
  const reference = extractStorageReference(normalized);
  if (!reference) return normalized;

  const buckets = [...new Set([reference.bucket, ...DOCUMENT_STORAGE_BUCKETS])];
  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(reference.path, 60 * 60);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return normalized;
}

export async function getTripBibleData(tripId: string, isAdmin: boolean, userId: string) {
  const { data: trip, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).single();
  if (tripError || !trip) throw new Error('Trip not found');

  let itineraryQuery = supabase
    .from('trip_itinerary_segments')
    .select('*')
    .eq('trip_id', tripId)
    .order('date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (!isAdmin) itineraryQuery = itineraryQuery.eq('member_visible', true);

  let contactsQuery = supabase
    .from('trip_contacts')
    .select('*')
    .eq('trip_id', tripId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });
  if (!isAdmin) contactsQuery = contactsQuery.eq('member_visible', true);

  let documentsQuery = supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });
  if (!isAdmin) documentsQuery = documentsQuery.or(`user_id.is.null,user_id.eq.${userId}`);

  const membersQuery = supabase
    .from('trip_members')
    .select(
      `
      trip_role,
      profiles:user_id (id, first_name, surname, full_name, nickname, email, phone, phone_country_code, avatar_url)
    `
    )
    .eq('trip_id', tripId);

  const [
    { data: itinerary, error: itineraryError },
    { data: contacts, error: contactsError },
    { data: documents, error: documentsError },
    { data: memberRows, error: membersError },
  ] = await Promise.all([itineraryQuery, contactsQuery, documentsQuery, membersQuery]);

  if (itineraryError) throw itineraryError;
  if (contactsError) throw contactsError;
  if (documentsError) throw documentsError;
  if (membersError) throw membersError;

  const memberFields = (trip.bible_member_fields ?? {}) as Record<string, boolean>;

  const members = (memberRows ?? [])
    .map((row) => row.profiles)
    .filter((profile): profile is NonNullable<typeof profile> => !!profile)
    .map((profile) => {
      const base = {
        id: profile.id,
        display_name: profile.nickname?.trim() || profile.full_name?.trim() || 'Unknown',
        avatar_url: profile.avatar_url,
      };
      if (isAdmin) {
        return {
          ...base,
          first_name: profile.first_name,
          surname: profile.surname,
          email: profile.email,
          phone: profile.phone_country_code && profile.phone ? `${profile.phone_country_code} ${profile.phone}` : profile.phone,
        };
      }
      return {
        ...base,
        first_name: memberFields.first_name ? profile.first_name : undefined,
        surname: memberFields.surname ? profile.surname : undefined,
        email: memberFields.email ? profile.email : undefined,
        phone: memberFields.phone
          ? (profile.phone_country_code && profile.phone ? `${profile.phone_country_code} ${profile.phone}` : profile.phone)
          : undefined,
      };
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const documentsWithAccessUrls = await Promise.all(
    (documents ?? []).map(async (document) => ({
      ...document,
      file_url: normalizeDocumentUrl(document.file_url),
      access_url: await resolveDocumentAccessUrl(document.file_url),
    }))
  );

  type ExpenseReceiptRow = {
    id: string;
    file_name: string;
    file_type: string;
    file_url: string;
    access_url?: string;
  };

  let expenseReceipts: Array<{
    id: string;
    description: string;
    expense_date: string;
    amount_aud: number;
    receipts: ExpenseReceiptRow[];
  }> = [];

  if (isAdmin) {
    const { data: expenses, error: expensesError } = await supabase
      .from('trip_expenses')
      .select('id, description, expense_date, amount_aud, receipts:trip_expense_receipts(*)')
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false });
    if (expensesError) throw expensesError;

    expenseReceipts = await Promise.all(
      (expenses ?? [])
        .filter((expense) => (expense.receipts?.length ?? 0) > 0)
        .map(async (expense) => ({
          ...expense,
          receipts: await Promise.all(
            (expense.receipts ?? []).map(async (receipt: ExpenseReceiptRow) => ({
              ...receipt,
              access_url: await resolveReceiptAccessUrl(receipt.file_url),
            }))
          ),
        }))
    );
  }

  return {
    trip,
    isAdmin,
    itinerary: itinerary ?? [],
    contacts: contacts ?? [],
    documents: documentsWithAccessUrls,
    expenseReceipts,
    members,
    memberFields,
  };
}

export type TripBibleData = Awaited<ReturnType<typeof getTripBibleData>>;
