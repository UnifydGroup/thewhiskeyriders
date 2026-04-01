export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-brown/20 bg-brand-black/50 py-8 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between">
          <p className="text-brand-cream/60 text-sm">
            &copy; {currentYear} Whiskey Riders. All rights reserved.
          </p>
          <p className="text-brand-cream/60 text-sm mt-4 sm:mt-0">
            Until We Ride
          </p>
        </div>
      </div>
    </footer>
  );
}
