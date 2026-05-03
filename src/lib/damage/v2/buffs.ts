/**
 * Unified buff schema + reducer for the damage-lab v2.
 *
 * Goal: every modifier that can affect a damage calculation flows through ONE
 * flat list of `ApplicableBuff` entries. The page-side reducer (`applyBuffs`)
 * folds the list into the inputs `computeDamage` expects, gated by the current
 * context (slot / isBoss / crit / elem).
 *
 * Sources are decoded server-side once (see `extract-buffs.ts`) and exposed
 * via `/api/admin/damage-lab/v2/extract-buffs`.
 *
 * ── Differences vs v1 (`src/lib/damage/buffs.ts`) ───────────────────────
 *  • `enemy_team_decrease` is its own `PoolCondition`, separate from
 *    `team_decrease` (= MY_TEAM, allies dead). v1 collapsed both onto the
 *    same field; PR 4bis disasm of `FindBuffEnemyTeamDecreaseDamageRate`
 *    (VA 0x2639194) confirmed they have different multiplier sources and
 *    different application paths in the binary.
 *  • Per-`PoolCondition` multiplier formulas now annotated with their binary
 *    VA dispatch (validation trail).
 */

import { f, f32add, f32mul, RODATA } from './f32'

// ── Effect target — what the buff modifies in the damage pipeline ───────
export type EffectTarget =
  // Caster pool — additive % point in the formula's pool modifier.
  // Sources: BT_DMG cond=NONE/condition (83), BT_DMG_TO_BOSS (96),
  //          Awakening_Boss_Dmg_*, Awakening_Element_Dmg_*.
  | 'pool'
  // Caster pool — CONDITIONAL additive %, scaled by a context multiplier.
  // Discriminated by `effect.poolCond`. Each cond corresponds to one BT_DMG_*
  // type from `FindBuffAdditionalDamage` (VA 0x2637548) or the dedicated
  // `FindBuffEnemyTeamDecreaseDamageRate` (VA 0x2639194). See `PoolCondition`
  // for the per-cond multiplier formula.
  | 'pool_cond'
  // Caster stat additions — folded into ATK / CHD / PEN / CRIT% before formula.
  | 'atk_pct' | 'atk_flat'
  | 'chd' | 'crit_rate'
  | 'pen'
  // Target debuffs — pushed to the monster stats endpoint as effDebuff/resDebuff.
  | 'monster_eff' | 'monster_res'
  // Damage scaling — replaces ATK or adds a separate component.
  // statRef = source stat (ST_HP, ST_DEF, ST_CRITICAL_RATE, ...).
  | 'scaling_swap' | 'scaling_add_pct' | 'scaling_add_flat'
  // BT_DMG_TARGET_STAT — separate damage component scaled on a target stat.
  | 'scaling_target_stat'

