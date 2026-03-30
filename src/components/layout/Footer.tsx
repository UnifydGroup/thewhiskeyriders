export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-brown/20 bg-brand-black/50 py-8 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="font-semibold text-brand-cream mb-3">Whiskey Riders</h4>
            <p className="text-brand-cream/60 text-sm">
              Ride. Bond. Remember. The ultimate motorcycle adventure collective.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-brand-cream mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-brand-cream/60">
              <li><a href="/dashboard" className="hover:text-brand-cream transition-colors">Dashboard</a></li>
              <li><a href="/trips" className="hover:text-brand-cream transition-colors">Trips</a></li>
              <li><a href="/gallery" className="hover:text-brand-cream transition-colors">Gallery</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-brand-cream mb-3">Community</h4>
            <ul className="space-y-2 text-sm text-brand-cream/60">
              <li><a href="/profile" className="hover:text-brand-cream transition-colors">Members</a></li>
              <li><a href="/trips" className="hover:text-brand-cream transition-colors">Adventures</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-brand-cream mb-3">Stay Updated</h4>
            <p className="text-brand-cream/60 text-sm">
              Check your email for trip updates and announcements.
            </p>
          </div>
        </div>

        <div className="border-t border-brand-brown/20 pt-8 flex flex-col sm:flex-row items-center justify-between">
          <p className="text-brand-cream/60 text-sm">
            &copy; {currentYear} Whiskey Riders. All rights reserved.
          </p>
          <p className="text-brand-cream/60 text-sm mt-4 sm:mt-0">
            Ride safe. Ride free. Ride together.
          </p>
        </div>
      </div>
    </footer>
  );
}
