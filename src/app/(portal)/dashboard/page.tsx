'use client';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import TripCountdown from '@/components/dashboard/TripCountdown';
import HeroBackgroundPicker from '@/components/dashboard/HeroBackgroundPicker';
import { TripTypeBadge } from '@/components/trip/TripTypeBadge';
import { cn, formatDate } from '@/lib/utils';
import { isTweener } from '@/lib/trip-type';
import { getCountdownTargetDate } from '@/lib/trip-countdown';
import { framingStyle, isDefaultFraming, parseFraming } from '@/lib/images/framing';
import { calculateAdventureScore } from '@/lib/adventure-score';
import { getMemberDisplayName } from '@/lib/member-display';
import { buildFramedPhotoUrl } from '@/lib/photos/imageTransforms';
import { loadTaggedPhotos, type TaggedPhoto } from '@/lib/photos/taggedPhotos';
import {
  loadBadgeCatalog,
  buildBadgeShelf,
  loadMemberBadges,
  type BadgeCatalogItem,
  type MemberBadgeSummary,
} from '@/lib/badges/memberBadges';
import { ArrowRight, Camera } from 'lucide-react';
import { BadgePatch } from '@/components/badges/BadgePatch';
import { yearFromTripName } from '@/lib/badges/badgeArt';
import type { Profile, Trip, TripRole } from '@/lib/types/database';
import type { NewsItem } from '@/lib/news/types';

type MemberTrip = Trip & { trip_role: TripRole };

type MemberTripRecord = {
  trip_role: TripRole;
  trips: Trip | null;
};

type PaymentSummary = { paid: number; target: number };

type DashboardNewsItem = NewsItem & { taggedToMe: boolean };

const SECTION_HEADING = 'text-xl sm:text-2xl font-extrabold uppercase tracking-wide text-brand-cream';
const PANEL = 'rounded-xl border border-brand-brown/20 bg-brand-black/40 p-5 sm:p-6';

const PROFILE_FIELDS: Array<{ key: keyof Profile; label: string }> = [
  { key: 'avatar_url', label: 'Profile photo' },
  { key: 'nickname', label: 'Nickname' },
  { key: 'phone', label: 'Phone number' },
  { key: 'date_of_birth', label: 'Date of birth' },
  { key: 'emergency_contact', label: 'Emergency contact' },
  { key: 'emergency_contact_number', label: 'Emergency contact number' },
  { key: 'address_line1', label: 'Address' },
  { key: 'passport_number', label: 'Passport number' },
  { key: 'passport_expiry', label: 'Passport expiry' },
  { key: 'shirt_size', label: 'Shirt size' },
  { key: 'shorts_size', label: 'Shorts size' },
];

const TRIP_ROLE_LABELS: Record<TripRole, string> = {
  captain: 'Captain',
  kitty_man: 'Kitty Man',
  organiser: 'Organiser',
  member: 'Rider',
};

function getFullName(profile: Profile): string {
  const fromParts = [profile.first_name, profile.middle_name, profile.surname].filter(Boolean).join(' ').trim();
  return fromParts || profile.full_name?.trim() || '';
}

function getStatusPill(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return { label: 'Active member', className: 'bg-green-950 text-green-200', dot: 'bg-green-400' };
    case 'pending':
      return { label: 'Pending approval', className: 'bg-yellow-950 text-yellow-200', dot: 'bg-yellow-400' };
    case 'inactive':
      return { label: 'Inactive member', className: 'bg-brand-black text-brand-cream/70', dot: 'bg-brand-cream/40' };
    case 'archived':
      return { label: 'Alumni', className: 'bg-brand-black text-brand-cream/70', dot: 'bg-brand-tan' };
    default:
      return null;
  }
}