/**
 * Conditional pool multiplier source. Each value matches one BT_DMG_* enum
 * case in the binary; multiplier formulas validated by PR 4bis disas.
 *
 *   owner_lost_hp        (84, 0x2637744 dispatch)  → max(0, 1 − ownerHpRate)
 *   target_lost_hp       (85, 0x26377a8)            → max(0, 1 − targetHpRate)
 *   owner_buff           (88, 0x2637938)            → ownerBuffCount  (positive caster buffs)
 *   target_buff          (89, 0x2637988)            → targetBuffCount (positive target buffs)
 *   owner_debuff         (90, 0x26379dc)            → ownerDebuffCount (negative caster buffs)
 *   target_debuff        (91, 0x2637a2c)            → targetDebuffCount (negative target buffs)
 *   target_break         (95, 0x2637a94)            → 1 if target.RageManager.IsBreak else 0
 *   kill_count_stack     (97, 0x2637b50)            → 1 (Value already encodes per-stack contribution)
 *   not_critical         (98, 0x2637b90)            → 1 if !crit else 0
 *   pvp_content          (99, 0x2637c04)            → 1 if inPvp else 0
 *   caster_lost_hp       (101, 0x2637c84)           → max(0, 1 − casterHpRate)  (orig caster)
 *   team_buff            (102, 0x2637d0c)           → teamBuffCount (sum across caster's team)
 *   team_decrease        (103, 0x2637e20)           → teamDecreaseCount (= MY_TEAM, dead allies)
 *   enemy_team_decrease  (94, 0x2639194 dedicated)  → enemyTeamDecreaseCount (= dead enemies, max-team − alive)
 *   monadgate_content    (104, 0x2637f18)           → 1 if inMonadGate else 0
 *   tower_content        (105, 0x2637fec)           → 1 if inTower else 0
 *
 * NOTE on `enemy_team_decrease` vs `team_decrease`: the binary applies type 94
 * via a SEPARATE function (`FindBuffEnemyTeamDecreaseDamageRate`) called from
 * `UseSkill` AFTER `CheckDamageRate` — not as part of `FindBuffAdditionalDamage`.
 * The reducer here folds both into the same `poolPct` for simplicity (the math
 * is identical: `value × multiplier × 0.001`); only the multiplier *source*
 * differs (allies vs enemies dead count).
 */
export type PoolCondition =
  | 'owner_lost_hp' | 'target_lost_hp'
  | 'owner_buff' | 'target_buff' | 'owner_debuff' | 'target_debuff'
  | 'target_break' | 'kill_count_stack'
  | 'not_critical' | 'pvp_content'
  | 'caster_lost_hp'
  | 'team_buff' | 'team_decrease' | 'enemy_team_decrease'
  | 'monadgate_content' | 'tower_content'

// ── Trigger ──────────────────────────────────────────────────────────────
/**
 * `resource` = `BuffConditionType: OWNER_RESOURCE` — gates a buff on the
 * caster having maxed their unique resource stack (Noa's Kaizer Energy 5/5,
 * etc.). The lab surfaces this as a `CharFlags.ownerResourceMax` toggle so
 * the operator can model "S3 cast at full resource" runs.
 *
 * `caster_def_up` = `BuffConditionType: OWNER_HAS_BUFF / CASTER_HAS_BUFF`
 * with `BuffConditionValue=6` — gates a buff on the caster having a Defense
 * Up buff active. Drives Veronica core fusion's "Increases Damage for allies
 * under Increased Defense" passive (`core_passive_def_buff_ally_dmg`).
 * Surfaced as the `a-buff-def` external buff toggle.
 *
 * `target_element_*` = `BuffConditionType: TARGET_ELEMENT` with
 * `BuffConditionValue` indexing the element table (0=Earth, 1=Water, 2=Fire,
 * 3=Light, 4=Dark). Drives EE mainstat damage bonuses ("DMG +17→23% vs Light"
 * = `target_element_light`). Matched against `ctx.targetElement`.
 */
export type TriggerCondition =
  | 'always' | 'boss' | 'crit' | 'adv' | 'disadv' | 'neutral'
  | 'resource' | 'caster_def_up'
  | 'target_element_earth' | 'target_element_water' | 'target_element_fire'
  | 'target_element_light' | 'target_element_dark'
/**
 * Caller slot — which char skill is casting the damage event. The base
 * three (S1/S2/S3) cover the standard active skills; B1/B2/B3 are the
 * burst variants that REPLACE S3 when the user casts under burst.
 *
 * Each burst variant has its own `Skill_19/20/21` entry in the templet
 * with distinct `DamageFactor` + buff list, so the formula treats them
 * as separate slots rather than S3 multipliers.
 */
export type CallerSlot = 'S1' | 'S2' | 'S3' | 'B1' | 'B2' | 'B3'
export interface BuffTrigger {
  requires: TriggerCondition
  callerSlots: 'all' | CallerSlot[]
}

