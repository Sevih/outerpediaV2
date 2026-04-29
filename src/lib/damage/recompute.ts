/**
 * Single recompute pipeline for the damage-lab.
 *
 * Both the live calc panel and the obs-table recompute flow through
 * `recompute()`. Inputs are the raw user-typed values (no buff augmentation,
 * no scaling pre-applied); the function applies live buffs via the unified
 * reducer (`applyBuffs`) and feeds `computeDamage` for the final number.
 *
 * Anything that affects damage MUST go through this function — no inline
 * formula math elsewhere.
 */
import { computeDamage, type DamageBreakdown } from './formula'
import { applyBuffs, type ApplicableBuff, type BuffContext, type ReducedBuffs } from './buffs'
import { getCharOverride, type CharFlags } from './char-overrides'
import {
  aggregateExternalBuffs,
  type ExternalBuffState,
  type ExternalBuffSums,
} from './external-buffs'
import {
  aggregateBossMechanics,
  getBossOverride,
  type BossMechanicState,
} from './boss-overrides'

export type SlotTag = 'S1' | 'S2' | 'S3'
export type ElemRelation = 'none' | 'adv' | 'disadv'
export type { CharFlags }

// Outerplane element relations.
//   Fire > Earth > Water > Fire (rock-paper-scissors trio).
//   Light ↔ Dark mutual advantage — both directions resolve to 'adv'.
const ELEMENT_ADV: Record<string, string> = {
  Fire: 'Earth', Earth: 'Water', Water: 'Fire',
  Light: 'Dark', Dark: 'Light',
}
export function detectElementRelation(attacker: string, target: string): ElemRelation {
  if (!attacker || !target || attacker === target) return 'none'
  if (ELEMENT_ADV[attacker] === target) return 'adv'
  if (ELEMENT_ADV[target] === attacker) return 'disadv'
  return 'none'
}

// Mode strings that gate the paid Adventure License awakening tier.
export function isAdventureLicenseMode(mode: string | undefined): boolean {
  return mode === 'DM_ADVENTURE_MISSION' || mode === 'DM_ADVENTURE_CHALLENGE'
}

export interface RecomputeContext {
  // Caster identity — drives buff filtering (appliesTo) + AdvLicense gate.
  charId: string
  charElement: string
  charClass: string
  charSubclass: string
  // Skill
  slot: SlotTag
  damageFactor: number
  additionalAttackRatio?: number   // present only when the user toggled additional-attack on
  // Caster inputs — user-typed values that feed the formula directly.
  // No buff augmentation, no scaling pre-applied — the reducer handles both.
  atk: number
  chd: number
  pen: number
  dmgInc: number
  applyQuirks: boolean
  extraStats?: Record<string, number>   // ST_* → numeric, for secondary scaling (Stella HP, Regina CHC)
  // Target inputs — also user-fed (auto mode prefills from monster API).
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  // Target HP — needed for BT_DMG_TARGET_STAT scaling (e.g. Noa S2 +3% × HP sub-attack).
  // Optional: most chars don't have target-stat scaling; the reducer defaults to 0
  // if a `scaling_target_stat` buff fires without a value here.
  targetHp?: number
  isBoss: boolean
  elem: ElemRelation
  // Crit flag (separate from elem because both are independent gates).
  crit: boolean
  // Mode — for AdvLicense gating. Pass the raw DungeonMode string.
  mode?: string
  // UI-fed flags that gate per-char hardcoded overrides (see `char-overrides.ts`).
  // Example: Ame's `umeSakuraActive` toggles the S1 additional-hit ratio.
  charFlags?: CharFlags
  // Formula constants (tunable in the UI).
  C?: number
  ratioDivisor?: number
  // Opt-in to ARM f32 emulation (Math.fround at every step) + binary-faithful
  // target-stat pool addition. Closes the residual on Noa S2 obs from ±0.12%
  // to within rounding noise. Safe default off (legacy f64 path).
  f32arithmetic?: boolean
  // Capture every f32 intermediate value for the lab debug panel.
  debugSteps?: boolean
  // Click-toggleable buffs/debuffs surfaced in the lab UI (Tamara S3 break-DEF,
  // generic +ATK / +CHD / etc.). Map keyed by ExternalBuffDef.id; entries with
  // `active=false` are ignored. See `external-buffs.ts` for the catalog.
  externalBuffs?: Record<string, ExternalBuffState>
  // Boss-specific damage-taken multipliers — Amadeus's Prelude / Enrage etc.
  // Multiplied onto the final damage value after all standard formula stages.
  // The lab UI surfaces this only when the selected target matches a known
  // boss prefix (see `boss-overrides.ts`). Identifies which boss override is
  // active via `monsterId`.
  monsterId?: string
  bossMechanics?: Record<string, BossMechanicState>
}

