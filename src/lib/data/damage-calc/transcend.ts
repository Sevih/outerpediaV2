import { readDamageCalcJson } from './_cache'

/**
 * Server-side reader for the baked transcend catalog.
 * Source: `public/damage-calc/transcend.json`.
 *
 * Per-char entry: list of tiers (TransStar from BasicStar+1 up to 9) with
 * stat boosts (HP/ATK/DEF rate, in **per-mille** — divide by 1000 to get
 * the multiplier delta) and Burst level unlock flags. Optionally, the
 * stat keys this char grants to allies via its transcend (parsed from
 * curated text by the `characters-index` pipeline step).
 */

export interface DamageCalcTranscendTier {
  transStar: number
  /** Per-mille (templet `RewardHPRate`). 100 = +10% HP. */
  hpRate: number
  atkRate: number
  defRate: number
  /** True when this tier unlocks Burst level 2 / 3 on the char's S3. */
  burst2: boolean
  burst3: boolean
}

export interface DamageCalcTranscendTeamBonus {
  /** Stat key per `data/stats.json` (e.g. `'ATK'`, `'SPD'`, `'DMG UP%'`). */
  stat: string
  /** Magnitude in display units. For `apply: 'rate'` this is the % bonus
   *  (e.g. `5` = +5%). For `apply: 'add'` this is the additive amount —
   *  flat for SPD / EFF / RES, percentage points for CHC / CHD / DMG↑. */
  value: number
  /** `'rate'` = multiplicative on dealer's base ATK/DEF/HP (folded into
   *  the calcStat pctBonus layer). `'add'` = additive — flat for SPD/EFF/RES,
   *  percentage points for percent stats. */
  apply: 'rate' | 'add'
  /** Templet `TransStar` at which this version of the buff activates.
   *  Multiple entries per stat exist when the buff UPGRADES at higher
   *  tiers (e.g. ATK +5% at T4 → +10% at T6 → +20% at T9). Runtime picks
   *  the entry with highest `fromTransStar` ≤ current TransStar per stat. */
  fromTransStar: number
}

export interface DamageCalcTranscendCharEntry {
  /** Char's starting rarity (1-3 ★). Tiers run from `basicStar` up to 9. */
  basicStar: number
  tiers: DamageCalcTranscendTier[]
  /** Stat keys this char grants to allies via its transcend, e.g. `["ATK", "SPD"]`.
   *  Flat list parsed from curated text — kept as-is for filter UIs that
   *  don't need magnitude (e.g. characters page). */
  teamBonuses?: string[]
  /**
   * Tier-gated team bonuses — list of "buff unlocks" along the char's
   * Skill_8 chain. Resolved from `BuffTemplet` (BT_STAT_PREMIUM, MY_TEAM,
   * no condition); excludes stacking / per-turn buffs whose magnitude
   * varies in combat. Sorted by `fromTransStar` ascending. Absent for chars
   * with no permanent ally team bonuses.
   */
  teamBonusesByTier?: DamageCalcTranscendTeamBonus[]
}

export interface DamageCalcTranscendFile {
  _v: string
  byChar: Record<string, DamageCalcTranscendCharEntry>
}

export function getDamageCalcTranscend(): Promise<DamageCalcTranscendFile> {
  return readDamageCalcJson<DamageCalcTranscendFile>('transcend.json')
}
