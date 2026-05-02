import type { DamageCalcAwakeningBuffs, DamageCalcMonsterStats } from '@/lib/data/damage-calc'
import { applyCasterDebuffs } from '@/lib/damage/v2/stats'
import type { SettingsState } from '../_state/types'

/**
 * PVE awakening quirks (Counteract Strong Enemies) — caster-side debuffs
 * applied to a boss target's `BuffChance` (EFF) and `BuffResist` (RES).
 *
 * The awakening tree ships 8 nodes that emit `monster_eff` / `monster_res`
 * effects with `trigger.requires === 'boss'`:
 *   4 × monster_eff: −4%, −6%, −4%, −6% → total −20%
 *   4 × monster_res: −4%, −6%, −4%, −6% → total −20%
 * (all `appliesTo.kind === 'all'` — apply across every char.)
 *
 * The gameplay flow:
 *   1. The caster's PVE quirks reduce the target boss's EFF/RES by the
 *      summed per-mille amount (additive % points).
 *   2. The reduced RES affects the hit-chance roll for caster debuffs.
 *   3. The reduced EFF lowers the boss's own debuff hit chance against
 *      the caster (less relevant for the calc, but baked into the same
 *      roll).
 *
 * The summing logic mirrors the admin Damage Lab v2 reducer
 * (`monsterEffPermille` / `monsterResPermille` in `applyBuffs`). Application
 * uses the canonical `applyCasterDebuffs` from `src/lib/damage/v2/stats.ts`
 * so the math stays bit-equivalent across both sides.
 */

export interface PveBossDebuffs {
  /** Signed per-mille (e.g. −200 for −20% additive). 0 when no debuff applies. */
  effPermille: number
  resPermille: number
}

/**
 * Compute the per-mille EFF/RES caster debuffs from PVE quirks. Returns
 * zeroes when the PVE toggle is off or the target isn't a boss (the
 * `trigger.requires === 'boss'` gate doesn't fire on regular mobs).
 */
export function computePveBossDebuffs(
  awakening: DamageCalcAwakeningBuffs,
  settings: SettingsState,
  isBoss: boolean,
): PveBossDebuffs {
  if (!settings.quirks.pve || !isBoss) return { effPermille: 0, resPermille: 0 }
  let effPermille = 0
  let resPermille = 0
  for (const b of awakening.buffs) {
    if (b.source.kind !== 'awakening' || b.source.group !== 'PVE') continue
    if (b.trigger.requires !== 'boss') continue
    const e = b.effect
    // Convert % → per-mille so the sum lines up with `applyCasterDebuffs`'s
    // per-mille input. `flat` and `permille` units pass through unchanged.
    const amt = e.unit === '%' ? e.amount * 10 : e.amount
    if (e.target === 'monster_eff') effPermille += amt
    else if (e.target === 'monster_res') resPermille += amt
  }
  return { effPermille, resPermille }
}

/**
 * Apply the PVE caster debuffs to a target stat block. Returns the input
 * unchanged when no debuff applies (referential equality preserved so
 * downstream memoization stays sharp).
 */
export function applyPveDebuffs(stats: DamageCalcMonsterStats, debuffs: PveBossDebuffs): DamageCalcMonsterStats {
  if (debuffs.effPermille === 0 && debuffs.resPermille === 0) return stats
  return applyCasterDebuffs(stats, { eff: debuffs.effPermille, res: debuffs.resPermille })
}
