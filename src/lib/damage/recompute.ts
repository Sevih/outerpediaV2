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
}

export interface RecomputeResult {
  calculated: number
  breakdown: DamageBreakdown
  reduced: ReducedBuffs
}

export function recompute(ctx: RecomputeContext, allBuffs: ApplicableBuff[]): RecomputeResult {
  // statValues — feed the reducer's scaling math (BT_DMG_OWNER_STAT, BT_SWAP_STAT_ATTACK).
  // ST_ATK is the user-typed primary ATK; everything else flows from `extraStats`.
  const statValues: Record<string, number> = { ST_ATK: ctx.atk }
  if (ctx.extraStats) {
    for (const [k, v] of Object.entries(ctx.extraStats)) statValues[k] = v
  }

  // Target stats — fed to the reducer for `scaling_target_stat` buffs
  // (BT_DMG_TARGET_STAT). Currently only ST_HP is wired since that's the only
  // empirically-validated target stat (Noa S2). Add ST_DEF / ST_SPD here if a
  // future char scales on those.
  const targetStatValues: Record<string, number> = {}
  if (ctx.targetHp != null) targetStatValues.ST_HP = ctx.targetHp
  if (ctx.targetDef != null) targetStatValues.ST_DEF = ctx.targetDef

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
    baseAtk: ctx.atk,
    statValues,
    targetStatValues,
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
    chdPct: ctx.chd + reduced.chdBonus,
    penPct: ctx.pen + reduced.penBonus,
    dmgIncPct: ctx.dmgInc + reduced.poolPct,
    crit: ctx.crit,
    def: ctx.targetDef,
    cdmgRedPct: ctx.targetCdmgRed,
    dmgRedPct: ctx.targetDmgRed,
    isBoss: ctx.isBoss,
    elem: ctx.elem,
    C: ctx.C ?? 1000,
    ratioDivisor: ctx.ratioDivisor ?? 1000,
    f32arithmetic: ctx.f32arithmetic,
  })

  return { calculated: breakdown.calculated, breakdown, reduced }
}