// ── Applies-to ───────────────────────────────────────────────────────────
export type AppliesToKind = 'element' | 'class' | 'subclass' | 'char' | 'all'
export interface AppliesTo {
  kind: AppliesToKind
  value: string | null
}

// ── Source ───────────────────────────────────────────────────────────────
export type AwakeningGroup = 'PVE' | 'ELEMENTAL' | 'JOB' | 'UTILITY' | 'ADVENTURE_LICENSE'
/**
 * EE buff source kind — sourced from `ItemTemplet[ITS_EQUIP_EXCLUSIVE] →
 * MainOptionGroupID/UniqueOptionID → ItemOptionTemplet/ItemSpecialOptionTemplet
 * → BuffTemplet`. Filtered by the lab's `eeEnabled` toggle and `eeLevel` slider.
 *
 * `slot`:
 *   - `'main'`: mainstat (single buff, scales by EE level via BuffTemplet
 *     Level 1-11 = EE level 0-10).
 *   - `'passive'`: lv0 baseline passive (extracted at buff-templet Level=1,
 *     active when `eeLevel >= 0`).
 *   - `'passive_add'`: lv10 IsAdd=True passive (active only when `eeLevel >= 10`).
 */
export type BuffSource =
  | { kind: 'awakening'; nodeId: string; group: AwakeningGroup; buffId: string }
  | { kind: 'char_skill'; charId: string; skillSlot: number; buffId: string }
  | { kind: 'ee'; charId: string; slot: 'main' | 'passive' | 'passive_add'; buffId: string }

// ── ApplicableBuff ───────────────────────────────────────────────────────
export interface BuffEffect {
  target: EffectTarget
  unit: '%' | 'flat' | 'permille'
  amount: number
  /** ST_* — for scaling_swap / scaling_add_* / scaling_target_stat. */
  statRef?: string
  /** Discriminator for `target === 'pool_cond'`. */
  poolCond?: PoolCondition
  /**
   * EE-specific level-keyed amounts (length 11, index = EE level 0-10).
   * Set on EE mainstat buffs whose `BuffTemplet` ships 11 Level rows. The
   * reducer reads `eeLevelValues[ctx.eeLevel]` instead of `amount` when
   * present. Non-scaling EE passives leave this `undefined` and use `amount`.
   */
  eeLevelValues?: number[]
}

export interface ApplicableBuff {
  /** Unique key (used for React lists, dedup). */
  id: string
  source: BuffSource
  appliesTo: AppliesTo
  effect: BuffEffect
  trigger: BuffTrigger
  /** UI metadata — populated only for awakening buffs (the quirks panel rows). */
  ui?: {
    name: string
    desc: string
    defaultEnabled: boolean
    maxLevel: number
  }
}

