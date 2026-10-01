import { useId, type ComponentType, type SVGProps } from 'react';
import {
  Anchor,
  Beer,
  Camera,
  Coins,
  Compass,
  Crown,
  Flag,
  Flame,
  Fuel,
  Gauge,
  GlassWater,
  Globe,
  Lock,
  MapPin,
  Medal,
  Motorbike,
  Mountain,
  Route,
  Skull,
  Star,
  Swords,
  Tent,
  TreePalm,
  Trophy,
  Wrench,
} from 'lucide-react';
import { LOCKED_PALETTE, resolveBadgeArt, type BadgeGlyph, type BadgeShape } from '@/lib/badges/badgeArt';
import type { BadgeType } from '@/lib/types/database';
import { cn } from '@/lib/utils';

type GlyphComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;

const GLYPH_COMPONENTS: Record<BadgeGlyph, GlyphComponent> = {
  compass: Compass,
  crown: Crown,
  coins: Coins,
  trophy: Trophy,
  medal: Medal,
  star: Star,
  motorbike: Motorbike,
  route: Route,
  mountain: Mountain,
  globe: Globe,
  'map-pin': MapPin,
  flag: Flag,
  gauge: Gauge,
  fuel: Fuel,
  wrench: Wrench,
  flame: Flame,
  dram: GlassWater,
  beer: Beer,
  camera: Camera,
  tent: Tent,
  palm: TreePalm,
  anchor: Anchor,
  swords: Swords,
  skull: Skull,
};

const CX = 60;
const CY = 56;

function rosettePath() {
  const points: string[] = [];
  const spikes = 16;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? 54 : 47;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    points.push(`${(CX + radius * Math.cos(angle)).toFixed(2)} ${(CY + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}

const SHAPE_PATHS: Record<BadgeShape, string> = {
  shield: 'M60 2 L108 14 V56 C108 88 88 108 60 120 C32 108 12 88 12 56 V14 Z',
  rosette: rosettePath(),
  roundel: `M${CX} ${CY - 54} A54 54 0 1 1 ${CX - 0.01} ${CY - 54} Z`,
};

/** Banner with notched ends, centred horizontally. */
function bannerPath(y: number, width: number, height: number) {
  const left = CX - width / 2;
  const right = CX + width / 2;
  const notch = 6;
  const mid = y + height / 2;
  return `M${left - notch} ${y} H${right + notch} L${right} ${mid} L${right + notch} ${y + height} H${left - notch} L${left} ${mid} Z`;
}

function scaleAround(scale: number) {
  return `translate(${CX} ${CY}) scale(${scale}) translate(${-CX} ${-CY})`;
}

export interface BadgePatchProps {
  name: string;
  badgeType: BadgeType | string;
  icon?: string | null;
  /** Year shown on the banner, e.g. the trip year. */
  year?: string | number | null;
  /** Rendered width in px (height follows the 120×132 artwork). */
  size?: number;
  locked?: boolean;
  className?: string;
}

/**
 * An embroidered motorcycle-club style patch for a badge.
 * Shape follows the badge type (role = shield, achievement = rosette, trip = roundel);
 * symbol and colours come from the badge's icon or name (see resolveBadgeArt).
 */
export function BadgePatch({ name, badgeType, icon, year, size = 96, locked = false, className }: BadgePatchProps) {
  const id = useId().replace(/[:]/g, '');
  const art = resolveBadgeArt({ name, badge_type: badgeType, icon });
  const palette = locked ? LOCKED_PALETTE : art.palette;
  const shapePath = SHAPE_PATHS[art.shape];
  // Below ~56px the year banner is unreadable, so small patches show a bigger symbol instead.
  const compact = size < 56;
  const showBanner = Boolean(year) && !locked && !compact;
  const Glyph = locked ? Lock : art.glyph ? GLYPH_COMPONENTS[art.glyph] : null;
  const glyphSize = compact ? 48 : art.shape === 'shield' ? 40 : 38;
  const glyphY = CY - glyphSize / 2 - (showBanner ? 8 : 2);
  const label = locked ? `${name} (not earned yet)` : year ? `${name}, ${year}` : name;

  return (
    <svg
      viewBox="0 0 120 132"
      width={size}
      height={(size * 132) / 120}
      role="img"
      aria-label={label}
      className={cn('flex-shrink-0 overflow-visible', locked && 'opacity-70', className)}
    >
      <defs>
        <pattern id={`twill-${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill={palette.face} />
          <line x1="0" y1="0" x2="0" y2="4" stroke={palette.faceShade} strokeWidth="1.4" opacity="0.55" />
        </pattern>
        <radialGradient id={`sheen-${id}`} cx="0.35" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {art.shape === 'rosette' && (
        <g>
          <path d="M42 92 L30 128 L40 122 L46 130 L56 98 Z" fill={palette.border} />
          <path d="M78 92 L90 128 L80 122 L74 130 L64 98 Z" fill={palette.border} />
          <path d="M42 92 L30 128 L40 122 L46 130 L56 98 Z" fill="#000" opacity="0.25" />
          <path d="M78 92 L90 128 L80 122 L74 130 L64 98 Z" fill="#000" opacity="0.1" />
        </g>
      )}

      {/* Drop shadow, merrowed border, twill face */}
      <path d={shapePath} fill="#000" opacity="0.45" transform="translate(0 3)" />
      <path d={shapePath} fill={palette.border} />
      <path d={shapePath} fill={`url(#twill-${id})`} transform={scaleAround(0.86)} />
      <path d={shapePath} fill={`url(#sheen-${id})`} transform={scaleAround(0.86)} />

      {/* Running stitch just inside the border */}
      <path
        d={shapePath}
        fill="none"
        stroke={palette.thread}
        strokeWidth={1.5 / 0.78}
        strokeDasharray="4 3"
        strokeLinecap="round"
        opacity="0.8"
        transform={scaleAround(0.78)}
      />

      {Glyph ? (
        <Glyph
          x={CX - glyphSize / 2}
          y={glyphY}
          width={glyphSize}
          height={glyphSize}
          color={palette.thread}
          strokeWidth={2.1}
          aria-hidden
        />
      ) : art.emoji ? (
        <text x={CX} y={glyphY + glyphSize * 0.8} textAnchor="middle" fontSize="36" aria-hidden>
          {art.emoji}
        </text>
      ) : null}

      {showBanner && (
        <g>
          <path d={bannerPath(78, 52, 18)} fill="#000" opacity="0.35" transform="translate(0 2)" />
          <path d={bannerPath(78, 52, 18)} fill={palette.banner} />
          <path
            d={`M${CX - 24} 81 H${CX + 24} M${CX - 24} 93 H${CX + 24}`}
            stroke={palette.bannerText}
            strokeWidth="0.8"
            strokeDasharray="2.5 2"
            opacity="0.45"
          />
          <text
            x={CX}
            y={91.5}
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="800"
            letterSpacing="1.5"
            fill={palette.bannerText}
            style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          >
            {year}
          </text>
        </g>
      )}
    </svg>
  );
}
