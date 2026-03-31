'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Calendar, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import type { Trip, TripKeyDate, TripUpdate, TripMember } from '@/lib/types/database';

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const slug = params.slug as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [keyDates, setKeyDates] = useState<TripKeyDate[]>([]);
  const [updates, setUpdates] = useState<TripUpdate[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [tab, setTab] = useState<'overview' | 'documents' | 'payments' | 'votes'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get trip
        const { data: tripData } = await supabase
          .from('trips')
          .select('*')
          .eq('slug', slug)
          .single();

        if (!tripData) {
          router.push('/trips');
          return;
        }

        setTrip(tripData);

        // Get key dates
        const { data: datesData } = await supabase
          .from('trip_key_dates')
          .select('*')
          .eq('trip_id', tripData.id)
          .order('date', { ascending: true });

        if (datesData) {
          setKeyDates(datesData);
        }

        // Get updates
        const { data: updatesData } = await supabase
          .from('trip_updates')
          .select('*')
          .eq('trip_id', tripData.id)
          .order('published_at', { ascending: false });

        if (updatesData) {
          setUpdates(updatesData);
        }

        // Get members
        const { data: membersData } = await supabase
          .from('trip_members')
          .select('*')
          .eq('trip_id', tripData.id);

        if (membersData) {
          setMembers(membersData);
        }
      } catch (err) {
        console.error('Failed to load trip:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [slug, supabase, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-brand-cream">Trip not found</h1>
        <Link href="/trips">
          <Button variant="primary">Back to Trips</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/trips" className="text-brand-brown hover:text-brand-tan transition-colors mb-4 inline-block">
          ← Back to Trips
        </Link>
        <h1 className="text-4xl font-bold text-brand-cream mb-2">{trip.name}</h1>
        <div className="flex flex-wrap items-center gap-4 text-brand-cream/70">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            <span>{trip.destination}, {trip.country}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <span>{formatDate(trip.start_date)} - {formatDate(trip.end_date)}</span>
          </div>
          <Badge variant="secondary">{trip.status}</Badge>
        </div>
        {trip.description && (
          <p className="mt-4 text-brand-cream/80 max-w-2xl">
            {trip.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-brown/20 flex gap-8">
        {(['overview', 'documents', 'payments', 'votes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-2 font-semibold transition-colors capitalize ${
              tab === t
                ? 'text-brand-brown border-b-2 border-brand-brown'
                : 'text-brand-cream/60 hover:text-brand-cream'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-8">
          {/* Key Dates */}
          {keyDates.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Key Dates</h2>
              <div className="space-y-4">
                {keyDates.map((date) => (
                  <Card key={date.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-brand-cream mb-1">{date.title}</p>
                          <p className="text-sm text-brand-cream/70">{formatDate(date.date)}</p>
                          {date.description && (
                            <p className="text-sm text-brand-cream/60 mt-2">{date.description}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-4">
                          {date.type}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Updates */}
          {updates.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Updates</h2>
              <div className="space-y-4">
                {updates.map((update) => (
                  <Card key={update.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{update.title}</CardTitle>
                      <CardDescription>
                        {formatDate(update.published_at, 'MMM d, yyyy h:mm a')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-brand-cream/80 whitespace-pre-wrap">{update.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {members.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Riders ({members.length})
                </div>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-brand-cream">{member.user_id}</p>
                          <Badge variant="outline" className="mt-2">
                            {member.trip_role}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">Documents coming soon</p>
            <p className="text-sm text-brand-cream/50">
              Trip organizers will share travel documents here
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">Payment tracking coming soon</p>
            <p className="text-sm text-brand-cream/50">
              Payment status and history will appear here
            </p>
          </CardContent>
        </Card>
      )}

      {/* Votes Tab */}
      {tab === 'votes' && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-brand-cream/70 mb-4">Awards voting coming soon</p>
            <p className="text-sm text-brand-cream/50">
              Vote for fellow riders and their achievements
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
