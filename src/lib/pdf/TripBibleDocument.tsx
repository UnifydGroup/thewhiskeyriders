import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { TripBibleData } from '@/lib/api/tripBible';

const COLORS = {
  ink: '#1a1a1a',
  muted: '#6b6b6b',
  accent: '#a6763b',
  border: '#dddddd',
  bg: '#f7f5f2',
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: COLORS.ink, fontFamily: 'Helvetica' },
  coverImage: { width: '100%', height: 220, objectFit: 'cover', borderRadius: 4, marginBottom: 18 },
  h1: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  h2: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 10, marginTop: 4, color: COLORS.accent },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: COLORS.accent, textTransform: 'uppercase' },
  meta: { fontSize: 11, color: COLORS.muted, marginBottom: 3 },
  description: { fontSize: 10, color: COLORS.ink, marginTop: 10, lineHeight: 1.5 },
  section: { marginBottom: 18 },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 10, marginBottom: 8, backgroundColor: COLORS.bg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  label: { fontSize: 9, color: COLORS.muted, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 9, color: COLORS.muted },
  pageNumber: { position: 'absolute', bottom: 20, right: 36, fontSize: 8, color: COLORS.muted },
  footerBrand: { position: 'absolute', bottom: 20, left: 36, fontSize: 8, color: COLORS.muted },
  divider: { borderBottomWidth: 1, borderBottomColor: COLORS.border, marginVertical: 10 },
  receiptThumb: { width: 90, height: 90, objectFit: 'cover', borderRadius: 4, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
});

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length <= 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate<T extends { date: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const arr = map.get(item.date) ?? [];
    arr.push(item);
    map.set(item.date, arr);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function Footer({ tripName }: { tripName: string }) {
  return (
    <>
      <Text style={styles.footerBrand} fixed>{tripName} · Trip Bible</Text>
      <Text
        style={styles.pageNumber}
        fixed
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`}
      />
    </>
  );
}

export default function TripBibleDocument({ data }: { data: TripBibleData }) {
  const { trip, itinerary, contacts, documents, expenseReceipts, isAdmin } = data;
  const itineraryByDate = groupByDate(itinerary as { date: string }[]);
  const contactsByCategory = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const arr = contactsByCategory.get(contact.category) ?? [];
    arr.push(contact);
    contactsByCategory.set(contact.category, arr);
  }

  return (
    <Document title={`${trip.name} — Trip Bible`}>
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        {trip.cover_image_url && <Image src={trip.cover_image_url} style={styles.coverImage} />}
        <Text style={styles.h1}>{trip.name}</Text>
        <Text style={styles.meta}>{trip.destination}, {trip.country}</Text>
        <Text style={styles.meta}>{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</Text>
        {trip.description && <Text style={styles.description}>{trip.description}</Text>}
        <View style={styles.divider} />
        <Text style={styles.small}>
          This Trip Bible contains {itinerary.length} itinerary segments, {contacts.length} key contacts, and{' '}
          {documents.length} documents{isAdmin ? `, plus ${expenseReceipts.length} expenses with receipts` : ''}.
        </Text>
        <Footer tripName={trip.name} />
      </Page>

      {/* Itinerary */}
      {itineraryByDate.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h2}>Itinerary</Text>
          {itineraryByDate.map(([date, segments]) => (
            <View key={date} style={styles.section} wrap={false}>
              <Text style={styles.h3}>{formatDate(date)}</Text>
              {segments.map((seg: any) => (
                <View key={seg.id} style={styles.card}>
                  <Text style={styles.label}>{seg.category}</Text>
                  <Text style={styles.title}>{seg.title}</Text>
                  {seg.location_from && seg.location_to && (
                    <Text style={styles.small}>{seg.location_from} → {seg.location_to}</Text>
                  )}
                  {seg.location_from && !seg.location_to && <Text style={styles.small}>{seg.location_from}</Text>}
                  {(seg.start_time || seg.end_time) && (
                    <Text style={styles.small}>
                      {seg.start_time?.slice(0, 5)}
                      {seg.start_time && seg.end_time ? ' – ' : ''}
                      {seg.end_time?.slice(0, 5)}
                    </Text>
                  )}
                  {seg.reference_number && <Text style={styles.small}>Ref: {seg.reference_number}</Text>}
                  {seg.member_description && <Text style={{ ...styles.small, marginTop: 4 }}>{seg.member_description}</Text>}
                  {isAdmin && seg.internal_notes && (
                    <Text style={{ ...styles.small, marginTop: 4, color: '#b45309' }}>Internal: {seg.internal_notes}</Text>
                  )}
                  {Array.isArray(seg.contacts) && seg.contacts.length > 0 && (
                    <View style={{ marginTop: 4 }}>
                      {seg.contacts.map((c: { name: string; role?: string; phone?: string }, i: number) => (
                        <Text key={i} style={styles.small}>
                          {c.name}{c.role ? ` · ${c.role}` : ''}{c.phone ? ` · ${c.phone}` : ''}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
          <Footer tripName={trip.name} />
        </Page>
      )}

      {/* Key Contacts */}
      {contacts.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h2}>Key Contacts</Text>
          {Array.from(contactsByCategory.entries()).map(([category, list]) => (
            <View key={category} style={styles.section}>
              <Text style={styles.h3}>{category}</Text>
              {list.map((contact) => (
                <View key={contact.id} style={styles.card}>
                  <Text style={styles.title}>{contact.name}</Text>
                  {contact.role && <Text style={styles.small}>{contact.role}</Text>}
                  <View style={styles.row}>
                    {contact.phone && <Text style={styles.small}>Phone: {contact.phone}</Text>}
                    {contact.email && <Text style={styles.small}>Email: {contact.email}</Text>}
                  </View>
                  {contact.notes && <Text style={{ ...styles.small, marginTop: 4 }}>{contact.notes}</Text>}
                </View>
              ))}
            </View>
          ))}
          <Footer tripName={trip.name} />
        </Page>
      )}

      {/* Documents index */}
      {documents.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h2}>Documents</Text>
          <Text style={{ ...styles.small, marginBottom: 10 }}>
            Open the trip portal to view or download these files.
          </Text>
          {documents.map((doc: any) => (
            <View key={doc.id} style={styles.card}>
              <Text style={styles.title}>{doc.name}</Text>
              <Text style={styles.small}>{doc.file_type || 'Unknown type'} · {formatDate(String(doc.created_at).slice(0, 10))}</Text>
            </View>
          ))}
          <Footer tripName={trip.name} />
        </Page>
      )}

      {/* Receipts — admin only */}
      {isAdmin && expenseReceipts.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h2}>Expense Receipts</Text>
          {expenseReceipts.map((expense) => (
            <View key={expense.id} style={styles.card} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.title}>{expense.description}</Text>
                <Text style={styles.title}>${Number(expense.amount_aud).toFixed(2)} AUD</Text>
              </View>
              <Text style={styles.small}>{formatDate(String(expense.expense_date).slice(0, 10))}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {expense.receipts.map((receipt) =>
                  receipt.file_type?.startsWith('image/') ? (
                    <Image key={receipt.id} src={receipt.access_url || receipt.file_url} style={styles.receiptThumb} />
                  ) : (
                    <Text key={receipt.id} style={{ ...styles.small, marginRight: 8 }}>{receipt.file_name}</Text>
                  )
                )}
              </View>
            </View>
          ))}
          <Footer tripName={trip.name} />
        </Page>
      )}
    </Document>
  );
}
