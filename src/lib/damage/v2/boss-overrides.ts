/**
 * Boss-specific damage mechanics — runtime types only.
 *
 * The catalogue is no longer hardcoded: `BossOverride` instances are built
 * dynamically from `/api/admin/damage-lab/v2/monsters/[id]/mechanics`,
 * which walks the datamine
 * (`MonsterTemplet → MonsterSkillTemplet → MonsterSkillLevelTemplet → BuffTemplet`)
 * and emits one `BossMechanicDef` per damage-relevant passive skill.
 *
 * Application: each active mechanic contributes a multiplier on the FINAL
 * computed damage (after all formula stages). Multiple active mechanics
 * multiply together. The default `value=1.0` (no effect) means the operator
 * dials in the empirical multiplier per passive — Phase 2 will plug each
 * passive's underlying buffs through the formula reducer for proper
 * computation.
 */

import type {
  MonsterMechanics, MonsterPassive, MonsterPassiveBuff, MonsterPassiveKind,
} from './extract-monster'

export interface BossMechanicDef {
  id: string
  label: string
  description: string
  /**
   * Origin: 'passive' = always-active boss passive (SkillSubType=PASSIVE);
   * 'enrage' = HP-gated trigger (SKT_RAGE_ENTER\d, fires when boss crosses
   * an HP threshold). Used by the UI to label / group toggles.
   */
  kind: MonsterPassiveKind
  /**
   * Raw buff rows from the datamine. Kept on the def so the recompute
   * pipeline can evaluate each buff's condition (`ATTACKER_ELEMENT_WIN`,
   * `TARGET_ELEMENT=N`, …) at calc time and feed the result into the
   * formula's damage-reduction sum — no more post-formula multiplier.
   */
  buffs: MonsterPassiveBuff[]
}

export interface BossOverride {
  bossName: string
  mechanics: BossMechanicDef[]
}

/**
 * Toggle state — `value` is legacy (Phase 1 used it as a manual final-damage
 * multiplier). Phase 2 evaluates the def's `buffs` directly against the
 * runtime context, so the field is kept only for migration of old
 * persisted state and never read by the formula.
 */
export interface BossMechanicState {
  active: boolean
  value?: number
}

/**
 * Build a `BossOverride` from the API mechanics payload. Returns null when
 * the monster has no damage-relevant passive (panel stays hidden).
 *
 * Each passive becomes one mechanic toggle. The toggle's `description`
 * concatenates the buff summaries so the operator can see what the passive
 * does without leaving the panel.
 */
export function bossOverrideFromMechanics(payload: MonsterMechanics | null): BossOverride | null {
  if (!payload || payload.passives.length === 0) return null
  return {
    bossName: payload.monsterName,
    mechanics: payload.passives.map(passiveToMechanic),
  }
}

function passiveToMechanic(p: MonsterPassive): BossMechanicDef {
  const summary = p.buffs.map(b => `• ${b.summary}`).join('\n')
  return {
    id: p.skillId,
    label: p.name,
    description: summary || p.description,
    kind: p.kind,
    buffs: p.buffs,
  }
}

export function makeDefaultBossMechanicsState(override: BossOverride | null): Record<string, BossMechanicState> {
  const out: Record<string, BossMechanicState> = {}
  if (!override) return out
  for (const m of override.mechanics) {
    out[m.id] = { active: false }
  }
  return out
}

// ── Runtime buff aggregation ─────────────────────────────────────────────

/**
 * Element relation expected from `RecomputeContext.elem` (alias to avoid a
 * runtime import cycle with `recompute.ts`).
 */
type BossEvalElem = 'none' | 'adv' | 'disadv'

/**
 * Snapshot of the attack context needed to evaluate boss-mechanic buff
 * conditions. Subset of `RecomputeContext` — only the fields the gates
 * actually inspect.
 */
export interface BossEvalContext {
  /** Cycle relation between caster element and target element. */
  elem: BossEvalElem
  /** Caster's element name ('Earth' | 'Water' | 'Fire' | 'Light' | 'Dark'). */
  attackerElement: string
}

const ELEMENT_BY_VALUE: Record<string, string> = {
  '0': 'Earth', '1': 'Water', '2': 'Fire', '3': 'Light', '4': 'Dark',
}

