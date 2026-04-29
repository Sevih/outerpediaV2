/**
 * Monster stat resolution v2 — pure functions for the binary `CalcStat` /
 * `CalcFinalStat` chain (spec v2 §1).
 *
 * Used by the v2 stages and monsters/[id]/stats API routes. Keeps the route
 * handlers thin (they just load tables and assemble the JSON response).
 *
 * ── Pipeline ─────────────────────────────────────────────────────────────
 *   resolveBaseStats(row, level)       — `CalcStat`: lv-interpolated int stats
 *   applyDungeonAdvantage(stats, adv)  — `(1 + sr/1000) × stat` then floor
 *   applyCasterDebuffs(stats, debuffs) — EFF/RES per-mille debuffs (additive)
 *
 * ── Decoding rules (matches v1 — empirically validated) ──────────────────
 *   Per-mille (÷10 → %): CriticalRate, CriticalDMGRate, PiercePowerRate,
 *                        DMGReduceRate, DamageBoost
 *   Flat:                Atk, Def, HP, Speed, BuffChance (EFF), BuffResist (RES)
 *
 * Single-Max stats (`DMGReduceRate_Max`, `DamageBoost_Max`) interpolate from
 * 0 — the binary doesn't store a `_Min` for these.
 */

import { interpolate, applyAdvantageRate } from './f32'

// MonsterTemplet row — string-typed values from the JSON datamine.
export type MonsterRow = Record<string, string>

export interface StatBlock {
  atk: number
  def: number
  hp: number
  spd: number
  /** Critical Chance — % */
  chc: number
  /** Critical Damage — % */
  chd: number
  /** Penetration — % */
  pen: number
  /** Damage Increase — % */
  dmgInc: number
  /** Damage Reduction — % */
  dmgRed: number
  /** Effectiveness — flat */
  eff: number
  /** Resilience — flat */
  res: number
}

/** Per-mille `SpawnAdvantageRate_*` values from `DungeonTemplet`. */
export interface AdvantageRates {
  atk: number
  def: number
  hp: number
  spd: number
}

/** Caster-side EFF/RES debuff per-mille (signed). */
export interface CasterDebuffs {
  /** per-mille on EFF (e.g. −200 = −20%) */
  eff: number
  /** per-mille on RES (e.g. −200 = −20%) */
  res: number
}

// Number parser tolerant of missing/empty fields. Mirrors v1.
function num(v: string | undefined): number {
  if (!v) return 0
  const p = parseInt(v, 10)
  return Number.isFinite(p) ? p : 0
}

/**
 * Interpolate a monster's stat block at the requested level via the binary
 * `CFormula.CalcStat` chain (f32 with `fcvtms` floor toward −∞).
 *
 * No advantage rate, no caster debuffs — those are separate stages.
 *
 * Percent stats decode `permille / 10` AFTER the int interpolation so the
 * stored runtime int permille matches the binary's `get_*` getters at the
 * time of damage computation.
 */
export function resolveBaseStats(row: MonsterRow, level: number): StatBlock {
  const I = (a: number, b: number) => interpolate(a, b, level)
  return {
    atk:    I(num(row.Atk_Min),             num(row.Atk_Max)),
    def:    I(num(row.Def_Min),             num(row.Def_Max)),
    hp:     I(num(row.HP_Min),              num(row.HP_Max)),
    spd:    I(num(row.Speed_Min),           num(row.Speed_Max)),
    eff:    I(num(row.BuffChance_Min),      num(row.BuffChance_Max)),
    res:    I(num(row.BuffResist_Min),      num(row.BuffResist_Max)),
    chc:    I(num(row.CriticalRate_Min),    num(row.CriticalRate_Max))    / 10,
    chd:    I(num(row.CriticalDMGRate_Min), num(row.CriticalDMGRate_Max)) / 10,
    pen:    I(num(row.PiercePowerRate_Min), num(row.PiercePowerRate_Max)) / 10,
    dmgRed: I(0,                            num(row.DMGReduceRate_Max))   / 10,
    dmgInc: I(0,                            num(row.DamageBoost_Max))     / 10,
  }
}

/**
 * Apply per-mille `SpawnAdvantageRate_*` to ATK/DEF/HP/SPD via the binary's
 * `floor(stat × (1 + sr × 0.001))` f32 chain — the runtime int the game's
 * `get_MaxHP` / `get_Def` / `get_Atk` getters return at damage-calc time.
 *
 * Only ATK/DEF/HP/SPD have rate columns in `DungeonTemplet`; EFF/RES/CHC/CHD/
 * PEN/DR/DMG↑ are unaffected by the dungeon table.
 *
 * Returns a new block — no mutation.
 */
export function applyDungeonAdvantage(stats: StatBlock, advantage: AdvantageRates): StatBlock {
  return {
    ...stats,
    atk: applyAdvantageRate(stats.atk, advantage.atk),
    def: applyAdvantageRate(stats.def, advantage.def),
    hp:  applyAdvantageRate(stats.hp,  advantage.hp),
    spd: applyAdvantageRate(stats.spd, advantage.spd),
  }
}

/**
 * Apply caster-side EFF/RES debuffs (per-mille signed). Empirically these
 * stack additively in % points, not multiplicatively (v1 validation: monster
 * 401300101 with 4 PVE nodes summing to −200‰ → 53 × 0.80 = 42.4 → 42).
 *
 * Floors at the end like the in-game UI display.
 *
 * Note: this stage uses f64 arithmetic (NOT the f32 chain) — matches v1
 * behavior. The binary's exact path for caster debuffs is not yet RE'd; if
 * a future obs reveals an f32 shift, switch to `f32mul` here.
 */
export function applyCasterDebuffs(stats: StatBlock, debuffs: CasterDebuffs): StatBlock {
  if (debuffs.eff === 0 && debuffs.res === 0) return stats
  return {
    ...stats,
    eff: Math.floor(stats.eff * (1 + debuffs.eff / 1000)),
    res: Math.floor(stats.res * (1 + debuffs.res / 1000)),
  }
}

// Re-exported so route handlers don't need a separate import for it.
export { num }