// ── BuffContext — fed to the reducer ─────────────────────────────────────
export interface BuffContext {
  // Caster identity — drives buff filtering.
  charId: string
  charElement: string
  charClass: string
  charSubclass: string
  slot: CallerSlot
  // Conditional gates.
  isBoss: boolean
  crit: boolean
  elem: 'none' | 'adv' | 'disadv'
  applyQuirks: boolean
  /**
   * True iff the selected stage is in DM_ADVENTURE_MISSION / DM_ADVENTURE_CHALLENGE.
   * Adventure License (paid awakening tier) only fires there.
   */
  inAdventureLicense: boolean
  // Stat readouts — needed for scaling math (BT_SWAP_STAT_ATTACK / BT_DMG_OWNER_STAT).
  baseAtk: number
  /** Caster-side ST_* → numeric. */
  statValues: Record<string, number>
  /** Target-side ST_* → numeric (Noa S2 BT_DMG_TARGET_STAT reads ST_HP from here). */
  targetStatValues?: Record<string, number>
  // ── Pool-condition inputs (BT_DMG_*). Defaults: HP rates → 1 (full), counts
  //    and flags → 0/false (no contribution). The lab UI sets the ones it knows
  //    about; the rest stay at defaults.
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
  /** MY_TEAM_DECREASE (type 103) — count of dead/missing allies. Default 0. */
  teamDecreaseCount?: number
  /**
   * ENEMY_TEAM_DECREASE (type 94) — count of dead/missing enemies on the
   * opposing team (max team − alive count). Default 0.
   *
   * NEW in v2: separated from `teamDecreaseCount` per PR 4bis (the binary
   * uses a different multiplier source for type 94 vs type 103).
   */
  enemyTeamDecreaseCount?: number
  inMonadGate?: boolean
  inTower?: boolean
  inPvp?: boolean
  /**
   * Caster has their unique resource stack maxed (Noa: Kaizer Energy 5/5,
   * etc.). Gates buffs whose `BuffConditionType: OWNER_RESOURCE` triggered
   * `requires: 'resource'`. Surfaced via `CharFlags.ownerResourceMax`.
   */
  ownerResourceMax?: boolean
  /**
   * Caster has a Defense Up buff active. Gates buffs whose
   * `BuffConditionType: OWNER_HAS_BUFF=6` triggered `requires: 'caster_def_up'`
   * (Veronica core fusion). Surfaced via the `a-buff-def` external buff
   * toggle (active when value > 0).
   */
  casterDefUp?: boolean
  /**
   * EE equipped — gates `source.kind === 'ee'` buffs. When false, no EE buff
   * fires regardless of `eeLevel`.
   */
  eeEnabled?: boolean
  /**
   * EE level (0-10) — picks the per-level value for scaling EE buffs and
   * gates `source.slot === 'passive_add'` (only active when eeLevel >= 10).
   */
  eeLevel?: number
  /**
   * Target's element name (`'Earth' | 'Water' | 'Fire' | 'Light' | 'Dark'`)
   * — drives `target_element_*` trigger conditions used by EE mainstats and
   * boss `TARGET_ELEMENT` conditions. Sourced from monster metadata.
   */
  targetElement?: string
}

// ── Reducer output ───────────────────────────────────────────────────────
export interface ReducedBuffs {
  /** Additive pool % (gear dmgInc + char/awakening/boss buffs combined). */
  poolPct: number
  // Stat additions — for UI breakdown attribution.
  atkBonusFlat: number
  atkBonusPct: number
  chdBonus: number
  penBonus: number
  critRateBonus: number
  // Target debuffs — pushed to the monster stats endpoint.
  monsterEffPermille: number
  monsterResPermille: number
  // Damage scaling output for the formula.
  mainAtk: number
  /**
   * BT_DMG_TARGET_STAT modeled as a pool addition (binary-faithful).
   * Set when a `scaling_target_stat` buff fires; consumed by `formula.ts`
   * via `targetStatPermille` (capped at 1000 inside the formula).
   */
  targetStatPermille: number
  /** Active buffs (those whose trigger fired) — for UI breakdown / debugging. */
  active: ApplicableBuff[]
  /** Step-by-step f32 trace — always populated. UI shows it on demand. */
  debugSteps: { label: string; value: number; note?: string }[]
}

const PER_MILLE_POS = f(RODATA.PER_MILLE_POS)

