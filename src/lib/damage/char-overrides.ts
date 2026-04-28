/**
 * Per-character damage overrides — exceptions that don't fit any data-driven
 * pattern in the datamine and need to be hardcoded after empirical validation.
 *
 * Every entry here is anchored to a specific (charId, slot) pair and carries
 * a comment block citing the validation evidence (obs ratios from the
 * damage-lab) so future readers can audit the rationale.
 *
 * The overrides are applied inside `recompute()` (see `recompute.ts`) — they
 * transform the listed `damageFactor` and/or the `additionalAttackRatio`
 * before the formula runs, so the rest of the pipeline (buffs, formula,
 * breakdown) stays oblivious to the special-casing.
 */
import type { SlotTag } from './recompute'

export interface CharOverride {
  // Multiplier applied to the listed `damageFactor` before any formula step.
  // Use case: chars where the in-game listed DF doesn't equal the actually-fired
  // DF. Ame's S1 is the canonical example — listed=1630 at lv5 but the actual
  // hit fires at half that value, with no data-driven signal explaining the
  // factor (it's game-code logic for her two-stance passive).
  dfMultiplier?: number

  // List of conditional modifiers. Each gates on a specific UI flag and applies
  // its own behavior to the formula. Multiple modifiers can apply per cast,
  // though in practice the flags they gate on are mutually exclusive (e.g.
  // Ame's Ume / Sakura states are determined by target HP at S3 cast time).
  //
  // When multiple conditionals fire, they apply in order — the last `replace`
  // wins for `mainDF`, the last `add` wins for `additionalAttackRatio`.
  conditionals?: ConditionalModifier[]
}

export interface ConditionalModifier {
  // The UI flag that gates this modifier.
  flag: keyof CharFlags
  // Sub-attack ratio (DF as a multiple of main DF). Mode is "ADD" by default:
  // a separate additional hit fires at `mainDF × ratio`, going through the
  // formula independently. Total damage = main + additional.
  ratio: number
  // When true, on `adv` targets the alternate fires INSTEAD of main: mainDF
  // is scaled by `ratio`, no separate additional. Empirical match for Ame S1
  // when Sakura is active on already-adv targets — the alternate replaces
  // main rather than stacking, total damage = listed × 1.0 (not 1.5).
  replaceOnAdv?: boolean
}

// UI-fed flags that gate certain overrides. Surfaced in the damage-lab page as
// per-char toggles; persisted in the saved Observation so recompute on the obs
// table sees the same state.
export interface CharFlags {
  // Ame: S3 cast grants either Ume (target HP > 90% at cast time, BT_2000065_A)
  // or Sakura (target HP < 90%, BT_2000065_B). Each state gates a different
  // S1 behavior, so they need separate flags:
  //   - umeActive   → priority gain + adds an alternate S1 hit (ADD mode)
  //   - sakuraActive → adds an alternate S1 hit + grants element superiority on
  //                    S1; on already-adv targets the alternate REPLACES main
  // The exact mapping is being empirically validated — these flags let the
  // user record which buff was active per obs.
  umeActive?: boolean
  sakuraActive?: boolean
}

// Override table keyed by `${charId}:${slot}`. Multi-slot overrides for the
// same char need separate entries.
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
  // CharacterSkillLevelTemplet, CharacterDamageTemplet (no per-row scaling
  // field), or any BuffTemplet entry. It's game-code logic specific to Ame's
  // two-stance Ume/Sakura passive — the listed DF likely represents
  // (main_hit + buffed_extra) for tooltip purposes, while the actual fired
  // value depends on whether the BT_2000065_A (Ume) or BT_2000065_B (Sakura)
  // state is active on the caster.
  '2000065:S1': {
    dfMultiplier: 0.5,
    conditionals: [
      // Ume (priority gain): alternate hit fires as a separate ADD on top of
      // main, ratio 2.0 = listed × 1.0 add component. Validated empirically on
      // 5 obs across boss/non-boss × crit/no-crit × neutral/disadv targets,
      // all matching at ratio 1.000 ±0.007.
      { flag: 'umeActive', ratio: 2.0 },
      // Sakura (element superiority on S1):
      //   - on adv targets the alternate REPLACES main (total = listed × 1.0,
      //     validated on Penguineer no-boss adv at ratio 1.000);
      //   - on non-adv it ADDS like Ume (ratio 1.013-1.016 on 2 obs across
      //     Amadeus / Minima boss neutral no-crit).
      // KNOWN LIMITATION: on non-adv + crit the actual add fires at ~1.83-1.85×
      // main instead of 2.0×, producing a stable 5-6% shortfall (validated
      // across 3 obs at ratio 0.942 / 0.945 / 0.951 — different ATK, target,
      // and chd values, all converging on the same pattern). No clean formula
      // explains the reduction; suspected game-code interaction between
      // BT_DMG_ELEMENT_SUPERIORITY and crit DR pierce. Acceptable as-is —
      // model fits 14/16 obs (only Sakura+crit non-adv slightly off).
      { flag: 'sakuraActive', ratio: 2.0, replaceOnAdv: true },
    ],
  },
}

export function getCharOverride(charId: string, slot: SlotTag): CharOverride | null {
  return CHAR_OVERRIDES[`${charId}:${slot}`] ?? null
}
