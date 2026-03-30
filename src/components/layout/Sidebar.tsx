'use client';

import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Bike,
  Users,
  Image,
  User,
  X,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { Button } from '@/components/ui/Button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trips', label: 'Trips', icon: Bike },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/gallery', label: 'Gallery', icon: Image },
];

export function Sidebar({ isOpen, onClose, onLogout }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed left-0 top-0 h-full w-64 surface-dark border-r border-brand-brown/20 z-50 lg:static lg:z-auto',
          'transform transition-transform lg:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col overflow-y-auto p-4">
          {/* Close button for mobile */}
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <span className="font-bold text-brand-cream">Menu</span>
            <button
              onClick={onClose}
              className="text-brand-cream/60 hover:text-brand-cream transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-brand-brown text-brand-black font-semibold'
                      : 'text-brand-cream hover:bg-brand-dark-grey/50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout button */}
          <Button
            variant="ghost"
            size="md"
            onClick={onLogout}
            className="w-full justify-start gap-3"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
