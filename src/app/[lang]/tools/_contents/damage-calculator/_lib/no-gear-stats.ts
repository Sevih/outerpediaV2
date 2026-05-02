import type {
  DamageCalcCodexEntry,
  DamageCalcNoGearStats,
  DamageCalcStatContribution,
  DamageCalcTranscendTier,
} from '@/lib/data/damage-calc'
import type { StatValues } from '../_state/types'
import { INITIAL_STATS } from '../_state/types'

/**
 * Compose a char's no-gear stat block from baked contributors + user settings.
 *
 * Mirrors the admin route's `calcStat` formula
 * (`src/app/api/admin/characters/[id]/stats/route.ts`):
 *
 *   compoundPct = ((1 + transcend/100) × (1 + Σpct/100) − 1) × 100
 *   onBase      = codex + compoundPct          (applied to base ATK/DEF/HP)
 *   onFlat      = compoundPct                  (applied to evo + flat bonuses)
 *   final ATK   = floor(base × (1 + onBase/100) + flat × (1 + onFlat/100))
 *
 * Only ATK/DEF/HP go through the codex × transcend × pct compound. Other
 * stats (SPD/EFF/RES, %-points stats CHC/CHD/PEN/DMG↑) are pure additive.
 *
 * `transcendTier` may be null when the char has no transcend chain (or the
 * picked tier is below `basicStar` — defensive default).
 */

/**
 * In-game quirk gift categories surfaced in Settings. `pve` and
 * `adventureLicense` are accepted but currently no-op in the stat
 * computation — they're BT_DMG-only and will be wired into recompute
 * once the ResultPanel ships.
 */
export interface QuirksToggles {
  element: boolean
  job: boolean
  pve: boolean
  adventureLicense: boolean
}

export interface ComputeFinalStatsArgs {
  noGear: DamageCalcNoGearStats
  codex: DamageCalcCodexEntry
  transcendTier: DamageCalcTranscendTier | null
  quirks: QuirksToggles
  /** TransStar key into `noGear.skill8ByTransStar`. */
  transStar: number
}

/** Read a possibly-undefined sparse contribution field as a number. */
const v = (c: DamageCalcStatContribution, key: keyof DamageCalcStatContribution): number => c[key] ?? 0

/** Sum a single field across the contributors that are currently active. */
function sumField(blocks: DamageCalcStatContribution[], key: keyof DamageCalcStatContribution): number {
  let total = 0
  for (const b of blocks) total += v(b, key)
  return total
}

/** Replicates the admin route's `calcStat` exactly — float arithmetic, single floor at the end. */
function calcStat(baseMax: number, flat: number, pctBonus: number, codexPct: number, transcendPct: number): number {
  const compoundPct = ((1 + transcendPct / 100) * (1 + pctBonus / 100) - 1) * 100
  const onBase = codexPct + compoundPct
  const onFlat = compoundPct
  return Math.floor(baseMax * (1 + onBase / 100) + flat * (1 + onFlat / 100))
}

export function computeFinalStats(args: ComputeFinalStatsArgs): StatValues {
  const { noGear, codex, transcendTier, quirks, transStar } = args
  const skill8 = noGear.skill8ByTransStar[String(transStar)] ?? {}

  // Active contributors. Base + evolution + classPassive + skill8 are
  // always-on; quirks gated by per-category toggles.
  const flatBlocks: DamageCalcStatContribution[] = [noGear.evolution, noGear.classPassive, skill8]
  const pctBlocks: DamageCalcStatContribution[]  = [noGear.classPassive, skill8]
  if (quirks.element) { flatBlocks.push(noGear.quirks.element); pctBlocks.push(noGear.quirks.element) }
  if (quirks.job)     { flatBlocks.push(noGear.quirks.job);     pctBlocks.push(noGear.quirks.job) }

  const transAtkPct = (transcendTier?.atkRate ?? 0) / 10
  const transDefPct = (transcendTier?.defRate ?? 0) / 10
  const transHpPct  = (transcendTier?.hpRate  ?? 0) / 10

  const baseAtk = v(noGear.base, 'atk')
  const baseDef = v(noGear.base, 'def')
  const baseHp  = v(noGear.base, 'hp')

  return {
    ATK: calcStat(baseAtk, sumField(flatBlocks, 'atk'), sumField(pctBlocks, 'atkPct'), codex.atkPct, transAtkPct),
    DEF: calcStat(baseDef, sumField(flatBlocks, 'def'), sumField(pctBlocks, 'defPct'), codex.defPct, transDefPct),
    HP:  calcStat(baseHp,  sumField(flatBlocks, 'hp'),  sumField(pctBlocks, 'hpPct'),  codex.hpPct,  transHpPct),
    SPD: v(noGear.base, 'spd') + sumField(flatBlocks, 'spd'),
    CHC: v(noGear.base, 'chc') + sumField(flatBlocks, 'chc'),
    CHD: v(noGear.base, 'chd') + sumField(flatBlocks, 'chd'),
    EFF: v(noGear.base, 'eff') + sumField(flatBlocks, 'eff'),
    RES: v(noGear.base, 'res') + sumField(flatBlocks, 'res'),
    // PEN comes from quirks/passives only (no base value); DMG↑ same logic.
    PEN: sumField(flatBlocks, 'pen'),
    DMG_INC: sumField(flatBlocks, 'dmgInc'),
  }
}

/**
 * Read the codex row for a given level. Defensive against an out-of-range
 * value in stored settings (returns the lv 0 / no-codex row in that case).
 */
export function pickCodexEntry(codexTable: DamageCalcCodexEntry[], level: number): DamageCalcCodexEntry {
  const row = codexTable.find(e => e.level === level)
  if (row) return row
  return codexTable[0] ?? { level: 0, atkPct: 0, defPct: 0, hpPct: 0 }
}

/**
 * Convenience for components that need the panel-default fallback. Mirrors
 * the no-char baseline — used when the char-detail load fails.
 */
export function fallbackStats(): StatValues {
  return { ...INITIAL_STATS }
}
