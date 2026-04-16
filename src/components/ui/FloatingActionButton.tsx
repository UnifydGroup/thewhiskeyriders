import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface FloatingActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function FloatingActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'primary',
  className,
}: FloatingActionButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900',
        variantClasses[variant],
        className
      )}
      aria-label={label}
    >
      <Icon className="w-6 h-6" />
    </button>
  );
}