/**
 * Aggregate output of the active boss mechanics — the deltas the formula
 * adds on top of the target's static stats.
 *
 *   `dmgRedPctDelta`        — added to `targetDmgRed` (% point)
 *                             Sources: `BT_DMG_REDUCE`,
 *                             `BT_STAT` on `ST_DMG_REDUCE_RATE`.
 *
 *   `finalReducePctDelta`   — added to the post-formula final reduce (%).
 *                             Source: `BT_DMG_REDUCE_FINAL`. Note the
 *                             binary applies the MAX across active final
 *                             reduces; this delta is summed naively
 *                             (single-source aggregation works for the
 *                             current bosses; revisit if multiple
 *                             BT_DMG_REDUCE_FINAL buffs ever fire on the
 *                             same target).
 */
export interface BossPassiveModifiers {
  dmgRedPctDelta: number
  finalReducePctDelta: number
}

/**
 * Evaluate active boss mechanics against the current attack context and
 * return the formula deltas. Only the gates we've validated empirically
 * are honored (cf. Amadeus St4-7 mapping discussion in PR review):
 *
 *   `ATTACKER_ELEMENT_WIN`  → ctx.elem === 'adv'
 *   `ATTACKER_ELEMENT_LOSE` → ctx.elem === 'disadv'
 *   `ATTACKER_ELEMENT_EQUAL`→ ctx.elem === 'none'  (covers same-elem AND
 *                              cross-cycle pairs that have no advantage)
 *   `TARGET_ELEMENT=N`      → attacker element matches index N. Empirical
 *                              interpretation per skill 132405 buff `10`
 *                              (corrective +45% for Dark vs Dark, lining
 *                              up Dark's net with Light's via L↔D mutual).
 *   `NONE`                  → always
 *
 * Other condition types are skipped (logged as TBD via the panel summary
 * but not folded into the calc until we RE them).
 */
export function aggregateBossPassiveModifiers(
  override: BossOverride | null,
  state: Record<string, BossMechanicState>,
  ctx: BossEvalContext,
): BossPassiveModifiers {
  const out: BossPassiveModifiers = { dmgRedPctDelta: 0, finalReducePctDelta: 0 }
  if (!override) return out

  for (const mech of override.mechanics) {
    if (!state[mech.id]?.active) continue
    for (const b of mech.buffs) {
      if (!conditionMatches(b.condition, b.conditionValue, ctx)) continue

      // Permille-encoded values: BT_DMG_REDUCE always; BT_STAT OAT_ADD on
      // a permille stat (ST_DMG_REDUCE_RATE). 300‰ → +30 percentage points.
      const pct = b.value / 10

      switch (b.type) {
        case 'BT_DMG_REDUCE':
          // Positive value → reduces damage to boss; negative → increases
          // damage. Same sign convention as `targetDmgRed` (% reduction).
          out.dmgRedPctDelta += pct
          break
        case 'BT_DMG_REDUCE_FINAL':
          out.finalReducePctDelta += pct
          break
        case 'BT_STAT':
        case 'BT_STAT_PREMIUM':
          // Only ST_DMG_REDUCE_RATE matters for our calc — boss-side DR
          // additions (Enrage). Other defensive stats (DEF, BUFF_RESIST)
          // would need to flow through different formula inputs; not
          // wired yet.
          if (b.statType === 'ST_DMG_REDUCE_RATE') out.dmgRedPctDelta += pct
          break
        // BT_DMG_ELEMENT_SUPERIORITY / _ENCHANT not modeled (cf §7.5 spec).
        // BT_STAT_BUFF_ENHANCE not modeled (multiplicative on stat-up
        // values — would require a CalcFinalStat replay).
      }
    }
  }
  return out
}

function conditionMatches(
  cond: string,
  condVal: string | undefined,
  ctx: BossEvalContext,
): boolean {
  switch (cond) {
    case 'NONE':                    return true
    case 'ATTACKER_ELEMENT_WIN':    return ctx.elem === 'adv'
    case 'ATTACKER_ELEMENT_LOSE':   return ctx.elem === 'disadv'
    case 'ATTACKER_ELEMENT_EQUAL':  return ctx.elem === 'none'
    case 'TARGET_ELEMENT': {
      const want = ELEMENT_BY_VALUE[condVal ?? '0']
      return ctx.attackerElement === want
    }
    default:                         return false
  }
}
