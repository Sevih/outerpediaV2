import type { ApplicableBuff } from '@/lib/damage/v2/buffs'
import { detectElementRelation, recompute } from '@/lib/damage/v2/recompute'
import type { RecomputeContext, RecomputeResult } from '@/lib/damage/v2/recompute'
import type {
  DamageCalcAwakeningBuffs,
  DamageCalcCharBuffs,
  DamageCalcCharDetail,
  DamageCalcCharSummary,
  DamageCalcEquipmentFile,
  DamageCalcMonsterEntry,
  DamageCalcMonstersFile,
  DamageCalcStageEntry,
  DamageCalcModeEntry,
  DamageCalcTranscendFile,
} from '@/lib/data/damage-calc'
import type { CalcState, ManualTargetState, SkillSlot, StatValues } from '../_state/types'
import { applyTeamDeltasToStats, computeTeamDeltas } from './no-gear-stats'

/**
 * Compose the inputs `recompute()` consumes from our public-calc state.
 *
 * Mirrors `src/app/admin/damage-lab/v2/page.tsx`'s context build (the
 * admin lab is the source of truth for what fields the formula expects).
 * V1 wires only the fields the admin already supports — equipment passive
 * buffs, ally team contributions, boss mechanics + override are deferred
 * to follow-up phases.
 *
 * Returns `null` when the inputs aren't complete enough to compute (no
 * char picked, no detail loaded yet, no target in cascade mode, etc.) —
 * the consumer renders a "pick something" placeholder.
 */

export interface ComposeInputs {
  state: CalcState
  detail: DamageCalcCharDetail | null
  summary: DamageCalcCharSummary | null
  monsters: DamageCalcMonstersFile
  /** Pre-resolved cascade pair (when in cascade mode + a stage/monster picked). */
  cascade: { mode: DamageCalcModeEntry; stage: DamageCalcStageEntry; monster: DamageCalcMonsterEntry } | null
  /** Effective stats for the cast (= dealer base + team deltas) — fed into
   *  the recompute context's stat fields so the formula sees the same
   *  numbers an in-game cast would produce. */
  effectiveStats: StatValues
  /** ATK scaling block with team `pctOnBase.atk` folded into `pctBonus`,
   *  so external ATK% buffs in `recompute()` stack additively against the
   *  full permanent layer (dealer's own + team). Null when no scaling. */
  effectiveScaling: import('../_state/types').StatScaling | null
}

export interface ComposedResult {
  ctx: RecomputeContext
  buffs: ApplicableBuff[]
}

export interface ComputedDamage {
  ctx: RecomputeContext
  result: RecomputeResult
}

/**
 * Run the full pipeline: resolve cascade → compose context → call recompute.
 * Returns null when the inputs aren't ready (no char picked / detail not
 * loaded yet / cascade target unresolved). Single entry point used by both
 * `ResultPanel` (display) and `SharePanel` (embed in export envelope).
 *
 * Team contributions (transcend bonuses + ally talismans) are resolved here
 * via `computeTeamDeltas` and applied to the dealer's BASE stats so the
 * formula sees the cast's actual stat block. The dealer's panel still
 * shows the base values (with `(+X)` annotations), keeping the in-game
 * character-sheet mapping intact.
 */
export function runRecompute(
  state: CalcState,
  awakening: DamageCalcAwakeningBuffs,
  charBuffs: DamageCalcCharBuffs | null,
  monsters: DamageCalcMonstersFile,
  manifest: DamageCalcCharSummary[],
  transcend: DamageCalcTranscendFile,
  equipment: DamageCalcEquipmentFile,
): ComputedDamage | null {
  if (!state.attacker.detail || !state.attacker.charId) return null
  const summary = manifest.find(c => c.id === state.attacker.charId) ?? null
  const cascade = resolveCascadeSelection(state, monsters)
  const buffs = composeApplicableBuffs(awakening, charBuffs)
  const teamDeltas = computeTeamDeltas(state.team, transcend.byChar, equipment.talismanMainStats)
  const { stats: effectiveStats, atkScaling: effectiveScaling } = applyTeamDeltasToStats(
    state.attacker.stats,
    state.attacker.atkScaling,
    teamDeltas,
  )
  const composed = composeRecomputeContext({
    state,
    detail: state.attacker.detail,
    summary,
    monsters,
    cascade,
    effectiveStats,
    effectiveScaling,
  }, buffs)
  if (!composed) return null
  return { ctx: composed.ctx, result: recompute(composed.ctx, composed.buffs) }
}

/**
 * Build the recompute context from the picked char + active skill + target.
 * Returns null when the calc isn't ready to run (missing detail / target).
 */
