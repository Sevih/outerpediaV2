/**
 * Per-character damage overrides — exceptions that don't fit any data-driven
 * pattern in the datamine and need to be hardcoded after empirical validation
 * (Ame's Ume/Sakura S1, future char-specific cases).
 *
 * Each entry is anchored to a `(charId, slot)` pair and carries the validation
 * evidence in its comment block (obs ratios from the lab) so future readers
 * can audit the rationale.
 *
 * Applied inside `recompute()` — they transform the listed `damageFactor` and/or
 * the `additionalAttackRatio` BEFORE the formula runs, so the rest of the
 * pipeline (buffs, formula, breakdown) stays oblivious to the special-casing.
 *
 * The lab UI derives the per-char flag list from `CharOverride.conditionals[].flag`
 * — single source of truth, no duplication in the UI layer.
 */

import type { CallerSlot } from './buffs'

export interface CharOverride {
  /**
   * Multiplier applied to the listed `damageFactor` before any formula step.
   * Use case: chars where the in-game listed DF doesn't equal the actually-fired
   * DF (Ame's S1 listed=1630 lv5 fires at half — game-code logic for her two-stance
   * Ume/Sakura passive).
   */
  dfMultiplier?: number

  /**
   * List of conditional modifiers. Each gates on a UI flag (`charFlags`) and
   * applies its own behavior. When multiple fire, they apply in order — the last
   * `replace` wins for `mainDF`, the last `add` wins for `additionalAttackRatio`.
   */
  conditionals?: ConditionalModifier[]
}

export interface ConditionalModifier {
  /** UI flag that gates this modifier. */
  flag: keyof CharFlags
  /**
   * Sub-attack ratio (DF as a multiple of main DF).
   *
   * Default mode (ADD): a separate additional hit fires at `mainDF × ratio`,
   * going through the formula independently. Total damage = main + additional.
   */
  ratio: number
  /**
   * When true, on `adv` targets the alternate REPLACES main: `mainDF` is scaled
   * by `ratio`, no separate additional. Empirical match for Ame S1 when Sakura
   * is active on already-adv targets.
   */
  replaceOnAdv?: boolean
  /**
   * Empirical multiplier applied to the FINAL damage value, gated by crit
   * state. Used as a stop-gap when the underlying game-code logic isn't
   * fully reverse-engineered yet — see Ame Sakura non-adv (RE chore PR 4ter):
   * the actual mechanism involves `BT_DMG_ELEMENT_SUPERIORITY` (type 92)
   * with an unresolved `CASTER_HAS_BUFF=55` gate, but the deviation from
   * our model is empirically stable enough to fold into a multiplier.
   *
   * Only applied when the ADD path is taken (i.e. NOT when `replaceOnAdv`
   * fires). Applied after the formula chain (post elem mult, post final
   * reduce) — equivalent to `damage × mult` then re-floor.
   *
   * Should be removed once the proper RE lands and the modifier is wired
   * through the buff reducer.
   */
  empiricalMult?: { nonCrit?: number; crit?: number }
}

/**
 * UI-fed flags that gate certain overrides. Surfaced in the lab as per-char
 * toggles; persisted in saved obs so recompute on the obs table sees the
 * same state.
 */
export interface CharFlags {
  /**
   * Ame: S3 cast grants either Ume (target HP > 90%) or Sakura (target HP < 90%).
   * Each gates a different S1 behavior, so they need separate flags.
   */
  umeActive?: boolean
  sakuraActive?: boolean
  /**
   * Caster has their unique resource maxed out (Noa: Kaizer Energy 5/5).
   * Generic flag for any char whose datamine buff carries
   * `BuffConditionType: OWNER_RESOURCE` — the extractor maps that condition
   * to `requires: 'resource'`, the reducer's `triggerMatches` reads this
   * field, and `PerCharFlags` surfaces a toggle whenever the current
   * char/slot has at least one applicable buff with `requires === 'resource'`.
   */
  ownerResourceMax?: boolean
}

