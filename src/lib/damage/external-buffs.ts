/**
 * Toggleable buffs/debuffs surfaced in the damage-lab UI as click-to-activate
 * stat modifiers. Sourced from `data/effects/{buffs,debuffs}.json` (categories
 * `statBoosts` / `statReduction`) filtered to the stats that actually feed the
 * damage formula.
 *
 * Each entry carries the canonical game default (e.g. +30% ATK, +50% DEF) but
 * the lab UI lets the user override the value per-toggle since different
 * `BuffTemplet` rows in the game share the same name with different numbers
 * (Tamara S3 is OAT_RATE −500 = −50% but other DEF debuffs land at −30%, etc.).
 *
 * Stack model: ADDITIVE on the % side. Two +30% ATK buffs combine to +60%, not
 * 1.30 × 1.30. Mirrors the in-game BT_STAT aggregation behavior (per-mille
 * additions sum into the rate before applying as a single mult).
 *
 * Application formula (in `recompute()`):
 *   - ATK / DEF (raw numeric stats):   stat_eff = stat_base × (1 + Σpct/100)
 *   - PEN / CHC / CHD / EFF (% stats): stat_eff = stat_base + Σpct (additive points)
 */

export type ExternalBuffSide = 'attacker' | 'target'
export type ExternalBuffDirection = 'buff' | 'debuff'
export type ExternalBuffStat = 'ATK' | 'DEF' | 'PEN' | 'CHC' | 'CHD' | 'EFF'

export interface ExternalBuffDef {
  id: string
  side: ExternalBuffSide
  direction: ExternalBuffDirection
  stat: ExternalBuffStat
  label: string
  defaultValue: number   // signed pct: +30 means +30%, −50 means −50%
}

export const EXTERNAL_BUFFS: ExternalBuffDef[] = [
  // ── Attacker buffs (statBoosts on caster) ───────────────────────────────
  { id: 'a-buff-atk', side: 'attacker', direction: 'buff', stat: 'ATK', label: 'Increased Attack',           defaultValue:  30 },
  { id: 'a-buff-pen', side: 'attacker', direction: 'buff', stat: 'PEN', label: 'Increased Penetration',      defaultValue:  30 },
  { id: 'a-buff-chc', side: 'attacker', direction: 'buff', stat: 'CHC', label: 'Increased Crit Hit Chance',  defaultValue:  50 },
  { id: 'a-buff-chd', side: 'attacker', direction: 'buff', stat: 'CHD', label: 'Increased Critical Damage',  defaultValue:  50 },
  { id: 'a-buff-eff', side: 'attacker', direction: 'buff', stat: 'EFF', label: 'Increased Effectiveness',    defaultValue: 100 },

  // ── Attacker debuffs (statReduction on caster — rare but possible) ──────
  { id: 'a-debuff-atk', side: 'attacker', direction: 'debuff', stat: 'ATK', label: 'Reduced Attack',          defaultValue: -30 },
  { id: 'a-debuff-pen', side: 'attacker', direction: 'debuff', stat: 'PEN', label: 'Reduced Penetration',     defaultValue: -30 },
  { id: 'a-debuff-chc', side: 'attacker', direction: 'debuff', stat: 'CHC', label: 'Reduced Crit Hit Chance', defaultValue: -50 },
  { id: 'a-debuff-chd', side: 'attacker', direction: 'debuff', stat: 'CHD', label: 'Reduced Critical Damage', defaultValue: -50 },
  { id: 'a-debuff-eff', side: 'attacker', direction: 'debuff', stat: 'EFF', label: 'Reduced Effectiveness',   defaultValue: -100 },

  // ── Target buffs (statBoosts on defender — boss self-buffs) ─────────────
  { id: 't-buff-def', side: 'target', direction: 'buff', stat: 'DEF', label: 'Increased Defense', defaultValue: 50 },

  // ── Target debuffs (statReduction on defender — Tamara S3 case) ─────────
  { id: 't-debuff-def', side: 'target', direction: 'debuff', stat: 'DEF', label: 'Reduced Defense', defaultValue: -50 },
]

// Per-toggle UI state — the lab persists active flag + value so the user's
// edits survive recomputes / navigation between obs.
export interface ExternalBuffState {
  active: boolean
  value: number
}

// Build a fresh "everything off, defaults loaded" state map keyed by buff id.
export function makeDefaultExternalBuffsState(): Record<string, ExternalBuffState> {
  const out: Record<string, ExternalBuffState> = {}
  for (const def of EXTERNAL_BUFFS) {
    out[def.id] = { active: false, value: def.defaultValue }
  }
  return out
}

// Aggregate active buffs into per-stat sums (signed pct). Used by `recompute()`
// to apply the combined effect on the input stats before the formula runs.
export interface ExternalBuffSums {
  attackerATK: number  // pct, applied as × (1 + sum/100) on ATK
  attackerPEN: number  // pct points, additive on PEN
  attackerCHC: number  // pct points, additive on CHC (extraStats.ST_CRITICAL_RATE)
  attackerCHD: number  // pct points, additive on CHD
  attackerEFF: number  // pct points, additive on EFF (extraStats.ST_BUFF_CHANCE)
  targetDEF: number    // pct, applied as × (1 + sum/100) on DEF
}

export function aggregateExternalBuffs(
  state: Record<string, ExternalBuffState>
): ExternalBuffSums {
  const sums: ExternalBuffSums = {
    attackerATK: 0, attackerPEN: 0, attackerCHC: 0,
    attackerCHD: 0, attackerEFF: 0, targetDEF: 0,
  }
  for (const def of EXTERNAL_BUFFS) {
    const s = state[def.id]
    if (!s || !s.active) continue
    const val = s.value
    if (def.side === 'attacker') {
      if (def.stat === 'ATK') sums.attackerATK += val
      else if (def.stat === 'PEN') sums.attackerPEN += val
      else if (def.stat === 'CHC') sums.attackerCHC += val
      else if (def.stat === 'CHD') sums.attackerCHD += val
      else if (def.stat === 'EFF') sums.attackerEFF += val
    } else {
      if (def.stat === 'DEF') sums.targetDEF += val
    }
  }
  return sums
}