export function composeRecomputeContext(inputs: ComposeInputs, allBuffs: ApplicableBuff[]): ComposedResult | null {
  void allBuffs // not used for context build itself — kept for future buff-driven defaults
  const { state, detail, summary } = inputs
  if (!summary || !detail) return null
  const target = resolveTarget(inputs)
  if (!target) return null

  // Burst Lv > 0 on S3 swaps in the burst variant — its DF + buff list
  // replace the S3 base for this cast. Falls back to S3 when the char has
  // no matching B(N) entry (defensive: the picker is gated on data presence).
  const burstLevel = state.attacker.burstLevel
  const useBurst = state.attacker.skillSlot === 'S3' && burstLevel > 0
  const burstKey = useBurst ? (`B${burstLevel}` as 'B1' | 'B2' | 'B3') : null
  const burstSkill = burstKey ? detail.skills[burstKey] : null
  const effectiveSlot = burstSkill ? burstKey! : state.attacker.skillSlot
  const df = burstSkill
    ? (burstSkill.damageFactors[Math.max(0, Math.min(4, state.attacker.skillLevel - 1))] ?? 1000)
    : getDamageFactor(detail, state.attacker.skillSlot, state.attacker.skillLevel)
  const addRatio = burstSkill
    ? (burstSkill.additionalAttackRatio ?? undefined)
    : getAdditionalAttackRatio(detail, state.attacker.skillSlot)
  const elem = detectElementRelation(summary.element, target.element)

  const ctx: RecomputeContext = {
    charId: summary.id,
    charElement: summary.element,
    charClass: summary.class,
    charSubclass: summary.subclass,
    slot: effectiveSlot,
    damageFactor: df,
    // V1: additional attack always on when the skill exposes a ratio. The
    // damage dealer panel doesn't currently surface a toggle for it.
    additionalAttackRatio: addRatio,
    // Effective stats = dealer's base + team deltas (transcend bonuses +
    // ally talismans). The dealer panel always shows the BASE values; the
    // formula sees the cast's actual numbers via `inputs.effectiveStats`.
    atk:    inputs.effectiveStats.ATK,
    chd:    inputs.effectiveStats.CHD,
    pen:    inputs.effectiveStats.PEN,
    dmgInc: inputs.effectiveStats.DMG_INC,
    // Settings.quirks.element/job already feed the auto-prefilled stats —
    // pass `applyQuirks: true` so the formula's awakening filtering matches
    // the actual stat sheet (avoid double-counting).
    applyQuirks: true,
    // Extra stats — secondary scalings (Stella HP, Regina CHC) read these
    // through the formula's `extraStats` lookup. Mirrors the ST_* keys.
    extraStats: {
      ST_HP:               inputs.effectiveStats.HP,
      ST_DEF:              inputs.effectiveStats.DEF,
      ST_SPEED:            inputs.effectiveStats.SPD,
      ST_CRITICAL_RATE:    inputs.effectiveStats.CHC,
      ST_BUFF_CHANCE:      inputs.effectiveStats.EFF,
      ST_BUFF_RESIST:      inputs.effectiveStats.RES,
    },
    // ATK breakdown — base scaling with team `pctOnBase.atk` folded into
    // `pctBonus` so external ATK% buffs stack additively against the full
    // permanent layer. Null after a manual ATK edit (linear fallback).
    atkScaling: inputs.effectiveScaling,
    // Target inputs.
    targetDef:    target.def,
    targetDmgRed: target.dmgRed,
    targetCdmgRed: 0, // not in the bake yet — defaults to 0
    targetHp:     target.hp,
    isBoss:       target.isBoss,
    elem,
    crit: state.attacker.crit,
    mode: target.mode ?? '',
    monsterId: target.monsterId,
    targetElement: target.element || undefined,
    // Environment auto-derived from the picked mode (mirrors admin heuristic).
    inMonadGate: deriveInMonadGate(target.mode),
    inTower:     deriveInTower(target.mode),
    inPvp:       deriveInPvp(target.mode),
    // External buffs panel — same shape as the admin reducer expects.
    externalBuffs: state.buffs.toggles,
    // Boss mechanics — toggle state + override definitions. `recompute()`
    // step 5 walks the override's raw buffs for each active mechanic and
    // adds the resulting DR / final-reduce deltas to the formula.
    bossMechanics: state.bossMechanics,
    bossOverride:  state.bossOverride,
    // Pool-condition inputs — feed `BT_DMG_*` conditional buffs that scale
    // on dynamic battle state (caster/target HP fractions, buff/debuff counts,
    // dead-ally counters, kill stacks). HP fractions stored as 0..100 lost%
    // in the UI are converted to 0..1 remaining for the formula. The reducer
    // treats `undefined` as zero, so unmapped fields are no-ops.
    ownerHpRate:            hpFractionFromLostPct(state.attacker.conditional.casterLostHpPct),
    targetHpRate:           hpFractionFromLostPct(state.attacker.conditional.targetLostHpPct),
    targetBuffCount:        state.attacker.conditional.targetBuffs,
    targetDebuffCount:      state.attacker.conditional.targetDebuffs,
    teamBuffCount:          state.attacker.conditional.teamBuffs,
    enemyTeamDecreaseCount: state.attacker.conditional.enemyTeamDeaths,
    killCountStack:         state.attacker.conditional.killStacks,
    // EE — gates `kind: 'ee'` buffs in the formula. CF chars wearing the base
    // char's EE pass the base char id so the EE filter selects the right buff.
    eeEnabled: state.attacker.equipment.ee.enabled,
    eeLevel:   state.attacker.equipment.ee.level,
    eeCharId:  state.attacker.equipment.ee.variant === 'base' && summary.baseCharId
      ? summary.baseCharId
      : summary.id,
    // Pool conds — V2 hookup. State exists in `state.attacker.conditional`
    // but the wiring to ctx fields (ownerHpRate, targetDebuffCount, …) is
    // deferred. The formula treats `undefined` as zero for each.
  }
  return { ctx, buffs: allBuffs }
}

