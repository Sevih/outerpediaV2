/**
 * Externally-toggleable buffs/debuffs surfaced in the lab UI as click-to-activate
 * stat modifiers. Catalog sourced from `data/effects/{buffs,debuffs}.json`
 * (categories `statBoosts` / `statReduction`) filtered to the stats that feed
 * the damage formula.
 *
 * Each entry carries the canonical game default; the lab UI lets the user
 * override the value per-toggle since different `BuffTemplet` rows in the game
 * share the same name with different numbers (Tamara S3 is OAT_RATE −500 = −50%
 * but other DEF debuffs land at −30%, etc.).
 *
 * Stack model: ADDITIVE on the % side. Two +30% ATK buffs combine to +60%, not
 * 1.30 × 1.30. Mirrors the in-game BT_STAT aggregation (per-mille additions sum
 * into the rate before applying as a single mult).
 *
 * Application formula (in `recompute()`):
 *   - ATK / DEF (raw numeric stats):   stat_eff = stat_base × (1 + Σpct/100)
 *   - PEN / CHC / CHD / EFF (% stats): stat_eff = stat_base + Σpct (additive points)
 */

export type ExternalBuffSide = 'attacker' | 'target'
export type ExternalBuffDirection = 'buff' | 'debuff'
/**
 * `DR` (damage reduction) and `CDMG_RED` (critical damage reduction) are
 * speculative additions — no curated `BuffTemplet` row currently emits them
 * as a stat boost the user would dial in, but reserving the slots lets us
 * surface defensive target-side buffs the moment one shows up in a future
 * patch. The aggregator emits zero sums for them today.
 */
export type ExternalBuffStat = 'ATK' | 'DEF' | 'PEN' | 'CHC' | 'CHD' | 'EFF' | 'DR' | 'CDMG_RED' | 'DMG'

export interface ExternalBuffDef {
  id: string
  side: ExternalBuffSide
  direction: ExternalBuffDirection
  stat: ExternalBuffStat
  label: string
  /** Signed pct: +30 means +30%, −50 means −50%. */
  defaultValue: number
}

export const EXTERNAL_BUFFS: ExternalBuffDef[] = [
  // Attacker buffs (statBoosts on caster)
  { id: 'a-buff-atk', side: 'attacker', direction: 'buff', stat: 'ATK', label: 'Increased Attack',           defaultValue:  30 },
  { id: 'a-buff-def', side: 'attacker', direction: 'buff', stat: 'DEF', label: 'Increased Defense',          defaultValue:  50 },
  { id: 'a-buff-pen', side: 'attacker', direction: 'buff', stat: 'PEN', label: 'Increased Penetration',      defaultValue:  30 },
  { id: 'a-buff-chc', side: 'attacker', direction: 'buff', stat: 'CHC', label: 'Increased Crit Hit Chance',  defaultValue:  50 },
  { id: 'a-buff-chd', side: 'attacker', direction: 'buff', stat: 'CHD', label: 'Increased Critical Damage',  defaultValue:  50 },
  { id: 'a-buff-eff', side: 'attacker', direction: 'buff', stat: 'EFF', label: 'Increased Effectiveness',    defaultValue: 100 },
  // Speculative — see `ExternalBuffStat` doc. Pure additive % bonus on
  // outgoing damage (matches the in-game `DMG_INCREASE` stat convention).
  { id: 'a-buff-dmg', side: 'attacker', direction: 'buff', stat: 'DMG', label: 'Increased Damage',           defaultValue:  30 },
  // Attacker debuffs (statReduction on caster — rare but possible)
  { id: 'a-debuff-atk', side: 'attacker', direction: 'debuff', stat: 'ATK', label: 'Reduced Attack',          defaultValue: -30 },
  { id: 'a-debuff-pen', side: 'attacker', direction: 'debuff', stat: 'PEN', label: 'Reduced Penetration',     defaultValue: -30 },
  { id: 'a-debuff-chc', side: 'attacker', direction: 'debuff', stat: 'CHC', label: 'Reduced Crit Hit Chance', defaultValue: -50 },
  { id: 'a-debuff-chd', side: 'attacker', direction: 'debuff', stat: 'CHD', label: 'Reduced Critical Damage', defaultValue: -50 },
  { id: 'a-debuff-eff', side: 'attacker', direction: 'debuff', stat: 'EFF', label: 'Reduced Effectiveness',   defaultValue: -100 },
  // Target buffs (statBoosts on defender — boss self-buffs)
  { id: 't-buff-def',      side: 'target', direction: 'buff', stat: 'DEF',      label: 'Increased Defense',                  defaultValue: 50 },
  // Speculative defensive buffs — see `ExternalBuffStat` doc. No formula
  // consumer yet; placeholders so the UI ships a slot ready to populate.
  { id: 't-buff-dr',       side: 'target', direction: 'buff', stat: 'DR',       label: 'Increased Damage Reduction',          defaultValue: 30 },
  { id: 't-buff-cdmg-red', side: 'target', direction: 'buff', stat: 'CDMG_RED', label: 'Increased Critical Damage Reduction', defaultValue: 30 },
  // Target debuffs (statReduction on defender — Tamara S3 case)
  { id: 't-debuff-def', side: 'target', direction: 'debuff', stat: 'DEF', label: 'Reduced Defense', defaultValue: -50 },
]

