import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'THE WHISKEY RIDERS',
  description: 'Private members portal for Whiskey Riders motorcycle adventures',
  icons: {
    icon: '/6.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-brand-dark-grey text-brand-cream">
        {children}
      </body>
    </html>
  );
}
