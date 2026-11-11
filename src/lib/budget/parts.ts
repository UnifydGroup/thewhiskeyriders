// Shared maths for budget line items ("parts") stored in trip_budget_categories.notes JSON.
// Used by both the BudgetBuilder UI and the budget summary API so they always agree.

export interface BudgetPartLike {
  basis?: string;          // 'per_person' | 'group'
  amount_aud?: unknown;
  payment_type?: string;   // 'group' | 'personal'
  include_in_member_budget?: boolean;
  /** When set (non-empty), the item only applies to these trip members (user ids).
   *  Missing / null / empty = applies to every member. */
  member_ids?: string[] | null;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** True when the item is attributed to a specific subset of members. */
export function isPartAssigned(part: BudgetPartLike): boolean {
  return Array.isArray(part.member_ids) && part.member_ids.length > 0;
}

/**
 * Members the item applies to, restricted to current trip members.
 * Returns null when the item applies to everyone.
 */
export function getPartMemberIds(part: BudgetPartLike, currentMemberIds: string[]): string[] | null {
  if (!isPartAssigned(part)) return null;
  const current = new Set(currentMemberIds);
  return (part.member_ids as string[]).filter((id) => current.has(id));
}

/** Number of people the item is charged across. */
export function getPartHeadcount(part: BudgetPartLike, currentMemberIds: string[], everyoneCount: number): number {
  const ids = getPartMemberIds(part, currentMemberIds);
  return ids === null ? Math.max(0, everyoneCount) : ids.length;
}

/** Full cost of the item across everyone it applies to. */
export function getPartTotalAud(part: BudgetPartLike, currentMemberIds: string[], everyoneCount: number): number {
  const amount = num(part.amount_aud);
  if (part.basis === 'group') return amount;
  return amount * getPartHeadcount(part, currentMemberIds, everyoneCount);
}

/** What a single member is responsible for from this item (0 if it doesn't apply to them). */
export function getPartShareForMember(
  part: BudgetPartLike,
  memberId: string,
  currentMemberIds: string[],
  everyoneCount: number,
): number {
  const ids = getPartMemberIds(part, currentMemberIds);
  if (ids !== null && !ids.includes(memberId)) return 0;
  const amount = num(part.amount_aud);
  if (part.basis !== 'group') return amount;
  const headcount = ids === null ? everyoneCount : ids.length;
  return headcount > 0 ? amount / headcount : 0;
}

/** Per-person share for an item that applies to everyone (used for projected/average figures). */
export function getPartShareForEveryone(part: BudgetPartLike, everyoneCount: number): number {
  const amount = num(part.amount_aud);
  if (part.basis !== 'group') return amount;
  return everyoneCount > 0 ? amount / everyoneCount : 0;
}
