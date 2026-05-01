/**
 * Public API of the damage-calculator data layer.
 *
 * All accessors here are server-side (use `fs` under the hood). The browser
 * reads the same baked files directly via `fetch('/damage-calc/...')` — see
 * the public-route fetch helper in `src/app/[lang]/tools/damage-calculator/`.
 */

export {
  getDamageCalcCharManifest,
  getDamageCalcCharDetail,
} from './chars'

export type {
  DamageCalcCharSummary,
  DamageCalcCharManifest,
  DamageCalcSkillDetail,
  DamageCalcStatsStep,
  DamageCalcCharDetail,
} from './chars'

export {
  getDamageCalcAwakeningBuffs,
  getDamageCalcCharBuffs,
} from './buffs'

export type {
  DamageCalcAwakeningBuffs,
  DamageCalcCharBuffs,
} from './buffs'

export {
  getDamageCalcMonsters,
} from './monsters'

export type {
  DamageCalcLangMap,
  DamageCalcMonsterStats,
  DamageCalcMonsterEntry,
  DamageCalcMonstersFile,
} from './monsters'

export {
  getDamageCalcMechanicsIndex,
  getDamageCalcMechanics,
} from './mechanics'

export type {
  DamageCalcMechanicsIndex,
  DamageCalcMechanicsFile,
} from './mechanics'

export {
  getDamageCalcTranscend,
} from './transcend'

export type {
  DamageCalcTranscendTier,
  DamageCalcTranscendCharEntry,
  DamageCalcTranscendFile,
} from './transcend'
