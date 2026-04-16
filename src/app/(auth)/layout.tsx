import Image from 'next/image';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Image
              src="/3.png"
              alt="Whiskey Riders Logo"
              width={72}
              height={72}
              className="h-[72px] w-[72px] object-contain"
              priority
            />
          </Link>
          <h1 className="text-3xl font-bold text-brand-cream mb-2">Whiskey Riders</h1>
          <p className="text-brand-tan text-sm">Members Portal</p>
        </div>

        {/* Form */}
        <div className="surface-dark rounded-lg border border-brand-brown/20 p-8">
          {children}
        </div>

        {/* Footer link */}
        <div className="text-center">
          <Link
            href="/"
            className="text-brand-cream/60 hover:text-brand-cream text-sm transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
