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
