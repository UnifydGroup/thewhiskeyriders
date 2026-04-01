export const APPAREL_SIZES = ['Small', 'Medium', 'Large', 'XL', '2XL', '3XL'] as const;

export type ApparelSize = (typeof APPAREL_SIZES)[number];
