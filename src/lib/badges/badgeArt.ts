import type { BadgeType } from '@/lib/types/database';

/**
 * Symbols a badge patch can carry. Stored in `badges.icon` as `glyph:<key>`;
 * older badges that hold an emoji are matched to a symbol by name instead.
 */
export const BADGE_GLYPHS = [
  { key: 'compass', label: 'Compass' },
  { key: 'crown', label: 'Crown' },
  { key: 'coins', label: 'Coins' },
  { key: 'trophy', label: 'Trophy' },
  { key: 'medal', label: 'Medal' },
  { key: 'star', label: 'Star' },
  { key: 'motorbike', label: 'Motorbike' },
  { key: 'route', label: 'Route' },
  { key: 'mountain', label: 'Mountain' },
  { key: 'globe', label: 'Globe' },
  { key: 'map-pin', label: 'Map pin' },
  { key: 'flag', label: 'Flag' },
  { key: 'gauge', label: 'Speedo' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'wrench', label: 'Wrench' },
  { key: 'flame', label: 'Flame' },
  { key: 'dram', label: 'Dram' },
  { key: 'beer', label: 'Beer' },
  { key: 'camera', label: 'Camera' },
  { key: 'tent', label: 'Tent' },
  { key: 'palm', label: 'Palm' },
  { key: 'anchor', label: 'Anchor' },
  { key: 'swords', label: 'Swords' },
  { key: 'skull', label: 'Skull' },
] as const;

export type BadgeGlyph = (typeof BADGE_GLYPHS)[number]['key'];

export type BadgeShape = 'shield' | 'rosette' | 'roundel';

export interface BadgePalette {
  /** Twill background of the patch */
  face: string;
  /** Darker shade for the shadow and texture */
  faceShade: string;
  /** Outer merrowed border */
  border: string;
  /** Thread colour for the symbol, stitching and text */
  thread: string;
  /** Year banner fill */
  banner: string;
  /** Year banner text */
  bannerText: string;
}

export interface BadgeArt {
  shape: BadgeShape;
  glyph: BadgeGlyph | null;
  /** Shown instead of a glyph for badges that use a custom emoji */
  emoji: string | null;
  palette: BadgePalette;
}

const PALETTES = {
  oxblood: { face: '#5c1a1b', faceShade: '#3d1011', border: '#d9a441', thread: '#f0c46a', banner: '#d9a441', bannerText: '#2a0b0b' },
  forest: { face: '#1f4a32', faceShade: '#123021', border: '#c9a24a', thread: '#e6c878', banner: '#c9a24a', bannerText: '#10261a' },
  whiskey: { face: '#b5621e', faceShade: '#7d3f0f', border: '#f0c46a', thread: '#fff1d0', banner: '#3a1f0c', bannerText: '#f0c46a' },
  navy: { face: '#1c2a44', faceShade: '#111a2c', border: '#c9b98a', thread: '#e8dcb8', banner: '#c9b98a', bannerText: '#141c2e' },
  leather: { face: '#4a3020', faceShade: '#2e1d12', border: '#c9b98a', thread: '#f5f0e8', banner: '#b5621e', bannerText: '#f5f0e8' },
  charcoal: { face: '#26231f', faceShade: '#171512', border: '#b5621e', thread: '#e0a46b', banner: '#b5621e', bannerText: '#f5f0e8' },
  locked: { face: '#211e1b', faceShade: '#171512', border: '#4a423a', thread: '#6e6457', banner: '#3a332c', bannerText: '#8a7f70' },
} satisfies Record<string, BadgePalette>;

export const LOCKED_PALETTE = PALETTES.locked;

const GLYPH_PALETTE: Partial<Record<BadgeGlyph, BadgePalette>> = {
  compass: PALETTES.oxblood,
  crown: PALETTES.oxblood,
  coins: PALETTES.forest,
  trophy: PALETTES.whiskey,
  dram: PALETTES.whiskey,
  medal: PALETTES.whiskey,
};

const TYPE_DEFAULTS: Record<BadgeType, { shape: BadgeShape; glyph: BadgeGlyph; palette: BadgePalette }> = {
  role: { shape: 'shield', glyph: 'compass', palette: PALETTES.navy },
  achievement: { shape: 'rosette', glyph: 'medal', palette: PALETTES.leather },
  trip: { shape: 'roundel', glyph: 'motorbike', palette: PALETTES.charcoal },
};

/** Name keywords → symbol, so existing badges get sensible art without editing. */
const NAME_HINTS: Array<[RegExp, BadgeGlyph]> = [
  [/captain|leader|organi[sz]er|navigator/i, 'compass'],
  [/kitty|treasurer|bank|money|cash/i, 'coins'],
  [/of the year|mvp|champion|winner|legend/i, 'trophy'],
  [/whisk(e)?y|dram|drink|bar ?tab/i, 'dram'],
  [/beer|pub/i, 'beer'],
  [/mechanic|fix|repair|spanner/i, 'wrench'],
  [/crash|spill|down|stack/i, 'flame'],
  [/photo|camera|snap/i, 'camera'],
  [/rookie|first|new ?rider|debut/i, 'star'],
  [/mile|km|distance|long ?haul|iron ?butt/i, 'gauge'],
  [/mountain|pass|peak|summit/i, 'mountain'],
  [/navigat|lost|map/i, 'map-pin'],
  [/camp/i, 'tent'],
  [/island|beach|tropic/i, 'palm'],
  [/king|royal/i, 'crown'],
];

const GLYPH_KEYS = new Set<string>(BADGE_GLYPHS.map((glyph) => glyph.key));

export function isBadgeGlyph(value: string): value is BadgeGlyph {
  return GLYPH_KEYS.has(value);
}

/** Value to store in `badges.icon` for a chosen symbol. */
export function glyphIconValue(glyph: BadgeGlyph): string {
  return `glyph:${glyph}`;
}

/** The generic medal emoji badges were created with; treated as "no icon chosen". */
const PLACEHOLDER_EMOJI = new Set(['🏅', '']);

export function resolveBadgeArt(badge: { name: string; badge_type: BadgeType | string; icon?: string | null }): BadgeArt {
  const type = (badge.badge_type in TYPE_DEFAULTS ? badge.badge_type : 'achievement') as BadgeType;
  const defaults = TYPE_DEFAULTS[type];
  const icon = (badge.icon || '').trim();

  let glyph: BadgeGlyph | null = null;
  let emoji: string | null = null;

  if (icon.startsWith('glyph:') && isBadgeGlyph(icon.slice(6))) {
    glyph = icon.slice(6) as BadgeGlyph;
  } else {
    glyph = NAME_HINTS.find(([pattern]) => pattern.test(badge.name))?.[1] ?? null;
    if (!glyph) {
      if (PLACEHOLDER_EMOJI.has(icon)) glyph = defaults.glyph;
      else emoji = icon;
    }
  }

  return {
    shape: defaults.shape,
    glyph,
    emoji,
    palette: (glyph && GLYPH_PALETTE[glyph]) || defaults.palette,
  };
}

/** Pull a 4-digit year out of a trip name like "Romania 2025". */
export function yearFromTripName(tripName: string | null | undefined): string | null {
  const match = tripName?.match(/(19|20)\d{2}/);
  return match ? match[0] : null;
}