// ── Reducer ──────────────────────────────────────────────────────────────
export function applyBuffs(buffs: ApplicableBuff[], ctx: BuffContext): ReducedBuffs {
  const out: ReducedBuffs = {
    poolPct: 0,
    atkBonusFlat: 0, atkBonusPct: 0,
    chdBonus: 0, penBonus: 0, critRateBonus: 0,
    monsterEffPermille: 0, monsterResPermille: 0,
    mainAtk: ctx.baseAtk,
    targetStatPermille: 0,
    active: [],
    debugSteps: [],
  }
  const trace = (label: string, value: number, note?: string): void => {
    out.debugSteps.push({ label, value, note })
  }

  // Track scaling intent — apply swap before add (mainAtk is the post-swap base).
  let swapApplied = false

  for (const b of buffs) {
    // EE buffs bypass the `appliesToCaster` check: `appliesTo` is keyed to the
    // EE owner (base char id), but a CF wearer's `ctx.charId` is the CF id.
    // The recompute filter already gated EE buffs by `source.charId === eeCharId`,
    // so the wearer/owner mismatch is intentional and correct.
    if (b.source.kind !== 'ee' && !appliesToCaster(b.appliesTo, ctx)) continue
    if (!ctx.applyQuirks && b.source.kind === 'awakening') continue
    if (b.source.kind === 'awakening' && b.source.group === 'ADVENTURE_LICENSE' && !ctx.inAdventureLicense) continue
    // EE gating — applies to `kind: 'ee'` buffs only.
    if (b.source.kind === 'ee') {
      if (!ctx.eeEnabled) continue
      if (b.source.slot === 'passive_add' && (ctx.eeLevel ?? 0) < 10) continue
    }
    if (!triggerMatches(b.trigger, ctx)) continue

    out.active.push(b)

    // EE mainstat scales by EE level — use the level-keyed value when present
    // (BuffTemplet ships 11 Level rows for the mainstat buff). Non-scaling
    // buffs use `b.effect.amount`.
    const eeLv = ctx.eeLevel ?? 0
    const amt = b.effect.eeLevelValues?.[eeLv] ?? b.effect.amount

    switch (b.effect.target) {
      case 'pool':
        out.poolPct += amt
        break
      case 'pool_cond': {
        const mult = poolCondMultiplier(b.effect.poolCond, ctx)
        if (mult !== 0) out.poolPct += amt * mult
        break
      }
      case 'atk_flat':  out.atkBonusFlat   += amt; break
      case 'atk_pct':   out.atkBonusPct    += amt; break
      case 'chd':       out.chdBonus       += amt; break
      case 'pen':       out.penBonus       += amt; break
      case 'crit_rate': out.critRateBonus  += amt; break
      case 'monster_eff': out.monsterEffPermille += amt * 10; break  // % → per-mille
      case 'monster_res': out.monsterResPermille += amt * 10; break
      case 'scaling_swap': {
        // First swap wins (multi-swap chars don't exist today).
        if (swapApplied) break
        const sv = ctx.statValues[b.effect.statRef ?? ''] ?? 0
        out.mainAtk = sv * amt / 1000
        swapApplied = true
        break
      }
      case 'scaling_add_flat': {
        // Stella HP: per-mille of the stat, added flat to ATK.
        const sv = ctx.statValues[b.effect.statRef ?? ''] ?? 0
        out.mainAtk += sv * amt / 1000
        break
      }
      case 'scaling_add_pct': {
        // Regina CHC: separate damage component (no pool). Folded into pool too
        // here for now via mainAtk → simpler. If a future char has both flat-add
        // and pct-add at once, the order matters — adjust then.
        const sv = ctx.statValues[b.effect.statRef ?? ''] ?? 0
        out.atkBonusFlat += out.mainAtk * (sv / 100) * (amt / 1000)
        break
      }
      case 'scaling_target_stat': {
        // BT_DMG_TARGET_STAT — exact f32 emulation of CCharacterData.GetStatValuePermille
        // (VA 0x2737274) + the FindBuffAdditionalDamage type 87 handler (VA 0x2637824).
        const sv = ctx.targetStatValues?.[b.effect.statRef ?? ''] ?? 0
        if (sv > 0) {
          const statF32 = f(sv)
          const valF32  = f(b.effect.amount)
          const step1   = f32mul(statF32, PER_MILLE_POS)        // stat × 0.001
          const step2   = f32mul(step1, valF32)                  // × val
          const result  = Math.floor(step2)                       // fcvtms toward −∞
          out.targetStatPermille = f32add(out.targetStatPermille, result)
          trace(`[BT_DMG_TARGET_STAT] stat input (${b.effect.statRef})`, sv, `from buff ${b.id}`)
          trace(`[BT_DMG_TARGET_STAT] val (per-mille)`, b.effect.amount, 'from BuffTemplet Value')
          trace('[BT_DMG_TARGET_STAT] step1 = stat × 0.001 (f32)', step1)
          trace('[BT_DMG_TARGET_STAT] step2 = step1 × val (f32)', step2)
          trace('[BT_DMG_TARGET_STAT] permille = floor(step2)', result, 'fcvtms toward −∞')
        }
        break
      }
    }
  }

  return out
}

