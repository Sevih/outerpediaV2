/**
 * Recompute pipeline v2 — single entry point that wires the v2 stack
 * (extract-buffs → buffs reducer → formula) for both the live calc panel and
 * the obs-table recompute flow.
 *
 * `RecomputeContext` shape: see `damage-lab-v2-spec.md` §5 + UI spec §5.
 * No `f32arithmetic` toggle (always on). No `debugSteps` toggle (always
 * produced; the UI consumes or discards it).
 *
 * ── Pipeline ─────────────────────────────────────────────────────────────
 *   1. External buffs (lab UI toggles) → adjust ATK/PEN/CHC/CHD/EFF/DEF inputs
 *   2. Build BuffContext from RecomputeContext + adjusted stats
 *   3. Reduce ApplicableBuff[] via reducer (filter by appliesTo + trigger,
 *      fold into ReducedBuffs)
 *   4. Apply char-overrides (e.g. Ame's S1 dfMultiplier = 0.5 + Ume/Sakura conds)
 *   5. Feed everything into computeDamage → DamageBreakdown
 *   6. Apply boss-mechanics multiplier on the final damage (Amadeus Prelude / Enrage)
 */

import { computeDamage, type DamageBreakdown } from './formula'
import {
  applyBuffs,
  type ApplicableBuff, type BuffContext, type CallerSlot, type ReducedBuffs,
} from './buffs'
import { getCharOverride, type CharFlags } from './char-overrides'
import {
  aggregateExternalBuffs,
  type ExternalBuffState, type ExternalBuffSums,
} from './external-buffs'
import {
  aggregateBossMechanics, getBossOverride,
  type BossMechanicState,
} from './boss-overrides'

export type ElemRelation = 'none' | 'adv' | 'disadv'
export type { CallerSlot, CharFlags }

// ── Element relations ────────────────────────────────────────────────────
// Fire > Earth > Water > Fire (rps trio).
// Light ↔ Dark mutual advantage — both directions resolve to 'adv'.
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

// Modes that gate the paid Adventure License awakening tier.
export function isAdventureLicenseMode(mode: string | undefined): boolean {
  return mode === 'DM_ADVENTURE_MISSION' || mode === 'DM_ADVENTURE_CHALLENGE'
}

// ── RecomputeContext ─────────────────────────────────────────────────────

export interface RecomputeContext {
  // Caster identity — drives buff filtering + AdvLicense gate.
  charId: string
  charElement: string
  charClass: string
  charSubclass: string
  // Skill
  slot: CallerSlot
  damageFactor: number
  /** Set when the user enabled the additional-attack toggle in the UI. */
  additionalAttackRatio?: number
  // Caster inputs — user-typed values that feed the formula directly.
  // No buff augmentation, no scaling pre-applied — the reducer handles both.
  atk: number
  chd: number
  pen: number
  dmgInc: number
  applyQuirks: boolean
  /**
   * Optional ATK scaling breakdown (from the chars-stats route). When set,
   * external ATK% buffs stack additively into `pctBonus` and the formula
   * is replayed — matching the in-game behavior where combat-time +ATK%
   * adds to the permanent %-layer rather than multiplying the displayed
   * ATK. `null` falls back to linear `× (1 + buff/100)`.
   */
  atkScaling?: {
    baseMax: number
    flat: number
    pctBonus: number
    codexPct: number
    transcendPct: number
  } | null
  /** ST_* → numeric, for secondary scaling (Stella HP, Regina CHC). */
  extraStats?: Record<string, number>
  // Target inputs — also user-fed (auto mode prefills from monster API).
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  /** Required for `BT_DMG_TARGET_STAT` scaling (Noa S2 +3% × HP sub-attack). */
  targetHp?: number
  isBoss: boolean
  elem: ElemRelation
  crit: boolean
  /** Pass the raw `DungeonMode` string for the AdvLicense gate. */
  mode?: string
  /** UI-fed flags that gate per-char hardcoded overrides. */
  charFlags?: CharFlags
  // ── Pool-condition inputs (BT_DMG_*) — see `BuffContext` for defaults ──
  ownerHpRate?: number
  targetHpRate?: number
  casterHpRate?: number
  ownerBuffCount?: number
  targetBuffCount?: number
  ownerDebuffCount?: number
  targetDebuffCount?: number
  targetBroken?: boolean
  killCountStack?: number
  teamBuffCount?: number
  teamDecreaseCount?: number
  enemyTeamDecreaseCount?: number
  inMonadGate?: boolean
  inTower?: boolean
  inPvp?: boolean
  // Formula constants (tunable)
  C?: number
  ratioDivisor?: number
  // Click-toggleable buffs/debuffs surfaced in the lab UI.
  externalBuffs?: Record<string, ExternalBuffState>
  /** Identifies which boss override is active (matched by `monsterId.startsWith`). */
  monsterId?: string
  bossMechanics?: Record<string, BossMechanicState>
}