function fmtAUD(n: number): string {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function startOfToday(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trips, setTrips] = useState<MemberTrip[]>([]);
  const [badges, setBadges] = useState<MemberBadgeSummary[]>([]);
  const [badgeCatalog, setBadgeCatalog] = useState<BadgeCatalogItem[]>([]);
  const [photos, setPhotos] = useState<TaggedPhoto[]>([]);
  const [news, setNews] = useState<DashboardNewsItem[]>([]);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [thumbnailFallbackIds, setThumbnailFallbackIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profileData) return;

        const currentProfile = profileData as Profile;
        setProfile(currentProfile);
        if (!currentProfile.password_changed) {
          setShowPasswordModal(true);
        }

        const [tripsResult, badgesResult, catalogResult, photosResult] = await Promise.allSettled([
          supabase.from('trip_members').select('trip_role, trips!trip_id(*)').eq('user_id', currentProfile.id),
          loadMemberBadges(supabase, currentProfile.id),
          loadBadgeCatalog(supabase),
          loadTaggedPhotos(supabase, currentProfile),
        ]);

        if (tripsResult.status === 'fulfilled') {
          const memberTrips = ((tripsResult.value.data || []) as unknown as MemberTripRecord[])
            .filter((entry) => entry.trips)
            .map((entry) => ({ ...(entry.trips as Trip), trip_role: entry.trip_role }))
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
          setTrips(memberTrips);
        }
        if (badgesResult.status === 'fulfilled') setBadges(badgesResult.value);
        if (catalogResult.status === 'fulfilled') setBadgeCatalog(catalogResult.value);
        if (photosResult.status === 'fulfilled') setPhotos(photosResult.value);
        else console.error('Failed to load tagged photos:', photosResult.reason);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  // Crew news: posts for everyone or this rider's trips, plus posts tagged to this rider.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    const loadNews = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const fetchPlacement = async (placement: 'global' | 'rider'): Promise<NewsItem[]> => {
        const response = await fetch(`/api/news?placement=${placement}&limit=5`, { headers });
        const payload = await response.json().catch(() => ({}));
        return response.ok && payload?.success ? payload?.data?.news || [] : [];
      };

      const [globalNews, riderNews] = await Promise.all([fetchPlacement('global'), fetchPlacement('rider')]);
      const riderIds = new Set(riderNews.map((item) => item.id));
      const merged = new Map<string, DashboardNewsItem>();
      [...riderNews, ...globalNews].forEach((item) => {
        if (!merged.has(item.id)) merged.set(item.id, { ...item, taggedToMe: riderIds.has(item.id) });
      });

      const latest = Array.from(merged.values())
        .sort((a, b) => {
          const aTime = new Date(a.published_at || a.created_at || 0).getTime();
          const bTime = new Date(b.published_at || b.created_at || 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 3);

      if (!cancelled) setNews(latest);
    };

    loadNews().catch((err) => console.error('Failed to load news:', err));
    return () => {
      cancelled = true;
    };
  }, [profile, supabase]);

  const today = startOfToday();
  const nextTrip = useMemo(
    () =>
      trips.find(
        (trip) =>
          (trip.status === 'upcoming' || trip.status === 'active') &&
          new Date(`${trip.end_date}T23:59:59`).getTime() >= today
      ) ?? null,
    [trips, today]
  );

  useEffect(() => {
    if (!nextTrip || !profile) {
      setPayment(null);
      return;
    }
    let cancelled = false;

    const loadPayment = async () => {
      const [scheduleRes, paymentsRes] = await Promise.all([
        fetch(`/api/payments/schedule?trip_id=${nextTrip.id}`),
        fetch(`/api/payments/member-payment?trip_id=${nextTrip.id}&member_id=${profile.id}`),
      ]);
      if (!scheduleRes.ok || !paymentsRes.ok) return;

      const scheduleData = await scheduleRes.json();
      const paymentsData = await paymentsRes.json();
      const flightsCost = Number(scheduleData.paymentSettings?.flights_cost_aud ?? 0);
      const target = Number(scheduleData.totalTarget || 0) + flightsCost;
      const paid = ((paymentsData.payments || []) as Array<{ amount: number }>).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      if (!cancelled) setPayment({ paid, target });
    };

    loadPayment().catch((err) => console.error('Failed to load payment summary:', err));
    return () => {
      cancelled = true;
    };
  }, [nextTrip, profile]);

  const handlePasswordChange = async (password: string) => {
    setChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      if (profile) {
        setProfile({ ...profile, password_changed: true });
      }

      setShowPasswordModal(false);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={cn(PANEL, 'py-12 text-center text-brand-cream/70')}>
        We couldn&apos;t load your profile. Try refreshing the page.
      </div>
    );
  }

  const displayName = getMemberDisplayName(profile);
  const fullName = getFullName(profile);
  const showFullName = Boolean(profile.nickname?.trim()) && fullName && fullName !== displayName;
  const statusPill = getStatusPill(profile.status);

  const completedAll = trips.filter((t) => t.status === 'completed');
  const completedTrips = completedAll.filter((t) => !isTweener(t)).length;
  const completedTweeners = completedAll.length - completedTrips;
  const bookedTrips = trips.filter((t) => t.status === 'upcoming').length;
  const uniqueCountries = new Set(trips.map((t) => t.country).filter(Boolean)).size;
  const adventureScore = calculateAdventureScore({
    completedTrips,
    completedTweeners,
    badgeCount: badges.length,
    uniqueCountries,
  });

  const countdownTarget = nextTrip ? getCountdownTargetDate(nextTrip) : null;
  const heroBackground = profile.dashboard_background_url || nextTrip?.cover_image_url || null;
  const heroFraming = profile.dashboard_background_url ? profile.dashboard_background_framing : nextTrip?.cover_image_framing;
  const paidPercent = payment && payment.target > 0 ? Math.min(100, Math.round((payment.paid / payment.target) * 100)) : 0;

  const { items: shelfItems, earnedCount: earnedBadgeTypes, total: badgeTotal } = buildBadgeShelf(badges, badgeCatalog);
  const badgeShelf = shelfItems.slice(0, 6);

  const filledFields = PROFILE_FIELDS.filter(({ key }) => {
    const value = profile[key];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  });
  const missingFields = PROFILE_FIELDS.filter((field) => !filledFields.includes(field));
  const profilePercent = Math.round((filledFields.length / PROFILE_FIELDS.length) * 100);

  const stats = [
    {
      label: 'Trips ridden',
      value: completedTrips,
      sub:
        completedTweeners > 0
          ? `+ ${completedTweeners} tweener${completedTweeners !== 1 ? 's' : ''}`
          : bookedTrips > 0
            ? `${bookedTrips} more booked`
            : 'See all trips',
      href: '/trips',
    },
    {
      label: 'Countries',
      value: uniqueCountries,
      sub: 'See your rider map',
      href: `/profile/${profile.id}`,
    },
    {
      label: "Photos you're in",
      value: photos.length,
      sub: photos[0] ? `Latest from ${photos[0].trip_name}` : 'Get tagged in the gallery',
      href: '/profile#tagged-photos',
    },
    {
      label: 'Badges',
      value: badges.length,
      sub: badgeTotal > earnedBadgeTypes ? `${badgeTotal - earnedBadgeTypes} still to earn` : 'View your badges',
      href: '/profile#badges',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handlePasswordChange}
        isLoading={changingPassword}
      />

      {/* Hero: rider + next adventure */}
      <section className="relative overflow-hidden rounded-2xl border border-brand-brown/25 bg-brand-black">
        {heroBackground && (
          <Image
            key={heroBackground}
            src={heroBackground}
            alt=""
            fill
            unoptimized
            priority
            className="object-cover opacity-60"
            style={framingStyle(heroFraming)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/75 to-brand-black/30" />

        <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
          <HeroBackgroundPicker
            profileId={profile.id}
            backgroundUrl={profile.dashboard_background_url ?? null}
            framing={profile.dashboard_background_framing}
            onChange={(update) => setProfile((previous) => (previous ? { ...previous, ...update } : previous))}
          />
        </div>

        <div className="relative grid grid-cols-1 gap-6 p-5 pt-16 sm:p-8 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
            <div className="relative flex-shrink-0">
              <Avatar
                src={profile.avatar_url}
                framing={profile.avatar_framing}
                alt={displayName}
                size="xl"
                className="h-28 w-28 border-4 border-brand-tan bg-brand-dark-grey text-3xl sm:h-36 sm:w-36"
              />
              <Link
                href="/profile/edit"
                aria-label={profile.avatar_url ? 'Change profile photo' : 'Add a profile photo'}
                className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-brand-black bg-brand-brown text-brand-cream transition-colors hover:bg-brand-tan hover:text-brand-black"
              >
                <Camera className="h-5 w-5" />
              </Link>
            </div>

            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-tan">Welcome back</p>
              <h1 className="break-words text-4xl font-extrabold uppercase leading-none tracking-tight text-brand-cream sm:text-5xl">
                {displayName === 'Unknown' ? 'Rider' : displayName}
              </h1>
              <p className="text-brand-cream/80">
                {[showFullName ? fullName : null, profile.created_at ? `Member since ${formatDate(profile.created_at, 'yyyy')}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
                {statusPill && (
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', statusPill.className)}>
                    <span className={cn('h-2 w-2 rounded-full', statusPill.dot)} />
                    {statusPill.label}
                  </span>
                )}
                {nextTrip && (
                  <span className="rounded-full bg-brand-brown/25 px-3 py-1 text-xs font-semibold text-brand-tan">
                    {TRIP_ROLE_LABELS[nextTrip.trip_role] ?? 'Rider'} · {nextTrip.name}
                  </span>
                )}
                <Link
                  href={`/profile/${profile.id}`}
                  className="rounded-full border border-brand-tan/60 px-3 py-1 text-xs font-semibold text-brand-tan transition-colors hover:bg-brand-tan hover:text-brand-black"
                >
                  Adventure score {adventureScore}
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-brand-brown/30 bg-brand-black/75 p-5 backdrop-blur-sm">
            {nextTrip && countdownTarget ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-tan">
                    {isTweener(nextTrip) ? 'Next tweener' : 'Next adventure'}
                  </p>
                  <p className="text-sm text-brand-cream/70">
                    {formatDate(nextTrip.start_date, 'd MMM')} – {formatDate(nextTrip.end_date, 'd MMM yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-extrabold uppercase leading-none tracking-tight text-brand-cream">
                    {nextTrip.name}
                  </h2>
                  <TripTypeBadge trip={nextTrip} size="sm" />
                </div>
                <p className="-mt-2 text-sm text-brand-cream/70">
                  {[nextTrip.destination, nextTrip.country].filter(Boolean).join(', ')}
                </p>

                <TripCountdown target={countdownTarget} />

                {payment && payment.target > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm text-brand-cream/80">
                      <span>Trip paid</span>
                      <span className="tabular-nums">
                        {fmtAUD(payment.paid)} of {fmtAUD(payment.target)}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-brand-dark-grey"
                      role="progressbar"
                      aria-valuenow={paidPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Trip payment progress"
                    >
                      <div className="h-full rounded-full bg-brand-brown" style={{ width: `${paidPercent}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/trips/${nextTrip.slug}`}
                    className="flex-1 rounded-lg bg-brand-brown px-4 py-2.5 text-center font-semibold text-brand-cream transition-colors hover:bg-brand-tan hover:text-brand-black"
                  >
                    Open trip page
                  </Link>
                  <Link
                    href={`/trips/${nextTrip.slug}/itinerary`}
                    className="rounded-lg border border-brand-brown/50 px-4 py-2.5 font-semibold text-brand-cream transition-colors hover:border-brand-tan"
                  >
                    Itinerary
                  </Link>
                  <Link
                    href={`/trips/${nextTrip.slug}/payments`}
                    className="rounded-lg border border-brand-brown/50 px-4 py-2.5 font-semibold text-brand-cream transition-colors hover:border-brand-tan"
                  >
                    Payments
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col justify-center gap-3 py-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-tan">Next adventure</p>
                <p className="text-2xl font-extrabold uppercase text-brand-cream">No ride booked yet</p>
                <p className="text-sm text-brand-cream/70">Check the trips page or ask an admin to add you to the next one.</p>
                <Link
                  href="/trips"
                  className="mx-auto rounded-lg bg-brand-brown px-4 py-2.5 font-semibold text-brand-cream transition-colors hover:bg-brand-tan hover:text-brand-black"
                >
                  Browse trips
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats + crew news */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="group flex flex-col gap-1 rounded-xl border border-brand-brown/20 bg-brand-black/40 p-4 transition-colors hover:border-brand-brown/60 sm:p-5"
            >
              <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-cream/60 sm:text-xs">
                {stat.label}
                <ArrowRight className="h-4 w-4 text-brand-brown transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-4xl font-extrabold leading-none text-brand-cream tabular-nums sm:text-5xl">
                {stat.value}
              </span>
              <span className="truncate text-xs text-brand-cream/60 sm:text-sm">{stat.sub}</span>
            </Link>
          ))}
        </section>

        <section aria-labelledby="crew-news-heading" className={cn(PANEL, 'flex flex-col gap-2')}>
          <div className="flex items-baseline justify-between">
            <h2 id="crew-news-heading" className={SECTION_HEADING}>Crew news</h2>
            <Link href="/news" className="text-sm font-semibold text-brand-brown hover:text-brand-tan">
              All news →
            </Link>
          </div>
          {news.length === 0 ? (
            <p className="py-4 text-sm text-brand-cream/60">No news yet. Check back soon.</p>
          ) : (
            news.map((item, index) => (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className={cn(
                  'flex flex-col py-2.5 transition-colors hover:text-brand-tan',
                  index < news.length - 1 && 'border-b border-brand-brown/15'
                )}
              >
                <span className="font-semibold text-brand-cream line-clamp-2">{item.title}</span>
                <span className="text-xs text-brand-cream/60">
                  {formatDate(item.published_at || item.created_at, 'd MMM yyyy')}
                  {item.taggedToMe && ' · tagged to you'}
                </span>
              </Link>
            ))
          )}
        </section>
      </div>

      {/* Badges */}
      <section aria-labelledby="badges-heading" className={cn(PANEL, 'space-y-5')}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="badges-heading" className={SECTION_HEADING}>
            Badges
            {badgeTotal > 0 && (
              <span className="ml-2 text-base font-semibold normal-case tracking-normal text-brand-cream/60">
                {earnedBadgeTypes} of {badgeTotal}
              </span>
            )}
          </h2>
          <Link href="/profile#badges" className="text-sm font-semibold text-brand-brown hover:text-brand-tan">
            All badges →
          </Link>
        </div>
        {badgeShelf.length === 0 ? (
          <p className="text-sm text-brand-cream/60">No badges yet. Complete trips to start earning them.</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6">
            {badgeShelf.map((badge) => (
              <div key={badge.key} className="group flex flex-col items-center gap-2 text-center" title={badge.description ?? undefined}>
                <div className="relative transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-[-3deg]">
                  <BadgePatch
                    name={badge.name}
                    badgeType={badge.badge_type}
                    icon={badge.icon}
                    year={badge.earned ? yearFromTripName(badge.latestTripName) : null}
                    locked={!badge.earned}
                    size={84}
                    className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] sm:h-[110px] sm:w-[100px]"
                  />
                  {badge.count > 1 && (
                    <span
                      className="absolute -right-1 top-0 rounded-full border-2 border-brand-black bg-brand-brown px-1.5 py-0.5 text-xs font-extrabold text-brand-cream tabular-nums"
                      aria-label={`Earned ${badge.count} times`}
                    >
                      ×{badge.count}
                    </span>
                  )}
                </div>
                <span className={cn('text-sm font-semibold leading-tight', badge.earned ? 'text-brand-cream' : 'text-brand-cream/60')}>
                  {badge.name}
                </span>
                <span className="text-xs text-brand-cream/55 line-clamp-2">
                  {badge.earned ? badge.latestTripName || '' : badge.description || 'Not earned yet'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rides timeline */}
      {trips.length > 0 && (
        <section aria-labelledby="rides-heading" className={cn(PANEL, 'space-y-5')}>
          <div className="flex items-baseline justify-between">
            <h2 id="rides-heading" className={SECTION_HEADING}>Your rides</h2>
            <Link href="/trips" className="text-sm font-semibold text-brand-brown hover:text-brand-tan">
              All trips →
            </Link>
          </div>

          <ol className="space-y-1 md:hidden">
            {[...trips].reverse().map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.slug}`}
                  className="flex min-h-11 items-center gap-3 border-b border-brand-brown/15 py-2"
                >
                  <span className="w-12 text-lg font-extrabold text-brand-cream">{formatDate(trip.start_date, 'yyyy')}</span>
                  <span className="flex-1 truncate text-brand-cream/90">{trip.name}</span>
                  <RideState trip={trip} isNext={trip.id === nextTrip?.id} />
                </Link>
              </li>
            ))}
          </ol>

          <div className="hidden overflow-x-auto md:block">
            <ol className="flex min-w-full pt-2">
              {trips.map((trip) => (
                <li key={trip.id} className="min-w-[7.5rem] flex-1">
                  <Link
                    href={`/trips/${trip.slug}`}
                    className={cn(
                      'group flex flex-col items-center gap-1.5 border-t-[3px] px-2 text-center',
                      isTweener(trip) ? 'border-dashed border-brand-tan/40' : 'border-brand-brown/40'
                    )}
                  >
                    <span
                      className={cn(
                        '-mt-[11px] h-5 w-5 rounded-full border-[3px] border-brand-dark-grey',
                        trip.id === nextTrip?.id ? 'bg-brand-brown' : trip.status === 'completed' ? 'bg-brand-tan' : 'bg-brand-cream/40'
                      )}
                    />
                    <span className="text-xl font-extrabold leading-none text-brand-cream">{formatDate(trip.start_date, 'yyyy')}</span>
                    <span className="text-sm text-brand-cream/80 group-hover:text-brand-tan">{trip.name}</span>
                    <RideState trip={trip} isNext={trip.id === nextTrip?.id} />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Tagged photos */}
      <section aria-labelledby="photos-heading" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="photos-heading" className={SECTION_HEADING}>Photos you&apos;re in</h2>
          {photos.length > 0 && (
            <Link href="/profile#tagged-photos" className="text-sm font-semibold text-brand-brown hover:text-brand-tan">
              See all {photos.length} →
            </Link>
          )}
        </div>
        {photos.length === 0 ? (
          <div className={cn(PANEL, 'text-center text-sm text-brand-cream/60')}>
            You haven&apos;t been tagged in any photos yet.{' '}
            <Link href="/gallery" className="font-semibold text-brand-brown hover:text-brand-tan">
              Browse the gallery
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
            {photos.slice(0, 6).map((photo) => (
              <Link
                key={photo.id}
                href={`/gallery/${photo.trip_slug}`}
                className="group overflow-hidden rounded-lg border border-brand-brown/20 bg-brand-black/40"
              >
                <div className="relative aspect-square transition-transform group-hover:scale-105">
                  {photo.media_type === 'video' ? (
                    <video src={photo.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <Image
                      src={
                        thumbnailFallbackIds.includes(photo.id)
                          ? photo.url
                          : buildFramedPhotoUrl(photo.url, 'thumbnail', !isDefaultFraming(parseFraming(photo.thumbnail_framing))) || photo.url
                      }
                      alt={photo.caption || `Photo from ${photo.trip_name}`}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 33vw, 16vw"
                      className="object-cover"
                      style={framingStyle(photo.thumbnail_framing)}
                      onError={() =>
                        setThumbnailFallbackIds((previous) =>
                          previous.includes(photo.id) ? previous : [...previous, photo.id]
                        )
                      }
                    />
                  )}
                </div>
                <p className="truncate px-2 py-1.5 text-xs text-brand-cream/75">{photo.trip_name}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Profile completeness */}
      <section aria-labelledby="profile-heading" className={cn(PANEL, 'flex flex-col gap-5 sm:flex-row sm:items-center')}>
        <div
          className="flex h-24 w-24 flex-shrink-0 items-center justify-center self-center rounded-full"
          style={{ background: `conic-gradient(var(--brand-tan) ${profilePercent}%, var(--brand-dark-grey) 0)` }}
          role="img"
          aria-label={`Profile ${profilePercent}% complete`}
        >
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-brand-black text-2xl font-extrabold text-brand-cream">
            {profilePercent}%
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 id="profile-heading" className={SECTION_HEADING}>Your profile</h2>
          {missingFields.length === 0 ? (
            <p className="text-sm text-brand-cream/70">All set. Your crew has everything they need.</p>
          ) : (
            <>
              <p className="text-sm text-brand-cream/70">
                Complete your profile so the crew can sort visas, insurance and gear.
              </p>
              <p className="text-sm text-brand-tan">
                Missing: {missingFields.map((field) => field.label.toLowerCase()).join(', ')}
              </p>
            </>
          )}
        </div>
        <Link
          href="/profile/edit"
          className="rounded-lg border border-brand-brown/50 px-5 py-2.5 text-center font-semibold text-brand-cream transition-colors hover:border-brand-tan"
        >
          Edit profile
        </Link>
      </section>
    </div>
  );
}

function RideState({ trip, isNext }: { trip: MemberTrip; isNext: boolean }) {
  const label = isNext
    ? trip.status === 'active'
      ? 'On the road'
      : 'Next up'
    : trip.status === 'completed'
      ? isTweener(trip)
        ? 'Tweener'
        : 'Ridden'
      : trip.status === 'cancelled'
        ? 'Cancelled'
        : 'Booked';

  return (
    <span
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.12em]',
        isNext ? 'text-brand-brown' : 'text-brand-tan/80'
      )}
    >
      {label}
    </span>
  );
}