const CHAR_OVERRIDES: Record<string, CharOverride> = {
  // Ame (Earth Mage) — S1 fires at half the listed DF.
  //
  // Empirical validation (damage-lab obs, all on lv5 listed=1630):
  //   - 8 unbuffed obs (boss/non-boss × crit/no-crit × neutral/adv/disadv):
  //       ratio = 0.50 ±0.01  (i.e. main hit = listed × 0.5)
  //   - 5 buffed obs (Ume or Sakura, mixed contexts):
  //       ratio = 1.50 ±0.01  (i.e. main + add = listed × 1.5)
  //   - 5 S3 obs unbuffed: ratio = 1.00 (S3 follows the standard formula)
  //
  // Why hardcoded: the 0.5 factor doesn't appear in CharacterSkillTemplet,
  // CharacterSkillLevelTemplet, CharacterDamageTemplet, or any BuffTemplet
  // entry. It's game-code logic specific to Ame's two-stance Ume/Sakura passive.
  '2000065:S1': {
    dfMultiplier: 0.5,
    conditionals: [
      // Ume (priority gain): alternate hit fires as a separate ADD on top of main,
      // ratio 2.0 = listed × 1.0 add component. Validated on 5 obs across
      // boss/non-boss × crit/no-crit × neutral/disadv targets, ratio 1.000 ±0.007.
      { flag: 'umeActive', ratio: 2.0 },
      // Sakura (element superiority on S1):
      //   - on adv targets the alternate REPLACES main (total = listed × 1.0,
      //     validated on Penguineer no-boss adv at ratio 1.000);
      //   - on non-adv it ADDS like Ume (ratio 1.010-1.016 on 3 obs).
      //
      // KNOWN LIMITATION: on non-adv + crit the obs converges at ratio ~0.948
      // (calc OVER by 5%) — 3 obs at 0.942/0.948/0.951. No clean formula fits.
      //
      // ── RE trail (PR 4ter, partial) ──────────────────────────────────────
      //   Ame S1 carries buff `2000065_1_4` of type `BT_DMG_ELEMENT_SUPERIORITY`
      //   (= 92 / 0x5C) gated on `CASTER_HAS_BUFF=55`. Type 92 activates the
      //   "superiority path" inside `CFormula.GetElementeryDamageRate` (VA
      //   0x2B53C74), which calls `FindBuffElementSuperiority` (0x262D294)
      //   then `FindBuffElementDamageRate` (0x2639004) to sum
      //   `BT_DMG_ELEMENT_ENCHANT` (= 93 / 0x5D) values:
      //     rate = 1.20 + (sum × 0.001)    // base 1.20 from rodata 0x1033E70
      //   `CBattleManager.ProcessDamage` (~0x22A6118) ALSO branches on Ume
      //   (140) vs Sakura (141) before CalcDamage and loads different skill
      //   templates from static fields `[0x545D478]` (Ume) / `[0x545D498]`
      //   (Sakura). `2000065_Skill_1_5_B` (DF=1100) is a Sakura variant of
      //   the last hit (vs `_5` DF=100).
      //
      //   Open question: `BuffConditionValue=55` in BUFF_TYPE enum is
      //   `BT_DOT_BLEED`, but Ame doesn't carry DOT_BLEED. Empirically the
      //   gate fires for Sakura only (Ume non-adv tests match exactly).
      //   Resolving this requires either: (a) a Frida hook on
      //   `FindBuffElementSuperiority` to observe the value 55 semantics in
      //   runtime, or (b) symbol-resolved IL2CPP metadata pass to map the
      //   buff condition to its actual code path. Suspected interaction
      //   with the Sakura-loaded skill swap on the additional attack and a
      //   crit-DR-related cap in `g__CalcDamage|17_0` (post-element-mult).
      //
      //   Empirical correction: ratio=2.0 ADD + crit-gated multipliers on
      //   non-adv path. nonCrit=1.010 (latest obs at 1.0097), crit=0.948
      //   (3 obs at 0.942-0.951). To remove once §7.8 RE is closed and the
      //   proper buff modeling lands.
      {
        flag: 'sakuraActive',
        ratio: 2.0,
        replaceOnAdv: true,
        empiricalMult: { nonCrit: 1.010, crit: 0.948 },
      },
    ],
  },
}

export function getCharOverride(charId: string, slot: CallerSlot): CharOverride | null {
  return CHAR_OVERRIDES[`${charId}:${slot}`] ?? null
}
