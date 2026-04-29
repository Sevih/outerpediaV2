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
      //   - on non-adv it ADDS like Ume (ratio 1.013-1.016 on 2 obs).
      //
      // KNOWN LIMITATION: on non-adv + crit the add fires at ~1.83-1.85× main
      // instead of 2.0×, producing a stable 5-6% shortfall (3 obs converging
      // at ratio 0.942-0.951). No clean formula explains it; suspected game-code
      // interaction between BT_DMG_ELEMENT_SUPERIORITY and crit DR pierce.
      // Acceptable as-is — model fits 14/16 Ame obs.
      { flag: 'sakuraActive', ratio: 2.0, replaceOnAdv: true },
    ],
  },
}

export function getCharOverride(charId: string, slot: CallerSlot): CharOverride | null {
  return CHAR_OVERRIDES[`${charId}:${slot}`] ?? null
}
