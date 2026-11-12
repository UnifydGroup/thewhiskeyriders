// Per-member budgets: what each member is asked to pay into the group kitty.
// Stored in trip_budget_settings.notes JSON under `member_budgets`. When set for a member,
// it replaces the budget builder's computed kitty share as that member's payment target.

export type MemberBudgetMode = 'per_member' | 'split_total';
export type MemberBudgetSplitMethod = 'equal' | 'builder';

export interface MemberBudgetsConfig {
  /** How the amounts were last produced. */
  mode: MemberBudgetMode;
  /** user_id → AUD amount */
  amounts: Record<string, number>;
  /** The group total that was split (split_total mode only). */
  total_aud: number | null;
  split_method: MemberBudgetSplitMethod | null;
  updated_at: string;
}

export function parseMemberBudgets(notes: unknown): MemberBudgetsConfig | null {
  if (typeof notes !== 'string' || !notes) return null;
  try {
    const raw = (JSON.parse(notes) as Record<string, unknown>)?.member_budgets as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== 'object' || !raw.amounts || typeof raw.amounts !== 'object') return null;
    const amounts: Record<string, number> = {};
    for (const [id, v] of Object.entries(raw.amounts as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) amounts[id] = Math.round(n * 100) / 100;
    }
    if (Object.keys(amounts).length === 0) return null;
    return {
      mode: raw.mode === 'split_total' ? 'split_total' : 'per_member',
      amounts,
      total_aud: Number.isFinite(Number(raw.total_aud)) && raw.total_aud !== null ? Number(raw.total_aud) : null,
      split_method: raw.split_method === 'builder' ? 'builder' : raw.split_method === 'equal' ? 'equal' : null,
      updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : '',
    };
  } catch {
    return null;
  }
}

/**
 * Split a total across members by weight, to the cent, so the parts always add up exactly
 * (largest-remainder rounding). Equal weights when all weights are zero/missing.
 */
export function splitTotal(totalAud: number, memberIds: string[], weights?: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  if (memberIds.length === 0) return result;
  const totalCents = Math.max(0, Math.round(totalAud * 100));
  const w = memberIds.map((id) => Math.max(0, Number(weights?.[id]) || 0));
  const wSum = w.reduce((s, x) => s + x, 0);
  const shares = wSum > 0 ? w.map((x) => x / wSum) : memberIds.map(() => 1 / memberIds.length);
  const raw = shares.map((s) => s * totalCents);
  const floors = raw.map(Math.floor);
  let remainder = totalCents - floors.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => ({ i, frac: r - floors[i] })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  memberIds.forEach((id, i) => { result[id] = floors[i] / 100; });
  return result;
}

/**
 * Remove individual member budgets from a settings.notes blob before it is sent to
 * non-admin viewers, so one member can't see what others have been asked to pay.
 */
export function stripMemberBudgets(notes: unknown): unknown {
  if (typeof notes !== 'string' || !notes) return notes;
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || !('member_budgets' in parsed)) return notes;
    const { member_budgets: _omit, ...rest } = parsed;
    void _omit;
    return JSON.stringify(rest);
  } catch {
    return notes;
  }
}
