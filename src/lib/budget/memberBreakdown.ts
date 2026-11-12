// Per-member view of the budget builder: which categories and line items apply to a
// member and what their share of each is. Uses the live member list (same as the summary API).

import { getPartShareForMember, isPartAssigned, type BudgetPartLike } from './parts';

export interface CategoryLike {
  id: string;
  name: string;
  color: string;
  planned_aud: number;
  notes: string | null;
}

export interface MemberLineItem {
  id: string;
  name: string;
  share_aud: number;
  payment_type: 'group' | 'personal';
  /** false = group item covered separately (e.g. bank interest), not billed to members */
  billed: boolean;
  /** Attributed to a subset of members rather than everyone */
  assigned: boolean;
  basis: 'per_person' | 'group';
}

export interface MemberCategoryBreakdown {
  id: string;
  name: string;
  color: string;
  items: MemberLineItem[];
  kitty_aud: number;     // billed group-kitty items
  personal_aud: number;  // self-funded items
}

interface StoredPart extends BudgetPartLike {
  id?: string;
  name?: string;
}

function readParts(cat: CategoryLike): StoredPart[] {
  if (cat.notes) {
    try {
      const parsed = JSON.parse(cat.notes) as { parts?: unknown };
      if (parsed && Array.isArray(parsed.parts) && parsed.parts.length > 0) return parsed.parts as StoredPart[];
    } catch { /* plain-text notes */ }
  }
  // Legacy category without line items: whole planned amount is a shared kitty cost
  return [{ id: `${cat.id}-planned`, name: cat.name, basis: 'group', amount_aud: Number(cat.planned_aud) || 0, payment_type: 'group' }];
}

export function getMemberBreakdown(
  categories: CategoryLike[],
  memberId: string,
  memberIds: string[],
): MemberCategoryBreakdown[] {
  const everyone = Math.max(1, memberIds.length);
  const out: MemberCategoryBreakdown[] = [];
  for (const cat of categories) {
    const items: MemberLineItem[] = [];
    for (const [i, part] of readParts(cat).entries()) {
      const share = getPartShareForMember(part, memberId, memberIds, everyone);
      if (share <= 0) continue;
      const isPersonal = part.payment_type === 'personal';
      items.push({
        id: part.id || `${cat.id}-${i}`,
        name: (part.name || '').trim() || 'Unnamed item',
        share_aud: Math.round(share * 100) / 100,
        payment_type: isPersonal ? 'personal' : 'group',
        billed: isPersonal || part.include_in_member_budget !== false,
        assigned: isPartAssigned(part),
        basis: part.basis === 'group' ? 'group' : 'per_person',
      });
    }
    if (items.length === 0) continue;
    out.push({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      items,
      kitty_aud: items.filter((x) => x.payment_type === 'group' && x.billed).reduce((s, x) => s + x.share_aud, 0),
      personal_aud: items.filter((x) => x.payment_type === 'personal').reduce((s, x) => s + x.share_aud, 0),
    });
  }
  return out;
}