// Resolve a PoolCondition into a multiplier (caller multiplies it by amount).
// Each branch mirrors the binary's behavior in FindBuffAdditionalDamage or the
// dedicated FindBuffEnemyTeamDecreaseDamageRate. Defaults: HP rates → 1.0
// (full HP, no contribution), counts → 0, flags → false.
function poolCondMultiplier(cond: PoolCondition | undefined, ctx: BuffContext): number {
  if (!cond) return 0
  switch (cond) {
    case 'owner_lost_hp':       return Math.max(0, 1 - (ctx.ownerHpRate ?? 1))
    case 'target_lost_hp':      return Math.max(0, 1 - (ctx.targetHpRate ?? 1))
    case 'caster_lost_hp':      return Math.max(0, 1 - (ctx.casterHpRate ?? ctx.ownerHpRate ?? 1))
    case 'owner_buff':          return ctx.ownerBuffCount        ?? 0
    case 'target_buff':         return ctx.targetBuffCount       ?? 0
    case 'owner_debuff':        return ctx.ownerDebuffCount      ?? 0
    case 'target_debuff':       return ctx.targetDebuffCount     ?? 0
    case 'team_buff':           return ctx.teamBuffCount         ?? 0
    case 'team_decrease':       return ctx.teamDecreaseCount     ?? 0
    case 'enemy_team_decrease': return ctx.enemyTeamDecreaseCount ?? 0
    case 'kill_count_stack':    return ctx.killCountStack        ?? 0
    case 'target_break':        return ctx.targetBroken ? 1 : 0
    case 'not_critical':        return ctx.crit ? 0 : 1
    case 'pvp_content':         return ctx.inPvp ? 1 : 0
    case 'monadgate_content':   return ctx.inMonadGate ? 1 : 0
    case 'tower_content':       return ctx.inTower ? 1 : 0
  }
}

function appliesToCaster(at: AppliesTo, ctx: BuffContext): boolean {
  switch (at.kind) {
    case 'all':      return true
    case 'element':  return at.value === ctx.charElement
    case 'class':    return at.value === ctx.charClass
    case 'subclass': return at.value === ctx.charSubclass
    case 'char':     return at.value === ctx.charId
  }
}

function triggerMatches(t: BuffTrigger, ctx: BuffContext): boolean {
  if (t.callerSlots !== 'all' && !t.callerSlots.includes(ctx.slot)) return false
  switch (t.requires) {
    case 'always':   return true
    case 'boss':     return ctx.isBoss
    case 'crit':     return ctx.crit
    case 'adv':      return ctx.elem === 'adv'
    case 'disadv':   return ctx.elem === 'disadv'
    case 'neutral':  return ctx.elem === 'none'
    case 'resource': return !!ctx.ownerResourceMax
    case 'caster_def_up': return !!ctx.casterDefUp
    case 'target_element_earth': return ctx.targetElement === 'Earth'
    case 'target_element_water': return ctx.targetElement === 'Water'
    case 'target_element_fire':  return ctx.targetElement === 'Fire'
    case 'target_element_light': return ctx.targetElement === 'Light'
    case 'target_element_dark':  return ctx.targetElement === 'Dark'
  }
}
