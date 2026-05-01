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

export interface DamageCalcTranscendCharEntry {
  /** Char's starting rarity (1-3 ★). Tiers run from `basicStar` up to 9. */
  basicStar: number
  tiers: DamageCalcTranscendTier[]
  /** Stat keys this char grants to allies via its transcend, e.g. `["ATK", "SPD"]`. */
  teamBonuses?: string[]
}

export interface DamageCalcTranscendFile {
  _v: string
  byChar: Record<string, DamageCalcTranscendCharEntry>
}

export function getDamageCalcTranscend(): Promise<DamageCalcTranscendFile> {
  return readDamageCalcJson<DamageCalcTranscendFile>('transcend.json')
}