export interface ExternalBuffState {
  active: boolean
  value: number
}

export function makeDefaultExternalBuffsState(): Record<string, ExternalBuffState> {
  const out: Record<string, ExternalBuffState> = {}
  for (const def of EXTERNAL_BUFFS) {
    out[def.id] = { active: false, value: def.defaultValue }
  }
  return out
}

export interface ExternalBuffSums {
  /** pct, applied as `× (1 + sum/100)` on ATK */
  attackerATK: number
  /** pct, applied as `× (1 + sum/100)` on caster ST_DEF (for DEF-scaling chars). */
  attackerDEF: number
  /** pct points, additive on PEN */
  attackerPEN: number
  /** pct points, additive on CHC (extraStats.ST_CRITICAL_RATE) */
  attackerCHC: number
  /** pct points, additive on CHD */
  attackerCHD: number
  /** pct points, additive on EFF (extraStats.ST_BUFF_CHANCE) */
  attackerEFF: number
  /** Speculative — pct points additive on outgoing damage (DMG_INCREASE). */
  attackerDMG: number
  /** pct, applied as `× (1 + sum/100)` on DEF */
  targetDEF: number
  /** Speculative — pct points additive on target damage reduction. */
  targetDR: number
  /** Speculative — pct points additive on target critical damage reduction. */
  targetCDMGRed: number
}

export function aggregateExternalBuffs(
  state: Record<string, ExternalBuffState>,
): ExternalBuffSums {
  const sums: ExternalBuffSums = {
    attackerATK: 0, attackerDEF: 0, attackerPEN: 0, attackerCHC: 0,
    attackerCHD: 0, attackerEFF: 0, attackerDMG: 0,
    targetDEF: 0, targetDR: 0, targetCDMGRed: 0,
  }
  for (const def of EXTERNAL_BUFFS) {
    const s = state[def.id]
    if (!s || !s.active) continue
    const val = s.value
    if (def.side === 'attacker') {
      if (def.stat === 'ATK')      sums.attackerATK += val
      else if (def.stat === 'DEF') sums.attackerDEF += val
      else if (def.stat === 'PEN') sums.attackerPEN += val
      else if (def.stat === 'CHC') sums.attackerCHC += val
      else if (def.stat === 'CHD') sums.attackerCHD += val
      else if (def.stat === 'EFF') sums.attackerEFF += val
      else if (def.stat === 'DMG') sums.attackerDMG += val
    } else {
      if (def.stat === 'DEF')           sums.targetDEF += val
      else if (def.stat === 'DR')       sums.targetDR += val
      else if (def.stat === 'CDMG_RED') sums.targetCDMGRed += val
    }
  }
  return sums
}
