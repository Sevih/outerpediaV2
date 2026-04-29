/**
 * Unified buff schema for the damage-lab.
 *
 * Goal: every modifier that can affect a damage calculation (Awakening pool
 * bonus, char passive +50% boss, scaling swap/add, target-side eff/res
 * debuff, future PEN-vs-boss, etc.) flows through ONE flat list of
 * `ApplicableBuff` entries. The page-side reducer (`applyBuffs`) folds the
 * list into the inputs `computeDamage` expects, gated by the current context
 * (slot / isBoss / crit / elem).
 *
 * Sources are decoded server-side once (see `_shared/extract-buffs.ts`) and
 * exposed via `/api/admin/damage-lab/buffs`.
 */

// ── Effect target — what stat / pool the buff modifies ──────────────────
export type EffectTarget =
  // Caster pool — additive % point in the damage formula's pool modifier.
  // Sources: BT_DMG cond=NONE/condition, BT_DMG_TO_BOSS, Awakening_Boss_Dmg_*,
  //          Awakening_Element_Dmg_*, Awakening_Element_Dmg_Dark_Light_*.
  | 'pool'
  // Caster pool — CONDITIONAL additive %, scaled by a context multiplier.
  // Encoded with `effect.poolCond` to discriminate the multiplier source.
  // Confirmed via libil2cpp.so disasm of CCharacterBattle.FindBuffAdditionalDamage
  // (VA 0x2637548): each BT_DMG_* type contributes `value/1000 × multiplier`
  // to the running rate, where multiplier depends on the type:
  //   owner_lost_hp     (84) → max(0, 1 − ownerHpRate)
  //   target_lost_hp    (85) → max(0, 1 − targetHpRate)
  //   owner_buff        (88) → ownerBuffCount  (positive caster buffs)
  //   target_buff       (89) → targetBuffCount (positive target buffs)
  //   owner_debuff      (90) → ownerDebuffCount (negative caster buffs)
  //   target_debuff     (91) → targetDebuffCount (negative target buffs)
  //   target_break      (95) → 1 if target.RageManager.IsBreak else 0
  //   kill_count_stack  (97) → 1 (Value already encodes per-stack contribution)
  //   not_critical      (98) → 1 if !crit else 0
  //   pvp_content       (99) → 1 if inPvp else 0
  //   caster_lost_hp    (101) → max(0, 1 − casterHpRate)  (orig caster, ≈ owner)
  //   team_buff         (102) → teamBuffCount (sum across team)
  //   team_decrease     (103) → teamDecreaseCount (dead/decreased team count)
  //   monadgate_content (104) → 1 if inMonadGate else 0
  //   tower_content     (105) → 1 if inTower else 0
  | 'pool_cond'
  // Caster stat additions — folded into ATK / CHD / PEN / CRIT% before the
  // formula. Most of these come from Awakening BT_STAT_PREMIUM / class passive
  // (Skill_22) and are already in the stats API output, but having them here
  // too lets the reducer offer a "buffs-only" view if ever needed.
  | 'atk_pct' | 'atk_flat'
  | 'chd' | 'crit_rate'
  | 'pen'
  // Target debuffs — pushed to the monster stats endpoint as effDebuff/resDebuff
  // query params. Source: Awakening_Boss_*_Down_* BT_STAT_PREMIUM rows whose
  // negative ST_BUFF_RESIST/CHANCE the engine retargets onto the boss.
  | 'monster_eff' | 'monster_res'
  // Damage scaling — replaces ATK or adds a separate component. statRef is the
  // ST_* key of the source stat (ST_HP / ST_DEF / ST_CRITICAL_RATE / etc.).
  // Validated:
  //   swap      → BT_SWAP_STAT_ATTACK (Caren DEF×1.30, Veronica HP×0.20)
  //   add_pct   → BT_DMG_OWNER_STAT on a percentage stat (Regina CHC×0.5)
  //   add_flat  → BT_DMG_OWNER_STAT on a flat stat (Stella HP×0.03 added to ATK)
  | 'scaling_swap' | 'scaling_add_pct' | 'scaling_add_flat'
  // Target-stat scaling — separate damage component (Noa S2 +3% × HP).
  | 'scaling_target_stat'

