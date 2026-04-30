/**
 * Monster stat resolution v2 — pure functions for the binary `CalcStat` /
 * `CalcFinalStat` chain (spec v2 §1).
 *
 * Used by the v2 stages and monsters/[id]/stats API routes. Keeps the route
 * handlers thin (they just load tables and assemble the JSON response).
 *
 * ── Pipeline ─────────────────────────────────────────────────────────────
 *   resolveDungeonStats(row, lvl, adv) — `CalcStat` + dungeon rate in a single
 *                                        f32 chain (one floor at the end)
 *   resolveBaseStats(row, level)       — `CalcStat`-only int stats (no rate)
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

import { interpolate, interpolateRated } from './f32'

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
 * Resolve a monster's stat block at level WITH the dungeon's per-mille
 * `SpawnAdvantageRate_*` already applied. Uses `interpolateRated` so the
 * level-interpolation and rate-multiplication share a single f32 chain with
 * one floor at the end — matches the binary `get_MaxHP` / `get_Def` /
 * `get_Atk` exactly (the two-step `interpolate → applyAdvantageRate` flow
 * floored twice and was off by 1 in edge cases like Ars Nova St1 lv 25).
 *
 * Only ATK/DEF/HP/SPD have rate columns in `DungeonTemplet`; EFF/RES and the
 * percent stats (CHC/CHD/PEN/DR/DMG↑) are unaffected by the dungeon table.
 *
 * Returns a new block — no mutation.
 */
export function resolveDungeonStats(row: MonsterRow, level: number, advantage: AdvantageRates): StatBlock {
  const I = (a: number, b: number) => interpolate(a, b, level)
  return {
    atk:    interpolateRated(num(row.Atk_Min),    num(row.Atk_Max),    level, advantage.atk),
    def:    interpolateRated(num(row.Def_Min),    num(row.Def_Max),    level, advantage.def),
    hp:     interpolateRated(num(row.HP_Min),     num(row.HP_Max),     level, advantage.hp),
    spd:    interpolateRated(num(row.Speed_Min),  num(row.Speed_Max),  level, advantage.spd),
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