export interface RecomputeResult {
  calculated: number
  breakdown: DamageBreakdown
  reduced: ReducedBuffs
}

export function recompute(ctx: RecomputeContext, allBuffs: ApplicableBuff[]): RecomputeResult {
  // ── External buff/debuff aggregation (lab UI toggles) ──────────────────
  // Apply user-toggled BT_STAT-style buffs to the input stats BEFORE feeding
  // the formula: ATK / DEF use multiplicative `× (1 + Σpct/100)`, % stats
  // (PEN / CHC / CHD / EFF) use additive points. Sums combine all active
  // toggles (additive on the % side — mirrors in-game BT_STAT aggregation).
  const extSums: ExternalBuffSums = ctx.externalBuffs
    ? aggregateExternalBuffs(ctx.externalBuffs)
    : { attackerATK: 0, attackerPEN: 0, attackerCHC: 0, attackerCHD: 0, attackerEFF: 0, targetDEF: 0 }

  const effAtk = ctx.atk * (1 + extSums.attackerATK / 100)
  const effPen = ctx.pen + extSums.attackerPEN
  const effChd = ctx.chd + extSums.attackerCHD
  const effTargetDef = ctx.targetDef * (1 + extSums.targetDEF / 100)

  // statValues — feed the reducer's scaling math (BT_DMG_OWNER_STAT, BT_SWAP_STAT_ATTACK).
  // ST_ATK is the user-typed primary ATK (post-buff); other stats from `extraStats`,
  // augmented with EFF/CHC additive contributions when those toggles are active.
  const statValues: Record<string, number> = { ST_ATK: effAtk }
  if (ctx.extraStats) {
    for (const [k, v] of Object.entries(ctx.extraStats)) statValues[k] = v
  }
  if (extSums.attackerEFF !== 0) {
    statValues.ST_BUFF_CHANCE = (statValues.ST_BUFF_CHANCE ?? 0) + extSums.attackerEFF
  }
  if (extSums.attackerCHC !== 0) {
    statValues.ST_CRITICAL_RATE = (statValues.ST_CRITICAL_RATE ?? 0) + extSums.attackerCHC
  }

  // Target stats — fed to the reducer for `scaling_target_stat` buffs
  // (BT_DMG_TARGET_STAT). Currently only ST_HP is wired since that's the only
  // empirically-validated target stat (Noa S2). Add ST_DEF / ST_SPD here if a
  // future char scales on those.
  const targetStatValues: Record<string, number> = {}
  if (ctx.targetHp != null) targetStatValues.ST_HP = ctx.targetHp
  if (effTargetDef != null) targetStatValues.ST_DEF = effTargetDef

  const buffCtx: BuffContext = {
    charId: ctx.charId,
    charElement: ctx.charElement,
    charClass: ctx.charClass,
    charSubclass: ctx.charSubclass.toUpperCase(),
    slot: ctx.slot,
    isBoss: ctx.isBoss,
    crit: ctx.crit,
    elem: ctx.elem,
    applyQuirks: ctx.applyQuirks,
    inAdventureLicense: isAdventureLicenseMode(ctx.mode),
    baseAtk: effAtk,
    statValues,
    targetStatValues,
    debugSteps: ctx.debugSteps,
  }

  // Filter to buffs that can apply to this caster: every awakening buff (the
  // appliesTo gate inside the reducer narrows further) + char_skill buffs whose
  // charId matches. Other chars' buffs never fire for the current caster.
  const relevant = allBuffs.filter(b =>
    b.source.kind === 'awakening' ||
    (b.source.kind === 'char_skill' && b.source.charId === ctx.charId)
  )
  const reduced = applyBuffs(relevant, buffCtx)

  // Apply per-char overrides (see `char-overrides.ts`). These transform the
  // listed `damageFactor` and/or the `additionalAttackRatio` for chars whose
  // in-game behavior diverges from the data-driven model.
  const override = getCharOverride(ctx.charId, ctx.slot)
  let mainDF = ctx.damageFactor
  let addRatio = ctx.additionalAttackRatio
  if (override) {
    if (override.dfMultiplier != null) mainDF = ctx.damageFactor * override.dfMultiplier
    for (const cond of override.conditionals ?? []) {
      if (!ctx.charFlags?.[cond.flag]) continue
      if (cond.replaceOnAdv && ctx.elem === 'adv') {
        // Replace branch: scale main DF, no separate additional hit.
        mainDF = mainDF * cond.ratio
      } else {
        // Add branch: fire a separate sub-attack at `mainDF × ratio`.
        addRatio = cond.ratio
      }
    }
  }

  const additionalAttackDF = addRatio && addRatio > 0
    ? mainDF * addRatio
    : 0

  // All quirk increases (boss +30, mage +12, adv +50, etc.) flow through
  // `dmgIncPct` via the reducer's `poolPct`. Crit's CHD/CDR + target DR are
  // handled inside computeDamage per the dev-note increase/reduction groups.
  const breakdown = computeDamage({
    atk: reduced.mainAtk,
    addAtkNoPool: reduced.addAtkNoPool,
    addAtkNoPoolPermille: reduced.addAtkNoPoolPermille,
    additionalAttackDF,
    damageFactor: mainDF,
    chdPct: effChd + reduced.chdBonus,
    penPct: effPen + reduced.penBonus,
    dmgIncPct: ctx.dmgInc + reduced.poolPct,
    crit: ctx.crit,
    def: effTargetDef,
    cdmgRedPct: ctx.targetCdmgRed,
    dmgRedPct: ctx.targetDmgRed,
    isBoss: ctx.isBoss,
    elem: ctx.elem,
    C: ctx.C ?? 1000,
    ratioDivisor: ctx.ratioDivisor ?? 1000,
    f32arithmetic: ctx.f32arithmetic,
    debugSteps: ctx.debugSteps,
  })

  // ── Boss-specific damage-taken multiplier ──────────────────────────────
  // Applied AFTER the standard formula (post elem / mit / pool / crit / ...).
  // For Amadeus: Prelude of Waning Crescent (St4+ Fire/Water/Earth reduction)
  // and Enrage (HP < 30% reduced damage taken). User-editable in the UI.
  const bossOverride = getBossOverride(ctx.monsterId)
  const bossMult = ctx.bossMechanics
    ? aggregateBossMechanics(bossOverride, ctx.bossMechanics)
    : 1.0
  if (bossMult !== 1.0) {
    breakdown.mainCalc *= bossMult
    breakdown.extraCalc *= bossMult
    breakdown.additionalCalc *= bossMult
    breakdown.calculated = breakdown.mainCalc + breakdown.extraCalc + breakdown.additionalCalc
  }

  // Merge debug steps from reducer + formula in chronological order: reducer
  // captures GetStatValuePermille (target_stat), formula captures rate aggregation
  // and the multiplication chain.
  if (ctx.debugSteps) {
    const merged: { label: string; value: number; note?: string }[] = []
    if (reduced.debugSteps) merged.push(...reduced.debugSteps)
    if (breakdown.debugSteps) merged.push(...breakdown.debugSteps)
    breakdown.debugSteps = merged
  }

  return { calculated: breakdown.calculated, breakdown, reduced }
}