// Conditional pool multiplier source (only valid when target === 'pool_cond').
// Each value matches one BT_DMG_* enum case in the binary; see EffectTarget
// header for the per-case multiplier formula.
export type PoolCondition =
  | 'owner_lost_hp' | 'target_lost_hp'
  | 'owner_buff' | 'target_buff' | 'owner_debuff' | 'target_debuff'
  | 'target_break' | 'kill_count_stack'
  | 'not_critical' | 'pvp_content'
  | 'caster_lost_hp'
  | 'team_buff' | 'team_decrease'
  | 'monadgate_content' | 'tower_content'

// ── Trigger — when does the buff fire ───────────────────────────────────
// All triggers are evaluated on the page-side reducer with the current context
// (`isBoss`, `crit`, `elem`, `slot`, `applyQuirks`). A buff with all gates
// satisfied contributes its effect; otherwise it sits dormant.
export type TriggerCondition = 'always' | 'boss' | 'crit' | 'adv' | 'disadv' | 'neutral'
export type CallerSlot = 'S1' | 'S2' | 'S3'
export interface BuffTrigger {
  requires: TriggerCondition
  callerSlots: 'all' | CallerSlot[]
}

// ── Applies-to — which character benefits ──────────────────────────────
// 'all' for utility/PVE quirks; 'element' / 'class' / 'subclass' for Awakening
// gifts; 'char' for char-specific buffs (charId in source.kind='char_skill').
export type AppliesToKind = 'element' | 'class' | 'subclass' | 'char' | 'all'
export interface AppliesTo {
  kind: AppliesToKind
  value: string | null
}

// ── Source — provenance of the buff (for debugging + UI breakdown) ──────
export type AwakeningGroup = 'PVE' | 'ELEMENTAL' | 'JOB' | 'UTILITY' | 'ADVENTURE_LICENSE'
export type BuffSource =
  | { kind: 'awakening'; nodeId: string; group: AwakeningGroup; buffId: string }
  | { kind: 'char_skill'; charId: string; skillSlot: number; buffId: string }

// ── ApplicableBuff — one entry in the flat list ─────────────────────────
export interface ApplicableBuff {
  id: string                          // unique key (used for React lists, dedup)
  source: BuffSource
  appliesTo: AppliesTo
  effect: {
    target: EffectTarget
    unit: '%' | 'flat' | 'permille'   // permille kept raw for scaling_swap/_add (×valuePerMille/1000)
    amount: number
    statRef?: string                  // ST_* — for scaling_swap / scaling_add_*
    poolCond?: PoolCondition          // discriminator for target === 'pool_cond'
  }
  trigger: BuffTrigger
  // UI metadata — populated only for awakening buffs (the quirks panel rows).
  ui?: {
    name: string
    desc: string
    defaultEnabled: boolean
    maxLevel: number
  }
}

// ── Context fed to the reducer ──────────────────────────────────────────
export interface BuffContext {
  // Caster identity — buffs filter to this char's element / class / subclass / id.
  charId: string
  charElement: string                 // 'Fire' | 'Water' | 'Earth' | 'Light' | 'Dark'
  charClass: string                   // 'Mage' | 'Attacker' | 'Defender' | 'Ranger' | 'Priest' (in-game label)
  charSubclass: string                // uppercase (matches AppliesTo.value when kind='subclass')
  slot: CallerSlot                    // currently-selected active skill (S1/S2/S3)
  // Conditional gates — all booleans / enums the trigger compares against.
  isBoss: boolean
  crit: boolean
  elem: 'none' | 'adv' | 'disadv'
  // Master toggle — when false, awakening buffs are dropped (char-specific
  // buffs always fire, they're intrinsic to the character's design).
  applyQuirks: boolean
  // True iff the selected stage belongs to the "Adventure License" mode
  // category (DM_ADVENTURE_MISSION / DM_ADVENTURE_CHALLENGE). The paid
  // Adventure License awakening tier (`licence_Awakening_*`, group=
  // ADVENTURE_LICENSE) only fires inside those modes — every other category
  // suppresses them, regardless of `applyQuirks`.
  inAdventureLicense: boolean
  // Debug capture — when true, the reducer populates `ReducedBuffs.debugSteps`
  // with every f32 step of GetStatValuePermille (target_stat path).
  debugSteps?: boolean
  // Stat readouts — needed for scaling math. Map of ST_* → numeric value.
  // The reducer uses these for `scaling_add_pct` (CHC% × valuePerMille) and
  // `scaling_swap` (replaces ATK with statRef × valuePerMille / 1000).
  baseAtk: number                     // current ATK input (used as fallback when no swap)
  statValues: Record<string, number>  // ST_HP / ST_DEF / ST_CRITICAL_RATE / etc. → numeric (caster-side)
  // Target-side stat readouts — used by `scaling_target_stat` (BT_DMG_TARGET_STAT).
  // Validated: Noa S2 BT_DMG_TARGET_STAT ST_HP val=30 (3% of target HP) — produces a
  // sub-attack that scales on the target stat. Map of ST_* → numeric (target HP / DEF / etc).
  targetStatValues?: Record<string, number>