/**
 * Merge the awakening + char buff catalogs into a single `ApplicableBuff[]`
 * for `recompute()`. The reducer filters internally on `appliesTo` /
 * `trigger.requires` / `source.kind` so we can pass everything in.
 *
 * Returns the awakening list alone when char buffs aren't loaded yet so
 * the formula still produces a result (just missing char-specific buffs).
 */
export function composeApplicableBuffs(
  awakening: DamageCalcAwakeningBuffs,
  charBuffs: DamageCalcCharBuffs | null,
): ApplicableBuff[] {
  if (!charBuffs) return awakening.buffs
  return [...awakening.buffs, ...charBuffs.buffs]
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Pull the DamageFactor at `level` for the given slot. Falls back to 1000. */
export function getDamageFactor(detail: DamageCalcCharDetail, slot: SkillSlot, level: number): number {
  const skill = detail.skills[slot]
  if (!skill) return 1000
  const idx = Math.max(0, Math.min(4, level - 1))
  return skill.damageFactors[idx] ?? 1000
}

export function getAdditionalAttackRatio(detail: DamageCalcCharDetail, slot: SkillSlot): number | undefined {
  return detail.skills[slot]?.additionalAttackRatio ?? undefined
}

interface ResolvedTarget {
  def: number
  dmgRed: number
  hp: number
  isBoss: boolean
  element: string
  mode?: string
  monsterId?: string
}

function resolveTarget(inputs: ComposeInputs): ResolvedTarget | null {
  const { state } = inputs
  if (state.target.mode === 'manual') return resolveManualTarget(state.target.manual)
  if (!inputs.cascade) return null
  const { mode, monster } = inputs.cascade
  return {
    def:     monster.stats.def,
    dmgRed:  monster.stats.dmgRed,
    hp:      monster.stats.hp,
    isBoss:  monster.isBoss,
    element: monster.element,
    mode:    mode.mode,
    monsterId: monster.monsterId,
  }
}

function resolveManualTarget(manual: ManualTargetState): ResolvedTarget {
  return {
    def:     manual.stats.def,
    dmgRed:  manual.stats.dmgRed,
    hp:      manual.stats.hp,
    isBoss:  manual.isBoss,
    element: manual.element,
    // Manual mode has no dungeon mode → environment heuristics return false.
    mode:    undefined,
    monsterId: undefined,
  }
}

/**
 * Resolve the picked cascade triplet (mode + stage + monster) from the
 * monsters catalog. Returns null when target.mode === 'manual' or when
 * the cascade selection is incomplete.
 */
export function resolveCascadeSelection(
  state: CalcState,
  monsters: DamageCalcMonstersFile,
): ComposeInputs['cascade'] {
  if (state.target.mode === 'manual') return null
  const { stageId, monsterId } = state.target
  if (!stageId || !monsterId) return null
  for (const mode of monsters.modes) {
    const stage = mode.stages.find(s => s.id === stageId)
    if (!stage) continue
    for (const wave of stage.waves) {
      const monster = wave.monsters.find(m => m.monsterId === monsterId)
      if (monster) return { mode, stage, monster }
    }
  }
  return null
}

/**
 * Convert UI-side "lost HP %" (0..100, 0 = full, 100 = empty) into the
 * formula's "remaining HP fraction" (0..1, 1 = full, 0 = empty). Defensive
 * clamp keeps the formula in-range even if the UI ever overshoots.
 */
function hpFractionFromLostPct(lostPct: number): number {
  const remaining = 1 - lostPct / 100
  return remaining < 0 ? 0 : remaining > 1 ? 1 : remaining
}

// Mode-string → environment-flag heuristics. Same substring checks as the
// admin lab — the DungeonMode enum names are stable enough.
function deriveInMonadGate(mode: string | undefined): boolean {
  return !!mode && mode.includes('MONAD_GATE')
}
function deriveInTower(mode: string | undefined): boolean {
  return !!mode && mode.includes('TOWER')
}
function deriveInPvp(mode: string | undefined): boolean {
  return !!mode && (mode.includes('PVP') || mode.includes('ARENA'))
}
