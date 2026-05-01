/**
 * Damage formula v2 — single source of truth for the f32 pipeline.
 *
 * Reverse-engineered from `CFormula.CalcDamage` (VA 0x2B53EC8) and its inner
 * helper `g__CalcDamage|17_0` (VA 0x2B54660). See `damage-lab-v2-spec.md` §1
 * for the validated chain.
 *
 * ── Differences vs v1 (`src/lib/damage/formula.ts`) ──────────────────────
 *  • No `f32arithmetic` toggle — the f32 chain is always on (it's the real
 *    binary path; the f64 path was a debug fallback that never matched obs
 *    on `BT_DMG_TARGET_STAT` cases).
 *  • No `intArithmetic` (per-step floor) toggle — the binary keeps f32
 *    precision throughout the multiplication chain and floors only once at
 *    the end (`frintm` + `fcvtms` + `csinc → max(1, w)`).
 *  • `addAtkNoPool` legacy separate-component path dropped — `BT_DMG_TARGET_STAT`
 *    folds into the rate via `targetStatPermille` (binary-faithful), no
 *    fallback.
 *  • Final floor lives inside the formula — callers receive an int already
 *    clamped to `max(1, floor(dmg))`. v1 left the float to the UI.
 *  • `debugSteps` always produced — caller decides to display or discard.
 *
 * ── Known limit ──────────────────────────────────────────────────────────
 * Skills with `MaxHitCount > 1` (Maxwell S1, Skadi S3, …) drift by ~+0.11%
 * vs in-game (proportional to `1/per_hit_damage`). The single-shot chain is
 * binary-faithful; the multi-hit dispatch lives in `CCharacterBattle.UseSkill`
 * (or an upstream orchestrator) reached only through IL2CPP virtual dispatch
 * — no direct `BL #0x2B53EC8` exists in the binary. See
 * `damage-lab-v2-spec.md` §7.7 for the full investigation.
 *
 * ── Validation pipeline ──────────────────────────────────────────────────
 *   mit          = C / (C + (1 − PEN/100) × DEF − PEN_flat)
 *   rate         = base_pool   (= 1.0 normal, CHD/1000 on crit, − CDR/1000)
 *   rate        += additionalSum   (Σ attacker BT_DMG_* / per-mille)
 *   rate        -= reduceSum        (Σ defender BT_DMG_REDUCE / per-mille)
 *   rate        += DMG_BOOST/1000   (gear stat — already in dmgIncPct)
 *   rate        -= DR/1000           (gear stat — dmgRedPct)
 *   rate         = max(rate, 0.30)   (rateMin from .rodata 0x1034074)
 *
 *   dmg          = ATK × (skillFactor/1000) × (DF/1000) × mit × rate
 *               × (markingActive ? 1.15 : 1.0)
 *               × elem_mult                    (1.20 adv / 0.80 disadv / 1.0)
 *               × (missed ? 0.5 : 1.0)
 *               × (1 − finalReduce/100)        (BT_DMG_REDUCE_FINAL agg MAX)
 *
 *   final        = max(1, floor(dmg))
 *
 * Note: `dmgIncPct` is the caller-aggregated pool (boss +30, Mage +12, adv
 * +50/+30, gear DMG↑, etc.). `targetStatPermille` is the BT_DMG_TARGET_STAT
 * contribution as `trunc(targetStat × val / 1000)`, capped at 1000 inside
 * the formula. `dmgRedPct` is currently the gear DR only; defender BT_DMG_REDUCE
 * buffs (binary types 107/110/145) are not yet extracted (PR 5).
 */

import {
  f, f32mul, f32add, f32sub, f32div, RODATA,
} from './f32'

export type ElemRelation = 'none' | 'adv' | 'disadv'