  // ── Conditional-pool inputs (BT_DMG_* types resolved by the binary's
  // FindBuffAdditionalDamage). All optional, default 0/false → no contribution
  // (= same behavior as before this layer existed). The lab UI sets the ones
  // it knows about; the rest stay at defaults. Each maps 1:1 to a PoolCondition
  // enum value above; see the EffectTarget header for the per-type formula.
  ownerHpRate?: number          // 0..1, caster HP fraction. Default 1 (full).
  targetHpRate?: number         // 0..1, target HP fraction. Default 1.
  casterHpRate?: number         // 0..1, original-caster HP. Default ownerHpRate.
  ownerBuffCount?: number       // # of positive buffs on caster. Default 0.
  targetBuffCount?: number      // # of positive buffs on target. Default 0.
  ownerDebuffCount?: number     // # of debuffs on caster. Default 0.
  targetDebuffCount?: number    // # of debuffs on target. Default 0.
  targetBroken?: boolean        // target Rage broken. Default false.
  killCountStack?: number       // kill count this combat. Default 0.
  teamBuffCount?: number        // sum of positive buffs across allies. Default 0.
  teamDecreaseCount?: number    // # of dead/decreased allies. Default 0.
  inMonadGate?: boolean         // mode = Monad Gate. Default false.
  inTower?: boolean             // mode = Elemental Tower. Default false.
  inPvp?: boolean               // mode = PVP. Default false.
}

// ── Reducer output ──────────────────────────────────────────────────────
// All values are ready to feed `computeDamage` (or its callers).
export interface ReducedBuffs {
  // Additive pool % (gear dmgInc + char/awakening/boss buffs combined). Caller
  // adds this to its own dmgIncPct stat to get the final pool input.
  poolPct: number
  // Stat additions. Currently the stats API already folds awakening BT_STAT_PREMIUM
  // into the prefilled ATK/CHD/PEN, but the reducer still reports the deltas so the
  // UI breakdown can attribute them. Caller chooses to use or ignore them.
  atkBonusFlat: number
  atkBonusPct: number
  chdBonus: number
  penBonus: number
  critRateBonus: number
  // Target debuffs (per-mille, signed). Pushed to the monster stats endpoint.
  monsterEffPermille: number
  monsterResPermille: number
  // Damage scaling — final mainAtk + addAtkNoPool to feed the formula.
  // mainAtk: post-SWAP, post-flat-ADD ATK that goes through the pool path.
  // addAtkNoPool: percentage-stat ADD contribution that bypasses the pool (Regina).
  mainAtk: number
  addAtkNoPool: number
  // BT_DMG_TARGET_STAT modeled as a permille pool addition (matches the binary
  // exactly, including int truncation in GetStatValuePermille). Set when a
  // scaling_target_stat buff fires; the formula's f32 path uses this in lieu
  // of `addAtkNoPool` to reproduce game damage to within float rounding.
  addAtkNoPoolPermille: number
  // Active buffs (those whose trigger fired) — for UI breakdown / debugging.
  active: ApplicableBuff[]
  // Debug trace — populated only when `debugSteps: true` on the BuffContext.
  // Captures GetStatValuePermille's f32 chain step by step so the lab UI can
  // pinpoint where game runtime diverges from our emulation.
  debugSteps?: { label: string; value: number; note?: string }[]
}

