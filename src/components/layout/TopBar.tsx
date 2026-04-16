import { Menu, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

interface TopBarProps {
  onMenuClick?: () => void;
  userEmail?: string;
  onLogout?: () => void;
}

export function TopBar({ onMenuClick, userEmail, onLogout }: TopBarProps) {
  return (
    <div className="border-b border-brand-brown/20 bg-brand-black/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-brand-cream hover:text-brand-brown transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/5.png" alt="Whiskey Riders Logo" width={32} height={32} />
            <span className="font-bold text-brand-cream hidden sm:inline">Whiskey Riders</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-sm text-brand-cream/70 hidden sm:inline truncate">
              {userEmail}
            </span>
          )}
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
