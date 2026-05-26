'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TopBar } from '@/components/layout/TopBar';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { Footer } from '@/components/layout/Footer';
import { AdminActivityTracker } from '@/components/admin/AdminActivityTracker';
import { trackClientActivity } from '@/lib/activity/client';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/login');
      } else {
        setUserEmail(data.session.user.email || '');
      }
    };
    checkAuth();
  }, [router, supabase]);

  const handleLogout = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    await trackClientActivity({
      action: 'logout',
      entityType: 'auth',
      entityId: 'session',
      entityName: 'Signed out from admin portal',
      changes: {
        path: window.location.pathname,
      },
      accessToken: sessionData.session?.access_token,
    });
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <TopBar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Admin Sidebar */}
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <AdminActivityTracker />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