// ── Reducer ─────────────────────────────────────────────────────────────
// Pure function: given a list of buffs + a context, returns the reduced inputs.
// Filtering pipeline:
//   1. Drop buffs whose `appliesTo` doesn't match the caster.
//   2. If `applyQuirks` is off, drop awakening buffs (Awakening tree is the
//      "opt-in quirk layer"). Char-specific buffs always fire — they're
//      intrinsic to the character's skill design (scaling, conditional PEN,
//      char-specific BT_DMG_TO_BOSS, …).
//   3. Drop buffs whose trigger condition isn't satisfied.
//   4. Drop buffs whose callerSlots doesn't include the current slot.
//   5. Sum / fold the surviving effects per target.
//
// Some buffs that look "always-on" (e.g. char-specific BT_DMG_TO_BOSS) are
// modeled with `requires:'boss'` so the same condition pipeline handles them.
export function applyBuffs(buffs: ApplicableBuff[], ctx: BuffContext): ReducedBuffs {
  const out: ReducedBuffs = {
    poolPct: 0,
    atkBonusFlat: 0, atkBonusPct: 0,
    chdBonus: 0, penBonus: 0, critRateBonus: 0,
    monsterEffPermille: 0, monsterResPermille: 0,
    mainAtk: ctx.baseAtk, addAtkNoPool: 0, addAtkNoPoolPermille: 0,
    active: [],
    debugSteps: ctx.debugSteps ? [] : undefined,
  }
  const trace = (label: string, value: number, note?: string) => {
    if (out.debugSteps) out.debugSteps.push({ label, value, note })
  }

  // Track scaling intent — we apply swap before add (mainAtk is the post-swap base
  // that flat-add stacks on, and add_pct multiplies by post-swap mainAtk).
  let swapApplied = false

  for (const b of buffs) {
    if (!appliesToCaster(b.appliesTo, ctx)) continue
    if (!ctx.applyQuirks && b.source.kind === 'awakening') continue
    // Adventure License (paid awakening tier) — only fires inside
    // DM_ADVENTURE_MISSION / DM_ADVENTURE_CHALLENGE modes.
    if (b.source.kind === 'awakening' && b.source.group === 'ADVENTURE_LICENSE' && !ctx.inAdventureLicense) continue
    if (!triggerMatches(b.trigger, ctx)) continue

    out.active.push(b)

    switch (b.effect.target) {
      case 'pool':
        out.poolPct += b.effect.amount
        break
      case 'pool_cond': {
        // Conditional pool: amount × multiplier. Multiplier resolves from the
        // BuffContext field that matches `poolCond`. Default-zero context fields
        // produce zero contribution → invisible by default in the lab.
        const mult = poolCondMultiplier(b.effect.poolCond, ctx)
        if (mult !== 0) out.poolPct += b.effect.amount * mult
        break
      }
      case 'atk_flat': out.atkBonusFlat += b.effect.amount; break
      case 'atk_pct':  out.atkBonusPct  += b.effect.amount; break
      case 'chd':       out.chdBonus       += b.effect.amount; break
      case 'pen':       out.penBonus       += b.effect.amount; break
      case 'crit_rate': out.critRateBonus  += b.effect.amount; break
      case 'monster_eff': out.monsterEffPermille += b.effect.amount * 10; break  // % → per-mille
      case 'monster_res': out.monsterResPermille += b.effect.amount * 10; break
      case 'scaling_swap': {
        // First swap wins. (Multi-swap chars don't exist today.) statRef is the
        // ST_* of the source stat; amount is per-mille (1000 = 1:1, 1300 = ×1.30).
        if (swapApplied) break
        const sv = ctx.statValues[b.effect.statRef ?? ''] ?? 0
        out.mainAtk = sv * b.effect.amount / 1000
        swapApplied = true
        break
      }
      case 'scaling_add_flat': {
        // Stella HP: amount = per-mille of the stat's value, added flat to ATK.
        const sv = ctx.statValues[b.effect.statRef ?? ''] ?? 0
        out.mainAtk += sv * b.effect.amount / 1000
        break
      }
      case 'scaling_add_pct': {
        // Regina CHC: separate damage component (no pool). Computed AFTER the
        // mainAtk stabilizes (pre-pool path bypass) — but since add_pct doesn't
        // depend on subsequent additions, we can compute it here referencing the
        // current mainAtk. If a char ever has both flat-add and pct-add at the
        // same time, the order matters; since none do (yet), this is fine.
        const sv = ctx.statValues[b.effect.statRef ?? ''] ?? 0
        out.addAtkNoPool += out.mainAtk * (sv / 100) * (b.effect.amount / 1000)
        break
      }
      case 'scaling_target_stat': {
        // BT_DMG_TARGET_STAT — exact f32 emulation of CCharacterData.GetStatValuePermille
        // (VA 0x2737274) followed by the FindBuffAdditionalDamage type 87 handler
        // (VA 0x2637824). See formula.ts header for the full chain.
        const sv = ctx.targetStatValues?.[b.effect.statRef ?? ''] ?? 0
        if (sv > 0) {
          const PER_MILLE_F32 = Math.fround(0.001)
          const statF32  = Math.fround(sv)
          const valF32   = Math.fround(b.effect.amount)
          const step1    = Math.fround(statF32 * PER_MILLE_F32)   // stat × 0.001
          const step2    = Math.fround(step1 * valF32)            // × val
          const result   = Math.floor(step2)                       // fcvtms (toward -inf)
          out.addAtkNoPoolPermille += result
          out.addAtkNoPool += out.mainAtk * sv * b.effect.amount / 1_000_000
          // Debug trace — exposes the EXACT f32 path so the lab UI can show
          // the user where their target_stat permille comes from. Working back
          // from obs lets the user check if the binary's `result` differs.
          trace(`[BT_DMG_TARGET_STAT] stat input (${b.effect.statRef})`, sv, `from buff ${b.id}`)
          trace(`[BT_DMG_TARGET_STAT] val (per-mille)`, b.effect.amount, `from BuffTemplet Value`)
          trace(`[BT_DMG_TARGET_STAT] step1 = stat × 0.001 (f32)`, step1, '= s0 = s1 × s9 in binary')
          trace(`[BT_DMG_TARGET_STAT] step2 = step1 × val (f32)`, step2, '= s8 = s0 × s2 in binary')
          trace(`[BT_DMG_TARGET_STAT] permille = floor(step2)`, result, 'fcvtms toward −∞ (return int32_t)')
        }
        break
      }
    }
  }

  return out
}

