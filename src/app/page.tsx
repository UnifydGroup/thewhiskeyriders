import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

async function getSiteSettings() {
  try {
    const supabase = await createClient();
    
    const { data } = await supabase
      .from('site_settings')
      .select(
        'logo_url, background_image_url, background_media_type, background_video_url, background_position_x, background_position_y, background_zoom, background_opacity'
      )
      .single();
    
    return {
      logoUrl: data?.logo_url || '/3.png',
      backgroundMediaType: data?.background_media_type === 'video' ? 'video' : 'image',
      backgroundImageUrl: data?.background_image_url || '/swirl-bg.svg',
      backgroundVideoUrl: data?.background_video_url || '',
      backgroundPositionX: clamp(data?.background_position_x ?? 50, 0, 100),
      backgroundPositionY: clamp(data?.background_position_y ?? 50, 0, 100),
      backgroundZoom: clamp(data?.background_zoom ?? 100, 25, 300),
      backgroundOpacity: clamp(data?.background_opacity ?? 40, 0, 100),
    };
  } catch (err) {
    console.error('Failed to load site settings:', err);
    return {
      logoUrl: '/3.png',
      backgroundMediaType: 'image' as const,
      backgroundImageUrl: '/swirl-bg.svg',
      backgroundVideoUrl: '',
      backgroundPositionX: 50,
      backgroundPositionY: 50,
      backgroundZoom: 100,
      backgroundOpacity: 40,
    };
  }
}

async function getTrips() {
  try {
    const supabase = await createClient();
    
    const { data } = await supabase
      .from('trips')
      .select('id, slug, name, destination, cover_image_url')
      .order('start_date', { ascending: false })
      .limit(12);
    
    return data || [];
  } catch (err) {
    console.error('Failed to load trips:', err);
    return [];
  }
}

export default async function Home() {
  const {
    logoUrl,
    backgroundMediaType,
    backgroundImageUrl,
    backgroundVideoUrl,
    backgroundPositionX,
    backgroundPositionY,
    backgroundZoom,
    backgroundOpacity,
  } = await getSiteSettings();
  const trips = await getTrips();

  return (
    <div className="min-h-screen bg-brand-black text-brand-cream flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-brand-brown/20 bg-brand-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Whiskey Riders Logo"
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-bold text-brand-cream">THE WHISKEY RIDERS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/gallery"
              className="px-4 py-2 rounded-lg border border-brand-brown/40 text-brand-tan hover:bg-brand-brown/15 transition-colors text-sm font-semibold"
            >
              Trip Galleries
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-brand-brown hover:bg-brand-brown/90 text-brand-black text-sm font-bold transition-colors"
            >
              Member Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-10 lg:py-12 relative overflow-hidden">
        {/* Background Media */}
        {backgroundMediaType === 'video' && backgroundVideoUrl ? (
          <video
            src={backgroundVideoUrl}
            className="absolute inset-0 z-0 h-full w-full object-cover"
            style={{
              objectPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
              transform: `scale(${backgroundZoom / 100})`,
              opacity: backgroundOpacity / 100,
            }}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `url('${backgroundImageUrl}')`,
              backgroundSize: `${backgroundZoom}%`,
              backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
              backgroundRepeat: 'no-repeat',
              backgroundAttachment: 'fixed',
              opacity: backgroundOpacity / 100,
            }}
          />
        )}

        <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="text-center lg:text-left space-y-6">
            <div className="flex justify-center lg:justify-start">
              <img
                src={logoUrl}
                alt="Whiskey Riders Logo"
                className="h-52 w-52 sm:h-64 sm:w-64 object-contain"
              />
            </div>
            <p className="text-3xl sm:text-4xl text-brand-tan font-semibold">
              Until We Ride
            </p>
            <p className="text-brand-cream/80 max-w-xl mx-auto lg:mx-0">
              Public trip galleries and live social updates are available below. Member-only tools remain behind login.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              <Link
                href="/gallery"
                className="inline-block px-8 py-4 border border-brand-brown/60 hover:bg-brand-brown/15 text-brand-tan font-bold text-lg rounded-lg transition-colors"
              >
                View Trip Galleries
              </Link>
              <Link
                href="/login"
                className="inline-block px-8 py-4 bg-brand-brown hover:bg-brand-brown/90 text-brand-black font-bold text-lg rounded-lg transition-colors shadow-lg hover:shadow-brand-brown/50"
              >
                Enter Portal
              </Link>
            </div>
          </div>

          <div className="bg-brand-black/70 rounded-lg border border-brand-brown/20 p-4 sm:p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold text-brand-cream">Live Social Feed</h2>
              <a
                href="https://www.instagram.com/thewhiskeyriders/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-brand-tan hover:text-brand-cream transition-colors"
              >
                @thewhiskeyriders
              </a>
            </div>
            <div className="rounded-lg overflow-hidden border border-brand-brown/20">
              <iframe
                src="https://www.instagram.com/thewhiskeyriders/embed"
                width="100%"
                height="360"
                frameBorder="0"
                scrolling="auto"
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Trips Grid */}
      {trips.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-brand-black border-t border-brand-brown/20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12">Our Adventures</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/gallery/${trip.slug}`}
                  className="group relative overflow-hidden rounded-lg border border-brand-brown/20 hover:border-brand-brown/60 transition-all duration-300"
                >
                  {/* Trip Image */}
                  <div className="relative h-64 bg-brand-black/50 overflow-hidden">
                    {trip.cover_image_url && (
                      <img
                        src={trip.cover_image_url}
                        alt={trip.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />
                  </div>

                  {/* Trip Info */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6">
                    <h3 className="text-2xl font-bold text-brand-cream mb-1 group-hover:text-brand-tan transition-colors">
                      {trip.name}
                    </h3>
                    <p className="text-brand-cream/70 text-sm group-hover:text-brand-cream transition-colors">
                      {trip.destination}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-brand-brown/20 bg-brand-black/50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-brand-cream/60 text-sm">
          <p>&copy; 2024 Whiskey Riders. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
