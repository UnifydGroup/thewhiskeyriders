import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

async function getSiteSettings() {
  try {
    const supabase = await createClient();
    
    const { data } = await supabase
      .from('site_settings')
      .select('*')
      .single();
    
    return {
      logoUrl: data?.logo_url || '/3.png',
      backgroundImageUrl: data?.background_image_url || '/swirl-bg.svg',
    };
  } catch (err) {
    console.error('Failed to load site settings:', err);
    return {
      logoUrl: '/3.png',
      backgroundImageUrl: '/swirl-bg.svg',
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
  const { logoUrl, backgroundImageUrl } = await getSiteSettings();
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
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-20 relative overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 z-0 opacity-40"
          style={{
            backgroundImage: `url('${backgroundImageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
          }}
        />

        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <div className="flex justify-center mb-8">
              <img
                src={logoUrl}
                alt="Whiskey Riders Logo"
                className="h-96 w-96 object-contain"
              />
            </div>
            <p className="text-3xl sm:text-4xl text-brand-tan font-semibold">
              Until We Ride
            </p>
          </div>

          <div className="pt-8">
            <Link
              href="/login"
              className="inline-block px-8 py-4 bg-brand-brown hover:bg-brand-brown/90 text-brand-black font-bold text-lg rounded-lg transition-colors shadow-lg hover:shadow-brand-brown/50"
            >
              Enter Portal
            </Link>
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

      {/* Instagram Feed */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-brand-black/50 border-t border-brand-brown/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Follow Our Journey</h2>
          <div className="bg-brand-black/80 rounded-lg border border-brand-brown/20 p-8 text-center">
            <p className="text-brand-cream/70 mb-6">
              Follow us on Instagram for the latest stories from the road
            </p>
            <a
              href="https://www.instagram.com/thewhiskeyriders/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 bg-brand-brown hover:bg-brand-brown/90 text-brand-black font-bold rounded-lg transition-colors"
            >
              @thewhiskeyriders on Instagram
            </a>
            {/* Instagram Embed */}
            <div className="mt-8 max-h-96 overflow-y-auto rounded-lg">
              <iframe
                src="https://www.instagram.com/thewhiskeyriders/embed"
                width="100%"
                height="600"
                frameBorder="0"
                scrolling="auto"
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-brown/20 bg-brand-black/50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-brand-cream/60 text-sm">
          <p>&copy; 2024 Whiskey Riders. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
