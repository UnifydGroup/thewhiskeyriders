import Link from 'next/link';
import { Bike } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-brand-black text-brand-cream flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-brand-brown/20 bg-brand-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bike className="w-8 h-8 text-brand-brown" />
            <span className="text-xl font-bold text-brand-cream">Whiskey Riders</span>
          </div>
          <Link
            href="/login"
            className="px-6 py-2 bg-brand-brown hover:bg-brand-brown/90 text-brand-black font-semibold rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <div className="inline-block">
              <div className="text-6xl sm:text-7xl font-bold mb-4">🏍️</div>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              Whiskey Riders
            </h1>
            <p className="text-3xl sm:text-4xl text-brand-tan font-semibold">
              Ride. Bond. Remember.
            </p>
          </div>

          <p className="text-lg sm:text-xl text-brand-cream/80 leading-relaxed">
            The private members portal for epic motorcycle adventures around the world. Connect with fellow riders, track journeys, and create unforgettable memories.
          </p>

          <div className="pt-8">
            <Link
              href="/login"
              className="inline-block px-8 py-4 bg-brand-brown hover:bg-brand-brown/90 text-brand-black font-bold text-lg rounded-lg transition-colors shadow-lg hover:shadow-brand-brown/50"
            >
              Enter Portal
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-12">
            <div className="surface-dark rounded-lg p-6 border border-brand-brown/20">
              <div className="text-3xl mb-3">🗺️</div>
              <h3 className="text-lg font-semibold mb-2">Epic Destinations</h3>
              <p className="text-brand-cream/70">
                Explore curated motorcycle routes across continents
              </p>
            </div>
            <div className="surface-dark rounded-lg p-6 border border-brand-brown/20">
              <div className="text-3xl mb-3">🤝</div>
              <h3 className="text-lg font-semibold mb-2">Connected Riders</h3>
              <p className="text-brand-cream/70">
                Bond with fellow enthusiasts who share your passion
              </p>
            </div>
            <div className="surface-dark rounded-lg p-6 border border-brand-brown/20">
              <div className="text-3xl mb-3">📸</div>
              <h3 className="text-lg font-semibold mb-2">Shared Memories</h3>
              <p className="text-brand-cream/70">
                Capture and cherish moments from every adventure
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-brown/20 bg-brand-black/50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-brand-cream/60 text-sm">
          <p>&copy; 2024 Whiskey Riders. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
