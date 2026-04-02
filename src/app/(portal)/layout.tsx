'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { trackClientActivity } from '@/lib/activity/client';
import { useEffect } from 'react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const isPublicGalleryRoute = pathname === '/gallery' || pathname.startsWith('/gallery/');

  useEffect(() => {
    if (isPublicGalleryRoute) {
      return;
    }

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/login');
      } else {
        setUserEmail(data.session.user.email || '');
        // Fetch user role from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single();
        if (profile) setUserRole(profile.role);
      }
    };
    checkAuth();
  }, [isPublicGalleryRoute, router, supabase]);

  const handleLogout = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    await trackClientActivity({
      action: 'logout',
      entityType: 'auth',
      entityId: 'session',
      entityName: 'Signed out from member portal',
      changes: {
        path: window.location.pathname,
      },
      accessToken: sessionData.session?.access_token,
    });
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isPublicGalleryRoute) {
    return (
      <div className="min-h-full flex flex-col bg-brand-black">
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <TopBar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
          userRole={userRole}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