// Resolve a PoolCondition into a multiplier (caller multiplies it by amount).
// Each branch mirrors the binary's behavior in FindBuffAdditionalDamage.
// Missing context defaults: HP rates → 1.0 (full HP), counts → 0, flags → false.
function poolCondMultiplier(cond: PoolCondition | undefined, ctx: BuffContext): number {
  if (!cond) return 0
  switch (cond) {
    case 'owner_lost_hp':
      return Math.max(0, 1 - (ctx.ownerHpRate ?? 1))
    case 'target_lost_hp':
      return Math.max(0, 1 - (ctx.targetHpRate ?? 1))
    case 'caster_lost_hp':
      return Math.max(0, 1 - (ctx.casterHpRate ?? ctx.ownerHpRate ?? 1))
    case 'owner_buff':       return ctx.ownerBuffCount    ?? 0
    case 'target_buff':      return ctx.targetBuffCount   ?? 0
    case 'owner_debuff':     return ctx.ownerDebuffCount  ?? 0
    case 'target_debuff':    return ctx.targetDebuffCount ?? 0
    case 'team_buff':        return ctx.teamBuffCount     ?? 0
    case 'team_decrease':    return ctx.teamDecreaseCount ?? 0
    case 'kill_count_stack': return ctx.killCountStack    ?? 0
    case 'target_break':       return ctx.targetBroken ? 1 : 0
    case 'not_critical':       return ctx.crit ? 0 : 1
    case 'pvp_content':        return ctx.inPvp ? 1 : 0
    case 'monadgate_content':  return ctx.inMonadGate ? 1 : 0
    case 'tower_content':      return ctx.inTower ? 1 : 0
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
  // Caller-slot gate
  if (t.callerSlots !== 'all' && !t.callerSlots.includes(ctx.slot)) return false
  // Condition gate
  switch (t.requires) {
    case 'always':  return true
    case 'boss':    return ctx.isBoss
    case 'crit':    return ctx.crit
    case 'adv':     return ctx.elem === 'adv'
    case 'disadv':  return ctx.elem === 'disadv'
    case 'neutral': return ctx.elem === 'none'
  }
}
