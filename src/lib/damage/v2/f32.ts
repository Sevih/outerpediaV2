/**
 * f32 utilities — ARM-faithful arithmetic primitives shared across the v2
 * pipeline (formula, recompute, stats APIs).
 *
 * Mirrors the binary's `Math.fround` chain so the TypeScript pipeline matches
 * `CFormula.CalcDamage` / `CalcStat` / `CalcFinalStat` bit-for-bit. See
 * `damage-lab-v2-spec.md` §1 for the validated chain and constants.
 *
 * The binary uses ARM single-precision FPU registers (s0..s31) — every f32
 * `*`/`+`/`-`/`/` rounds to IEEE 754 single precision. Wrapping every step
 * with `Math.fround` reproduces this exactly.
 */

// ── Binary .rodata constants ──────────────────────────────────────────
// Each value is the exact f64 expansion of the f32 bit pattern at the given
// virtual address in `libil2cpp.so`. Verified via Capstone disasm.
//
// `Math.fround(literal)` returns the same double back since the literal is
// already at f32 precision in f64 — but we still wrap critical operations
// with `f()` to match the binary's per-op rounding semantics.
export const RODATA = {
  /** −0.001f — per-mille decoder for negative additions (DR, CDR, BT_DMG_REDUCE). VA 0x1033D78. */
  PER_MILLE_NEG: -0.0010000000474974513,
  /** +0.001f — per-mille decoder for positive additions (CHD, BT_DMG, target_stat). VA 0x1034038. */
  PER_MILLE_POS:  0.0010000000474974513,
  /** 1.15f — BT_MARKING multiplier. VA 0x1034064. */
  MARKING:   1.149999976158142,
  /** 0.30f — rateMin, the "Cap on Maximum Reduction" floor (max −70% damage). VA 0x1034074. */
  RATE_MIN:  0.30000001192092896,
  /** 1.20f — element advantage multiplier. VA 0x1033E70. */
  ADV:       1.2000000476837158,
  /** 0.80f — element disadvantage multiplier. VA 0x1033E14. */
  DISADV:    0.800000011920929,
  /** 0.5 — MISSED_DAMAGE_RATE (GameConfigTemplet val 500‰). */
  MISSED_DAMAGE_RATE: 0.5,
  /** 99.0f — divisor for level interpolation (CFormula.CalcStat span lv 1..100). */
  LEVEL_INTERP_DIVISOR: 99,
  /** 1000.0f — cap on `BT_DMG_TARGET_STAT` permille contributions before adding to rate. */
  PERMILLE_CAP: 1000,
} as const

// ── Arithmetic helpers ────────────────────────────────────────────────
// `f` is the canonical alias for `Math.fround`. The 4 operator helpers wrap
// each binary op to match the binary's per-instruction rounding.

export const f = Math.fround

export function f32mul(a: number, b: number): number { return Math.fround(a * b) }
export function f32add(a: number, b: number): number { return Math.fround(a + b) }
export function f32sub(a: number, b: number): number { return Math.fround(a - b) }
export function f32div(a: number, b: number): number { return Math.fround(a / b) }

// ── Stat interpolation primitives ─────────────────────────────────────

/**
 * Level interpolation — mirrors `CFormula.CalcStat` (binary VA 0x2B52D24).
 *
 * Stats scale as `min + (max − min) × (level − 1) / 99`, then floor toward −∞
 * (`fcvtms`). Returns the runtime int the binary's `get_*` getters return.
 *
 * No upper cap on level: extrapolation past lv 100 is intentional (Joint
 * Challenge content spawns monsters at lv 120+, the linear formula remains
 * empirically correct). Callers that want a cap clamp `level` upfront.
 */
export function interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  const diff = Math.fround(max - min)
  const div  = Math.fround(diff / Math.fround(RODATA.LEVEL_INTERP_DIVISOR))
  const mul  = Math.fround(div * Math.fround(level - 1))
  const sum  = Math.fround(mul + Math.fround(min))
  return Math.floor(sum)
}

/**
 * Apply per-mille `SpawnAdvantageRate` to a stat — mirrors the binary
 * `get_MaxHP` / `get_Def` / `get_Atk` chain (`floor(stat × (1 + sr × 0.001))`).
 *
 * `ratePermille` is signed (e.g. −574 for −57.4% HP scaling on raid bosses).
 * Returns the runtime int the binary's getters return at the time of damage
 * calculation — single source of truth for `BT_DMG_TARGET_STAT` reads.
 *
 * Validated: Amadeus St2 lv 30 with HP rate −574 →
 *   floor(0.426 × 52707) = 22453, exactly what `BT_DMG_TARGET_STAT` reads.
 */
export function applyAdvantageRate(stat: number, ratePermille: number): number {
  if (ratePermille === 0) return stat
  const rate = Math.fround(Math.fround(1) + Math.fround(ratePermille) * Math.fround(RODATA.PER_MILLE_POS))
  return Math.floor(Math.fround(rate * stat))
}

/**
 * Combined `interpolate + applyAdvantageRate` with a SINGLE floor at the end.
 *
 * The binary's `get_MaxHP` / `get_Def` / `get_Atk` keep f32 precision between
 * the level-interpolation step and the dungeon-rate multiplication, flooring
 * only once when emitting the int the rest of the engine consumes. Calling
 * `applyAdvantageRate(interpolate(...), rate)` floors twice, occasionally
 * producing a value 1 lower than what the game shows (Ars Nova St1 lv 25 HP
 * rate −616: 14352 in-game vs 14351 with double-floor).
 *
 * Use this helper for the auto-filled stat block surfaced to the lab and for
 * stat readouts consumed by `BT_DMG_TARGET_STAT` — anywhere the value must
 * match the binary's `get_*` getters bit-exact.
 */
export function interpolateRated(min: number, max: number, level: number, ratePermille: number): number {
  if (level <= 1) {
    return ratePermille === 0 ? min : applyAdvantageRate(min, ratePermille)
  }
  // Binary-faithful inner chain — same as `interpolate` but skipping the
  // final `Math.floor` so we keep the f32 fraction for the rate multiplication.
  const diff = Math.fround(max - min)
  const div  = Math.fround(diff / Math.fround(RODATA.LEVEL_INTERP_DIVISOR))
  const mul  = Math.fround(div * Math.fround(level - 1))
  const sumF32 = Math.fround(mul + Math.fround(min))
  if (ratePermille === 0) return Math.floor(sumF32)
  const rate = Math.fround(Math.fround(1) + Math.fround(ratePermille) * Math.fround(RODATA.PER_MILLE_POS))
  return Math.floor(Math.fround(rate * sumF32))
}