export interface DamageInputs {
  // Caster identity (informational — formula doesn't branch on these, but the
  // caller pre-aggregates buff effects into `dmgIncPct`/`targetStatPermille`).
  atk: number
  damageFactor: number              // listed DF from CharacterSkillLevelTemplet (per-mille)
  skillFactor?: number              // CSkillManager.GetSkillFactor (per-mille). Default 1000.
  chdPct: number
  penPct: number
  penFlat?: number                  // CCharacterData.get_PiercePower flat. Default 0.
  dmgIncPct: number                 // pre-aggregated pool % (boss + Mage + adv + gear + …)
  crit: boolean
  // Target
  def: number
  cdmgRedPct: number
  dmgRedPct: number
  isBoss: boolean                   // pass-through for caller; formula doesn't branch on it
  elem: ElemRelation
  // Optional pool addition for `BT_DMG_TARGET_STAT` (Noa S2 etc.). Pre-computed
  // by the reducer as `trunc(targetStat × buffValue / 1000)`. Capped at 1000
  // inside the formula before adding to the rate (binary-faithful).
  targetStatPermille?: number
  // Skill-internal sub-attack — fires a separate hit at this DF, full pipeline
  // re-runs (mit + rate + elem + …). Set when the user enables the additional
  // attack toggle in the lab UI for skills like Luna's Barrier.
  additionalAttackDF?: number
  // Conditional multipliers
  markingActive?: boolean           // defender carries BT_MARKING (type 5)
  missed?: boolean                  // SkillRecord.DamageRateType == MISSED (3)
  finalReducePct?: number           // 0..100, MAX of defender BT_DMG_REDUCE_FINAL_*. Default 0.
  // Tunable constants (debug — defaults match binary .rodata)
  C?: number                        // mitigation numerator. Default 1000.
  ratioDivisor?: number             // permille → ratio divisor. Default 1000.
  advMult?: number                  // default `RODATA.ADV` (1.20)
  disadvMult?: number               // default `RODATA.DISADV` (0.80)
  markingMult?: number              // default `RODATA.MARKING` (1.15)
  missedMult?: number               // default `RODATA.MISSED_DAMAGE_RATE` (0.5)
  rateMin?: number                  // default `RODATA.RATE_MIN` (0.30)
}

export interface DebugStep {
  label: string
  value: number
  note?: string
}

export interface DamageQuirk {
  name: string
  value: string
}

export interface DamageBreakdown {
  /** Pool % expressed as `(rate − 1) × 100` — UI display sugar. */
  poolPct: number
  /** Final rate post-cap — what feeds the main mul path. */
  rate: number
  /** Pre-cap rate — `rate !== rateRaw` indicates the cap fired. */
  rateRaw: number
  /** `C / (C + (1−PEN)·DEF − penFlat)`. */
  mitigation: number
  /** 1.20 / 0.80 / 1.00 — element multiplier. */
  elemMult: number
  /** Main hit damage already floored and clamped to `max(1, ...)`. */
  mainCalc: number
  /** Skill-internal additional attack damage (0 when none). */
  additionalCalc: number
  /** `mainCalc + additionalCalc` — the integer surfaced to the UI. */
  calculated: number
  /** Human-readable per-step adjustments (UI breakdown panel). */
  quirks: DamageQuirk[]
  /** Step-by-step f32 trace — always populated. UI shows it on demand. */
  debugSteps: DebugStep[]
}

// Pre-rounded per-mille decoders — used in pool aggregation. Wrapping with
// `f()` here is a no-op (the .rodata literals already match f32 exactly) but
// makes intent explicit and lets a future migration to a different f32
// representation (e.g. typed arrays) preserve the contract.
const PER_MILLE_POS = f(RODATA.PER_MILLE_POS)
const PER_MILLE_NEG = f(RODATA.PER_MILLE_NEG)

