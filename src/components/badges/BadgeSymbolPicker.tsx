'use client';

import { BadgePatch } from '@/components/badges/BadgePatch';
import { BADGE_GLYPHS, glyphIconValue } from '@/lib/badges/badgeArt';
import { cn } from '@/lib/utils';

/** Stored icon value meaning "pick a symbol from the badge name". */
export const AUTO_BADGE_ICON = '🏅';

interface BadgeSymbolPickerProps {
  value: string;
  onChange: (icon: string) => void;
  name: string;
  badgeType: string;
}

export function BadgeSymbolPicker({ value, onChange, name, badgeType }: BadgeSymbolPickerProps) {
  const options = [
    { icon: AUTO_BADGE_ICON, label: 'Auto (from name)' },
    ...BADGE_GLYPHS.map((glyph) => ({ icon: glyphIconValue(glyph.key), label: glyph.label })),
  ];

  return (
    <div role="radiogroup" aria-label="Badge symbol" className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
      {options.map((option) => {
        const selected = value === option.icon || (option.icon === AUTO_BADGE_ICON && !value);
        return (
          <button
            key={option.icon}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.icon)}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center rounded-md border p-1 transition-colors',
              selected
                ? 'border-brand-brown bg-brand-brown/20'
                : 'border-transparent hover:border-brand-brown/40 hover:bg-brand-black/40'
            )}
          >
            {option.icon === AUTO_BADGE_ICON ? (
              <span className="flex h-10 items-center text-[10px] font-semibold uppercase leading-tight text-brand-cream/70">Auto</span>
            ) : (
              <BadgePatch name={name || option.label} badgeType={badgeType} icon={option.icon} size={34} />
            )}
          </button>
        );
      })}
    </div>
  );
}
