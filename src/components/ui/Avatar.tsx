import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import React from 'react';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Avatar({ src, alt, size = 'md', className, ...props }: AvatarProps) {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-24 h-24 text-lg',
  };

  const initials = getInitials(alt);

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold overflow-hidden bg-brand-brown/20 border border-brand-brown/40 flex-shrink-0',
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
        />
      ) : (
        <span className="text-brand-brown">{initials}</span>
      )}
    </div>
  );
}
