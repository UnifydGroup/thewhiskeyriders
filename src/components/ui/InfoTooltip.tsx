'use client';

import { Info } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface InfoTooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Extra classes on the wrapper span */
  className?: string;
}

/**
 * A small ℹ info icon that shows a tooltip on hover.
 * Intended to be placed inline next to labels or headings.
 */
export function InfoTooltip({ content, position = 'top', className = '' }: InfoTooltipProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Tooltip content={content} position={position}>
        <Info className="w-3.5 h-3.5 text-brand-cream/35 hover:text-brand-tan/70 cursor-help transition-colors" />
      </Tooltip>
    </span>
  );
}
