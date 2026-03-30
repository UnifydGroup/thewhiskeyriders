import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Whiskey Riders',
  description: 'Private members portal for Whiskey Riders motorcycle adventures',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-black text-brand-cream">
        {children}
      </body>
    </html>
  );
}