export function computeDamage(i: DamageInputs): DamageBreakdown {
  const C            = f(i.C            ?? 1000)
  const ratioDivisor = f(i.ratioDivisor ?? 1000)
  const advMult      = f(i.advMult      ?? RODATA.ADV)
  const disadvMult   = f(i.disadvMult   ?? RODATA.DISADV)
  const markingMult  = f(i.markingMult  ?? RODATA.MARKING)
  const missedMult   = f(i.missedMult   ?? RODATA.MISSED_DAMAGE_RATE)
  const rateMin      = f(i.rateMin      ?? RODATA.RATE_MIN)
  const skillFactor  = f(i.skillFactor  ?? 1000)
  const penFlat      = f(i.penFlat      ?? 0)

  const debugSteps: DebugStep[] = []
  const trace = (label: string, value: number, note?: string): void => {
    debugSteps.push({ label, value, note })
  }
  const quirks: DamageQuirk[] = []

  // ── Rate aggregation (pool) ───────────────────────────────────────────
  // Binary chain (CFormula.CheckDamageRate at VA 0x2B53518):
  //   1. base       = chd × 0.001 if crit else 1.0
  //   2. base      += cdr × −0.001  (subtracted on crit only)
  //   3. base      += additionalSum (Σ attacker BT_DMG_*)
  //   4. base      -= reduceSum     (Σ defender BT_DMG_REDUCE_* — not modeled yet)
  //   5. base      += DMGBoost × 0.001  (in dmgIncPct, folded into additionalSum)
  //   6. base      -= DR × 0.001         (dmgRedPct)
  //   7. base       = max(base, RATE_MIN)
  let rate: number
  if (i.crit) {
    const chdPermille = f32mul(f(i.chdPct), f(10))
    rate = f32mul(chdPermille, PER_MILLE_POS)
    trace('crit base = (chd × 10) × 0.001', rate, `chd ${i.chdPct}%`)
    if (i.cdmgRedPct > 0) {
      const cdrPermille = f32mul(f(i.cdmgRedPct), f(10))
      const cdrContrib  = f32mul(cdrPermille, PER_MILLE_NEG)
      rate = f32add(rate, cdrContrib)
      trace('rate += cdr × −0.001', rate, `cdr ${i.cdmgRedPct}%`)
    }
    quirks.push({ name: 'Crit base', value: `CHD ${i.chdPct.toFixed(1)}% → rate ${rate.toFixed(4)}` })
  } else {
    rate = f(1)
    trace('rate = 1 (non-crit base)', rate)
  }

  // additionalSum = target_stat (capped) + dmgIncPct (pre-aggregated pool %)
  let additionalSum = f(0)
  if (i.targetStatPermille && i.targetStatPermille > 0) {
    const trunc   = Math.trunc(i.targetStatPermille)
    const capped  = Math.min(trunc, RODATA.PERMILLE_CAP)
    const contrib = f32mul(f(capped), PER_MILLE_POS)
    additionalSum = f32add(additionalSum, contrib)
    trace('target_stat contrib', contrib, `permille=${trunc}, capped=${capped}`)
    quirks.push({ name: 'Target-stat pool', value: `+${contrib.toFixed(4)} (permille=${trunc})` })
  }
  if (i.dmgIncPct !== 0) {
    const incPermille = f32mul(f(i.dmgIncPct), f(10))
    const incContrib  = f32mul(incPermille, PER_MILLE_POS)
    additionalSum = f32add(additionalSum, incContrib)
    trace('dmgInc contrib', incContrib, `dmgIncPct ${i.dmgIncPct}%`)
  }
  if (additionalSum !== 0) {
    rate = f32add(rate, additionalSum)
    trace('rate += additionalSum', rate)
  }

  // DR subtraction (gear stat — last in pool).
  if (i.dmgRedPct > 0) {
    const drPermille = f32mul(f(i.dmgRedPct), f(10))
    const drContrib  = f32mul(drPermille, PER_MILLE_NEG)
    rate = f32add(rate, drContrib)
    trace('rate += DR × −0.001', rate, `targetDR ${i.dmgRedPct}%`)
    quirks.push({ name: 'Target DR', value: `−${i.dmgRedPct.toFixed(2)}%` })
  }

  // Cap on Maximum Reduction.
  const rateRaw = rate
  if (rate < rateMin) {
    rate = rateMin
    quirks.push({ name: 'Rate cap', value: `clamped from ${rateRaw.toFixed(3)} to ${rateMin.toFixed(3)}` })
    trace('rate = max(rate, rateMin)', rate, 'cap fired')
  }
  const poolPct = (rate - 1) * 100

  // ── Mitigation ────────────────────────────────────────────────────────
  const pen         = f32div(f(i.penPct), f(100))
  const oneMinusPen = f32sub(f(1), pen)
  const defMul      = f32mul(oneMinusPen, f(i.def))
  const mitDenom    = f32sub(f32add(C, defMul), penFlat)
  const mitigation  = mitDenom > 0 ? f32div(C, mitDenom) : C
  trace('mitigation', mitigation, `denom=${mitDenom.toFixed(3)}`)

  // ── Conditional multipliers ───────────────────────────────────────────
  const elemMult = i.elem === 'adv' ? advMult : i.elem === 'disadv' ? disadvMult : f(1)
  if (i.elem === 'adv')    quirks.push({ name: 'Adv',    value: `×${advMult.toFixed(3)}` })
  if (i.elem === 'disadv') quirks.push({ name: 'Disadv', value: `×${disadvMult.toFixed(3)}` })

  const markingFactor = i.markingActive ? markingMult : f(1)
  if (i.markingActive) quirks.push({ name: 'Marked target', value: `×${markingMult.toFixed(3)}` })

  const missedFactor = i.missed ? missedMult : f(1)
  if (i.missed) quirks.push({ name: 'Missed', value: `×${missedMult}` })

  const finalReducePctClamp = Math.max(0, Math.min(100, i.finalReducePct ?? 0))
  const finalReduceMult = f32sub(f(1), f32div(f(finalReducePctClamp), f(100)))
  if (finalReducePctClamp > 0) {
    quirks.push({ name: 'Final reduce', value: `×${finalReduceMult.toFixed(3)}` })
  }

  if (skillFactor !== f(1000)) quirks.push({ name: 'SkillFactor', value: `×${(skillFactor / 1000).toFixed(3)}` })
  if (penFlat > 0)             quirks.push({ name: 'PEN flat',    value: `−${penFlat.toFixed(0)}` })

  const skillFactorMult = f32div(skillFactor, f(1000))

  // ── Main path ─────────────────────────────────────────────────────────
  // Binary multiplication order (CFormula inner CalcDamage):
  //   s1 = (skillFactor/1000) × ATK
  //   s1 = s1 × (DF/1000)
  //   s0 = s1 × mit
  //   s8 = mod × s0
  //   s9 = s8 × marking
  //   s8 = s9 × elem
  //   s8 = s8 × missed
  //   s8 = s8 × (1 − finalReduce)
  //   return max(1, floor(s8))
  // Single floor at the end (`frintm` + `fcvtms` + `csinc → max(1, w)`).
  const dfRatio = f32div(f(i.damageFactor), ratioDivisor)
  let mc = f(i.atk)
  trace('atk', mc, `input ${i.atk}`)
  mc = f32mul(mc, skillFactorMult);  trace('mc × skillFactor', mc)
  mc = f32mul(mc, dfRatio);          trace('mc × dfRatio', mc, `DF ${i.damageFactor}`)
  mc = f32mul(mc, mitigation);       trace('mc × mit', mc)
  mc = f32mul(mc, rate);             trace('mc × rate', mc, 'pool applied')
  mc = f32mul(mc, markingFactor);    if (markingFactor !== f(1)) trace('mc × marking', mc)
  mc = f32mul(mc, elemMult);         trace('mc × elem', mc, `elem ${i.elem}`)
  mc = f32mul(mc, missedFactor);     if (missedFactor !== f(1)) trace('mc × missed', mc)
  mc = f32mul(mc, finalReduceMult);  if (finalReduceMult !== f(1)) trace('mc × (1−finalReduce)', mc)
  const mainCalc = Math.max(1, Math.floor(mc))
  trace('mainCalc = max(1, floor(mc))', mainCalc)

  // ── Skill-internal additional attack ──────────────────────────────────
  let additionalCalc = 0
  if (i.additionalAttackDF && i.additionalAttackDF > 0) {
    const addDfRatio = f32div(f(i.additionalAttackDF), ratioDivisor)
    let ac = f(i.atk)
    ac = f32mul(ac, skillFactorMult)
    ac = f32mul(ac, addDfRatio)
    ac = f32mul(ac, mitigation)
    ac = f32mul(ac, rate)
    ac = f32mul(ac, markingFactor)
    ac = f32mul(ac, elemMult)
    ac = f32mul(ac, missedFactor)
    ac = f32mul(ac, finalReduceMult)
    additionalCalc = Math.max(1, Math.floor(ac))
    quirks.push({ name: 'Additional attack', value: `+${additionalCalc} (DF=${i.additionalAttackDF})` })
    trace('additionalCalc', additionalCalc)
  }

  const calculated = mainCalc + additionalCalc
  trace('calculated = main + additional', calculated)

  return {
    poolPct,
    rate,
    rateRaw,
    mitigation,
    elemMult,
    mainCalc,
    additionalCalc,
    calculated,
    quirks,
    debugSteps,
  }
}
