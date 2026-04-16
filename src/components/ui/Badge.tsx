import { cn } from '@/lib/utils';
import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
}

export function Badge({ className, variant = 'primary', ...props }: BadgeProps) {
  const variantStyles = {
    primary: 'bg-brand-brown text-brand-black',
    secondary: 'bg-brand-tan text-brand-black',
    success: 'bg-green-900 text-green-100',
    warning: 'bg-yellow-900 text-yellow-100',
    danger: 'bg-red-900 text-red-100',
    outline: 'border border-brand-brown text-brand-brown bg-transparent',
  };

  return (
    <span
      className={cn(
        'px-3 py-1 text-xs font-semibold rounded-full inline-block',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
