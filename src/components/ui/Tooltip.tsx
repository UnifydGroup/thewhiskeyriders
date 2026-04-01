import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = React.useState<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full border-t-gray-800 border-r-transparent border-b-transparent border-l-transparent',
    bottom: 'bottom-full border-b-gray-800 border-r-transparent border-t-transparent border-l-transparent',
    left: 'left-full border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 text-sm text-gray-100 bg-gray-800 rounded-lg whitespace-nowrap',
            'shadow-lg border border-gray-700',
            'animate-in fade-in zoom-in-75 duration-200',
            positionClasses[position]
          )}
        >
          {content}
          <div
            className={cn(
              'absolute w-2 h-2 bg-gray-800 border-2 border-gray-700',
              'transform rotate-45',
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
