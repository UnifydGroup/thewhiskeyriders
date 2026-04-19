'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import {
  Calendar,
  MapPin,
  Users,
  Image as ImageIcon,
  Newspaper,
  FileText,
  Download,
  Eye,
  Clock3,
} from 'lucide-react';
import Link from 'next/link';
import PaymentScheduleSection from '@/components/trip/PaymentScheduleSection';
import PaymentProgressCard from '@/components/dashboard/PaymentProgressCard';
import PhotosTabContent from '@/components/photos/PhotosTabContent';
import MemberTransactions from '@/components/trips/MemberTransactions';
import MemberBudgetView from '@/components/budget/MemberBudgetView';
import { getMemberDisplayName } from '@/lib/member-display';
import type { Trip, TripKeyDate, TripUpdate, TripMember, Profile } from '@/lib/types/database';
import { NewsCard } from '@/components/news/NewsCard';
import type { NewsItem } from '@/lib/news/types';

type TripMemberWithProfile = TripMember & {
  profiles: Pick<Profile, 'id' | 'full_name' | 'nickname' | 'avatar_url'> | null;
};

type TripDocument = {
  id: string;
  name: string;
  file_url: string;
  access_url?: string;
  file_type: string;
  created_at: string;
};

type TripTab = 'overview' | 'news' | 'photos' | 'documents' | 'payments' | 'budget' | 'votes';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getCountdownTargetDate(trip: Pick<Trip, 'start_date' | 'countdown_target_at'>): Date | null {
  if (trip.countdown_target_at) {
    const explicitDate = new Date(trip.countdown_target_at);
    if (!Number.isNaN(explicitDate.getTime())) {
      return explicitDate;
    }
  }

  const fallbackDate = new Date(`${trip.start_date}T00:00:00`);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

function getCountdownParts(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const slug = params.slug as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [keyDates, setKeyDates] = useState<TripKeyDate[]>([]);
  const [updates, setUpdates] = useState<TripUpdate[]>([]);
  const [taggedNews, setTaggedNews] = useState<NewsItem[]>([]);
  const [members, setMembers] = useState<TripMemberWithProfile[]>([]);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [tab, setTab] = useState<TripTab>('overview');
  const [canViewBudgetTab, setCanViewBudgetTab] = useState(false);
  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileData) {
            setCurrentUser(profileData);
          }
        }

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

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          const authHeaders = {
            Authorization: `Bearer ${session.access_token}`,
          };

          const newsResponse = await fetch(`/api/news?placement=trip&tripId=${tripData.id}&limit=20`, {
            headers: authHeaders,
          });

          const newsPayload = await newsResponse.json().catch(() => ({}));
          if (newsResponse.ok && newsPayload?.success) {
            const items = (newsPayload?.data?.news || []) as NewsItem[];
            setTaggedNews(
              items.filter((item) => item.trip_tags.some((taggedTrip) => taggedTrip.id === tripData.id))
            );
          }

          const budgetResponse = await fetch(`/api/trips/${tripData.id}/budget/summary`, {
            headers: authHeaders,
          });
          const budgetPayload = await budgetResponse.json().catch(() => ({}));
          if (budgetResponse.ok && budgetPayload?.success) {
            const visibility = budgetPayload?.data?.visibility;
            setCanViewBudgetTab(Boolean(visibility?.is_admin || visibility?.show_group || visibility?.show_individual));
          } else {
            setCanViewBudgetTab(false);
          }
        } else {
          setCanViewBudgetTab(false);
        }

        // Get members
        const { data: membersData } = await supabase
          .from('trip_members')
          .select('*, profiles!user_id(id, full_name, nickname, avatar_url)')
          .eq('trip_id', tripData.id);

        if (membersData) {
          setMembers(membersData as TripMemberWithProfile[]);
        }

      } catch (err) {
        console.error('Failed to load trip:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [slug, router, supabase]);

  useEffect(() => {
    if (!canViewBudgetTab && tab === 'budget') {
      setTab('overview');
    }
  }, [canViewBudgetTab, tab]);

  useEffect(() => {
    if (tab !== 'documents' || !trip?.id) {
      return;
    }

    let active = true;

    const loadDocuments = async () => {
      setDocumentsLoading(true);
      setDocumentsError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        const response = await fetch(`/api/trips/${trip.id}/documents?limit=200`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load documents');
        }

        if (active) {
          setDocuments(payload.data?.documents || []);
        }
      } catch (err: unknown) {
        if (active) {
          setDocuments([]);
          setDocumentsError(getErrorMessage(err, 'Failed to load documents'));
        }
      } finally {
        if (active) {
          setDocumentsLoading(false);
        }
      }
    };

    loadDocuments();

    return () => {
      active = false;
    };
  }, [tab, trip?.id, supabase]);

  useEffect(() => {
    const targetDate = trip ? getCountdownTargetDate(trip) : null;
    if (!trip?.countdown_enabled || !targetDate) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [trip]);

  const getFileIcon = (fileType: string) => {
    const normalizedType = (fileType || '').toLowerCase();
    if (normalizedType.includes('pdf')) return '📄';
    if (normalizedType.includes('image')) return '🖼️';
    if (normalizedType.includes('video')) return '🎥';
    if (normalizedType.includes('word') || normalizedType.includes('document')) return '📝';
    if (normalizedType.includes('sheet') || normalizedType.includes('excel')) return '📊';
    return '📎';
  };

  const countdownTimeLeft = useMemo(() => {
    if (!trip?.countdown_enabled) return null;
    const targetDate = getCountdownTargetDate(trip);
    if (!targetDate) return null;
    const remainingMs = Math.max(0, targetDate.getTime() - nowMs);
    return getCountdownParts(remainingMs);
  }, [trip, nowMs]);

  const countdownComplete = useMemo(() => {
    if (!trip?.countdown_enabled) return false;
    const targetDate = getCountdownTargetDate(trip);
    if (!targetDate) return false;
    return targetDate.getTime() <= nowMs;
  }, [trip, nowMs]);

  const tripCountdownTarget = useMemo(() => {
    if (!trip?.countdown_enabled) return null;
    return getCountdownTargetDate(trip);
  }, [trip]);

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

  const tabs: TripTab[] = canViewBudgetTab
    ? ['overview', 'news', 'photos', 'documents', 'payments', 'budget', 'votes']
    : ['overview', 'news', 'photos', 'documents', 'payments', 'votes'];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
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

        {trip?.countdown_enabled && tripCountdownTarget && countdownTimeLeft && (
          <Card className="w-full lg:max-w-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-brand-brown" />
                Trip Countdown
              </CardTitle>
              <CardDescription className="text-brand-cream/70">
                {trip.name} · {formatDate(tripCountdownTarget, 'MMM d, yyyy h:mm a')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {countdownComplete ? (
                <p className="text-brand-cream font-medium">Countdown reached.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border border-brand-brown/20 py-3">
                    <p className="text-2xl font-bold text-brand-cream">{countdownTimeLeft.days}</p>
                    <p className="text-xs text-brand-cream/60 uppercase tracking-wide">Days</p>
                  </div>
                  <div className="rounded-lg border border-brand-brown/20 py-3">
                    <p className="text-2xl font-bold text-brand-cream">{countdownTimeLeft.hours}</p>
                    <p className="text-xs text-brand-cream/60 uppercase tracking-wide">Hours</p>
                  </div>
                  <div className="rounded-lg border border-brand-brown/20 py-3">
                    <p className="text-2xl font-bold text-brand-cream">{countdownTimeLeft.minutes}</p>
                    <p className="text-xs text-brand-cream/60 uppercase tracking-wide">Min</p>
                  </div>
                  <div className="rounded-lg border border-brand-brown/20 py-3">
                    <p className="text-2xl font-bold text-brand-cream">{countdownTimeLeft.seconds}</p>
                    <p className="text-xs text-brand-cream/60 uppercase tracking-wide">Sec</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-brown/20 flex gap-8 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-2 font-semibold transition-colors capitalize flex items-center gap-2 whitespace-nowrap ${
              tab === t
                ? 'text-brand-brown border-b-2 border-brand-brown'
                : 'text-brand-cream/60 hover:text-brand-cream'
            }`}
          >
            {t === 'news' && <Newspaper className="w-4 h-4" />}
            {t === 'photos' && <ImageIcon className="w-4 h-4" />}
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-8">
          {/* Schedule / Itinerary */}
          {trip.itinerary && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Schedule & Itinerary</h2>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-brand-cream/80 whitespace-pre-wrap">{trip.itinerary}</p>
                </CardContent>
              </Card>
            </div>
          )}

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
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={member.profiles?.avatar_url || null}
                            alt={getMemberDisplayName(member.profiles) || 'Rider'}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-brand-cream truncate">
                              {getMemberDisplayName(member.profiles)}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0">
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

          {/* Payment Schedule */}
          {trip && (
            <div>
              <PaymentScheduleSection tripId={trip.id} tripName={trip.name} showPaymentInfo={true} />
            </div>
          )}
        </div>
      )}

      {/* News Tab */}
      {tab === 'news' && (
        <div className="space-y-4">
          {taggedNews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-brand-cream/70 mb-4">No trip news published yet</p>
                <p className="text-sm text-brand-cream/50">
                  Updates tagged to this trip will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {taggedNews.map((item) => (
                <NewsCard key={item.id} item={item} compact />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photos Tab */}
      {tab === 'photos' && trip && (
        <PhotosTabContent
          tripId={trip.id}
          isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'super_admin'}
          currentUserId={currentUser?.id}
        />
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="space-y-4">
          {documentsLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Spinner />
              </CardContent>
            </Card>
          ) : documentsError ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-red-300">{documentsError}</p>
              </CardContent>
            </Card>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-brand-cream/70 mb-4">No documents shared yet</p>
                <p className="text-sm text-brand-cream/50">
                  Trip organizers will share travel documents here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {documents.map((document) => (
                <Card key={document.id}>
                  <CardContent className="py-5">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl mt-0.5">{getFileIcon(document.file_type)}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-cream truncate">{document.name}</p>
                        <p className="text-sm text-brand-cream/60 mt-1 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {document.file_type || 'Unknown type'}
                        </p>
                        <p className="text-xs text-brand-cream/50 mt-1">
                          Uploaded {formatDate(document.created_at, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <a
                        href={document.access_url || document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-brand-brown/30 text-brand-cream hover:border-brand-brown/60 hover:bg-brand-brown/10 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </a>
                      <a
                        href={document.access_url || document.file_url}
                        download
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-brand-brown/30 text-brand-cream hover:border-brand-brown/60 hover:bg-brand-brown/10 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && trip && (
        <div className="space-y-6">
          {currentUser?.id && (
            <PaymentProgressCard
              tripId={trip.id}
              memberId={currentUser.id}
              tripName={trip.name}
            />
          )}
          {currentUser?.id && (
            <div>
              <h2 className="text-2xl font-bold text-brand-cream mb-4">Your Transactions</h2>
              <MemberTransactions memberId={currentUser.id} tripId={trip.id} />
            </div>
          )}
          <PaymentScheduleSection tripId={trip.id} tripName={trip.name} showPaymentInfo={true} />
        </div>
      )}

      {/* Budget Tab */}
      {tab === 'budget' && canViewBudgetTab && trip && (
        <MemberBudgetView tripId={trip.id} />
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
