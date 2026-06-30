'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Plane, Car, BedDouble, Compass, Phone, MapPin, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'flight' | 'transfer' | 'accommodation' | 'activity';

interface Contact {
  name: string;
  phone: string;
  role: string;
}

interface Segment {
  id: string;
  date: string;
  sort_order: number;
  category: Category;
  title: string;
  location_from: string | null;
  location_to: string | null;
  start_time: string | null;
  end_time: string | null;
  reference_number: string | null;
  status: string;
  contacts: Contact[];
  member_description: string | null;
  member_visible: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode; colour: string }> = {
  flight: {
    label: 'Flight',
    icon: <Plane size={16} />,
    colour: 'text-blue-400 bg-blue-900/20 border-blue-800/40',
  },
  transfer: {
    label: 'Transfer',
    icon: <Car size={16} />,
    colour: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40',
  },
  accommodation: {
    label: 'Accommodation',
    icon: <BedDouble size={16} />,
    colour: 'text-purple-400 bg-purple-900/20 border-purple-800/40',
  },
  activity: {
    label: 'Activity',
    icon: <Compass size={16} />,
    colour: 'text-green-400 bg-green-900/20 border-green-800/40',
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupByDate(segments: Segment[]): Map<string, Segment[]> {
  const map = new Map<string, Segment[]>();
  for (const seg of segments) {
    const arr = map.get(seg.date) ?? [];
    arr.push(seg);
    map.set(seg.date, arr);
  }
  return map;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemberItineraryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [tripId, setTripId] = useState<string | null>(null);
  const [tripName, setTripName] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired');
    return session.access_token;
  }, [supabase]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();

        // Resolve slug → trip id
        const tripRes = await fetch(`/api/trips/by-slug/${slug}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let resolvedId: string;
        if (tripRes.ok) {
          const td = await tripRes.json();
          resolvedId = td.data?.id ?? td.id;
          setTripName(td.data?.name ?? td.name ?? '');
        } else {
          // Fallback: slug may be the uuid directly
          resolvedId = slug;
        }
        setTripId(resolvedId);

        const segRes = await fetch(`/api/trips/${resolvedId}/itinerary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!segRes.ok) throw new Error('Failed to load itinerary');
        const sd = await segRes.json();
        setSegments(sd.segments ?? []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [slug, getToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-brand-cream">Trip Itinerary</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-brand-cream">Trip Itinerary</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Compass size={40} className="mx-auto text-brand-cream/20 mb-4" />
            <p className="text-brand-cream/60 mb-2">Itinerary coming soon</p>
            <p className="text-sm text-brand-cream/40">
              The trip plan will be published here as details are confirmed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const grouped = groupByDate(segments);
  const sortedDates = Array.from(grouped.keys()).sort();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-brand-cream">Trip Itinerary</h1>
        {tripName && <p className="text-brand-cream/60 mt-1">{tripName}</p>}
      </div>

      {sortedDates.map((date, dayIndex) => {
        const daySegments = grouped.get(date) ?? [];
        return (
          <div key={date}>
            {/* Day header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-brown/20 border border-brand-brown/40 text-brand-tan text-sm font-bold shrink-0">
                {dayIndex + 1}
              </div>
              <div>
                <p className="text-brand-tan font-semibold">{formatDate(date)}</p>
              </div>
            </div>

            <div className="space-y-3 ml-11">
              {daySegments.map((seg) => {
                const meta = CATEGORY_META[seg.category];
                return (
                  <div
                    key={seg.id}
                    className={`border rounded-lg p-4 ${meta.colour}`}
                  >
                    {/* Category + title row */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs uppercase tracking-wide opacity-70">
                            {meta.label}
                          </span>
                        </div>
                        <p className="font-semibold text-white leading-snug">{seg.title}</p>

                        {/* Route / location */}
                        {seg.location_from && seg.location_to && (
                          <p className="text-sm mt-1 opacity-80 flex items-center gap-1">
                            <MapPin size={12} />
                            {seg.location_from} → {seg.location_to}
                          </p>
                        )}
                        {seg.location_from && !seg.location_to && (
                          <p className="text-sm mt-1 opacity-80 flex items-center gap-1">
                            <MapPin size={12} />
                            {seg.location_from}
                          </p>
                        )}

                        {/* Times */}
                        {(seg.start_time || seg.end_time) && (
                          <p className="text-sm mt-1 opacity-80 flex items-center gap-1">
                            <Clock size={12} />
                            {seg.start_time?.slice(0, 5)}
                            {seg.start_time && seg.end_time && ' – '}
                            {seg.end_time?.slice(0, 5)}
                          </p>
                        )}

                        {/* Member description */}
                        {seg.member_description && (
                          <p className="text-sm mt-2 opacity-90 whitespace-pre-line">
                            {seg.member_description}
                          </p>
                        )}

                        {/* Contacts */}
                        {seg.contacts.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {seg.contacts.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <Phone size={12} className="opacity-60 shrink-0" />
                                <span className="font-medium">{c.name}</span>
                                {c.role && (
                                  <span className="opacity-60">· {c.role}</span>
                                )}
                                {c.phone && (
                                  <a
                                    href={`tel:${c.phone}`}
                                    className="underline opacity-80 hover:opacity-100"
                                  >
                                    {c.phone}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
