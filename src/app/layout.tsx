import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'THE WHISKEY RIDERS',
  description: 'Private members portal for Whiskey Riders motorcycle adventures',
  icons: {
    icon: '/6.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-brand-dark-grey text-brand-cream touch-manipulation">
        {children}
      </body>
    </html>
  );
}