export interface RecomputeResult {
  /** Final integer damage (already floored, max(1, …)). */
  calculated: number
  breakdown: DamageBreakdown
  reduced: ReducedBuffs
}

// ── Pipeline ─────────────────────────────────────────────────────────────

export function recompute(ctx: RecomputeContext, allBuffs: ApplicableBuff[]): RecomputeResult {
  // ── 1. External buff/debuff aggregation ───────────────────────────────
  // Apply user-toggled BT_STAT-style buffs to the input stats BEFORE feeding the
  // reducer/formula: ATK/DEF use multiplicative `× (1 + Σpct/100)`, % stats
  // (PEN / CHC / CHD / EFF) use additive points.
  const extSums: ExternalBuffSums = ctx.externalBuffs
    ? aggregateExternalBuffs(ctx.externalBuffs)
    : { attackerATK: 0, attackerPEN: 0, attackerCHC: 0, attackerCHD: 0, attackerEFF: 0, targetDEF: 0 }

  // ATK with external buff. When the scaling breakdown is known, replay the
  // chars-stats `calcStat` formula with `pctBonus + buffPct` so a +30% ATK
  // buff stacks ADDITIVELY against the char's permanent %-layer. Without the
  // breakdown (manual edit / older obs), fall back to linear `× (1 + buff/100)`.
  const effAtk = ctx.atkScaling != null && extSums.attackerATK !== 0
    ? replayStatWithBuff(ctx.atkScaling, extSums.attackerATK)
    : ctx.atk * (1 + extSums.attackerATK / 100)
  const effPen = ctx.pen + extSums.attackerPEN
  const effChd = ctx.chd + extSums.attackerCHD
  const effTargetDef = ctx.targetDef * (1 + extSums.targetDEF / 100)

  // statValues — feed the reducer's scaling math (BT_DMG_OWNER_STAT, BT_SWAP_STAT_ATTACK).
  // ST_ATK is the post-buff primary ATK; secondary ST_* come from `extraStats`,
  // augmented with EFF/CHC additive contributions.
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

  // Target stats — fed to the reducer for `scaling_target_stat` (BT_DMG_TARGET_STAT).
  // Currently only ST_HP is wired (Noa S2). Extend here when a future char
  // scales on ST_DEF / ST_SPD / ST_*.
  const targetStatValues: Record<string, number> = {}
  if (ctx.targetHp != null)   targetStatValues.ST_HP = ctx.targetHp
  if (effTargetDef != null)   targetStatValues.ST_DEF = effTargetDef

  // ── 2. Build BuffContext ──────────────────────────────────────────────
  const buffCtx: BuffContext = {
    charId:       ctx.charId,
    charElement:  ctx.charElement,
    charClass:    ctx.charClass,
    // Awakening apply-by-subclass uses uppercase (`SUBCLASS_BY_INDEX`); normalize.
    charSubclass: ctx.charSubclass.toUpperCase(),
    slot:         ctx.slot,
    isBoss:       ctx.isBoss,
    crit:         ctx.crit,
    elem:         ctx.elem,
    applyQuirks:  ctx.applyQuirks,
    inAdventureLicense: isAdventureLicenseMode(ctx.mode),
    baseAtk:      effAtk,
    statValues,
    targetStatValues,
    // Pool-condition inputs — pass-through (default-zero context = no contribution).
    ownerHpRate:            ctx.ownerHpRate,
    targetHpRate:           ctx.targetHpRate,
    casterHpRate:           ctx.casterHpRate,
    ownerBuffCount:         ctx.ownerBuffCount,
    targetBuffCount:        ctx.targetBuffCount,
    ownerDebuffCount:       ctx.ownerDebuffCount,
    targetDebuffCount:      ctx.targetDebuffCount,
    targetBroken:           ctx.targetBroken,
    killCountStack:         ctx.killCountStack,
    teamBuffCount:          ctx.teamBuffCount,
    teamDecreaseCount:      ctx.teamDecreaseCount,
    enemyTeamDecreaseCount: ctx.enemyTeamDecreaseCount,
    inMonadGate:            ctx.inMonadGate,
    inTower:                ctx.inTower,
    inPvp:                  ctx.inPvp,
  }

  // ── 3. Filter + reduce buffs ──────────────────────────────────────────
  // Filter to buffs that can apply to this caster: every awakening buff (the
  // `appliesTo` gate inside the reducer narrows further) + char_skill buffs
  // whose charId matches. Other chars' buffs never fire for the current caster.
  const relevant = allBuffs.filter(b =>
    b.source.kind === 'awakening' ||
    (b.source.kind === 'char_skill' && b.source.charId === ctx.charId)
  )
  const reduced = applyBuffs(relevant, buffCtx)

  // ── 4. Apply per-char overrides ───────────────────────────────────────
  // Transform `damageFactor` and/or `additionalAttackRatio` for chars whose
  // in-game behavior diverges from the data-driven model (Ame Ume/Sakura).
  const override = getCharOverride(ctx.charId, ctx.slot)
  let mainDF = ctx.damageFactor
  let addRatio = ctx.additionalAttackRatio
  if (override) {
    if (override.dfMultiplier != null) mainDF = ctx.damageFactor * override.dfMultiplier
    for (const cond of override.conditionals ?? []) {
      if (!ctx.charFlags?.[cond.flag]) continue
      if (cond.replaceOnAdv && ctx.elem === 'adv') {
        mainDF = mainDF * cond.ratio
      } else {
        addRatio = cond.ratio
      }
    }
  }
  const additionalAttackDF = addRatio && addRatio > 0
    ? mainDF * addRatio
    : 0

  // ── 5. Compute damage ─────────────────────────────────────────────────
  // All quirk increases (boss +30, mage +12, adv +50, etc.) flow through
  // `dmgIncPct` via the reducer's `poolPct`. Crit's CHD/CDR + target DR are
  // handled inside `computeDamage`.
  const breakdown = computeDamage({
    atk:               reduced.mainAtk,
    damageFactor:      mainDF,
    additionalAttackDF,
    chdPct:            effChd + reduced.chdBonus,
    penPct:            effPen + reduced.penBonus,
    dmgIncPct:         ctx.dmgInc + reduced.poolPct,
    crit:              ctx.crit,
    def:               effTargetDef,
    cdmgRedPct:        ctx.targetCdmgRed,
    dmgRedPct:         ctx.targetDmgRed,
    isBoss:            ctx.isBoss,
    elem:              ctx.elem,
    targetStatPermille: reduced.targetStatPermille,
    C:                 ctx.C ?? 1000,
    ratioDivisor:      ctx.ratioDivisor ?? 1000,
  })

  // ── 6. Boss-specific damage-taken multiplier ──────────────────────────
  // Applied AFTER the standard formula. For Amadeus: Prelude of Waning Crescent
  // (St4+ Fire/Water/Earth reduction) and Enrage (HP < 30% reduced damage taken).
  const bossOverride = getBossOverride(ctx.monsterId)
  const bossMult = ctx.bossMechanics
    ? aggregateBossMechanics(bossOverride, ctx.bossMechanics)
    : 1.0
  let calculated = breakdown.calculated
  if (bossMult !== 1.0) {
    // Re-floor after the boss-mult so we still emit an integer.
    calculated = Math.max(1, Math.floor(breakdown.mainCalc * bossMult + breakdown.additionalCalc * bossMult))
    // Patch breakdown to surface the post-mult values for the UI.
    breakdown.mainCalc       = breakdown.mainCalc       * bossMult
    breakdown.additionalCalc = breakdown.additionalCalc * bossMult
    breakdown.calculated     = calculated
  }

  return { calculated, breakdown, reduced }
}

/**
 * Replay the chars-stats `calcStat` formula with an additional %-bonus
 * (combat-time external buff) added to `pctBonus`. Mirrors
 * `src/app/api/admin/characters/[id]/stats/route.ts` exactly so the lab
 * matches what the API would return if the buff were a permanent stat.
 */
function replayStatWithBuff(
  s: { baseMax: number; flat: number; pctBonus: number; codexPct: number; transcendPct: number },
  buffPct: number,
): number {
  const totalPctBonus = s.pctBonus + buffPct
  const compoundPct = ((1 + s.transcendPct / 100) * (1 + totalPctBonus / 100) - 1) * 100
  const onBase = s.codexPct + compoundPct
  const onFlat = compoundPct
  return Math.floor(s.baseMax * (1 + onBase / 100) + s.flat * (1 + onFlat / 100))
}
