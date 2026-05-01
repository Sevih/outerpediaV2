import { readDamageCalcJson } from './_cache'

/**
 * Server-side reader for the baked character roster.
 * Source: `public/damage-calc/manifest.json` + `public/damage-calc/chars/{id}.json`.
 * Browser fetches the same files directly — no API hop.
 */

export interface DamageCalcCharSummary {
  id: string
  slug: string
  name: string
  name_jp?: string
  name_kr?: string
  name_zh?: string
  element: string
  class: string
  subclass: string
  rarity: number
  role?: string
  rank?: string
  iconUrl: string
  /** CF chars: id of the base char they originate from. */
  baseCharId?: string
  /** Base chars: id of their CF variant if one exists. */
  coreFusionId?: string
}

export interface DamageCalcCharManifest {
  _v: string
  chars: DamageCalcCharSummary[]
}

export interface DamageCalcSkillDetail {
  name: string
  name_jp?: string
  name_kr?: string
  name_zh?: string
  iconName: string
  /** Index 0 = level 1, length 5. Null entries = no DamageFactor at that level. */
  damageFactors: (number | null)[]
  additionalAttackRatio: number | null
}

export interface DamageCalcStatsStep {
  ATK: number; DEF: number; HP: number; SPD: number
  EFF: number; RES: number; CHC: number; CHD: number
  DMG_RED: number; DMG_INC: number
}

export interface DamageCalcCharDetail {
  _v: string
  id: string
  skills: {
    S1: DamageCalcSkillDetail | null
    S2: DamageCalcSkillDetail | null
    S3: DamageCalcSkillDetail | null
  }
  /** Six evolution steps (`lv1_ev0` … `lv100_ev5`). Null when no curated stats exist. */
  baseStats: Record<string, DamageCalcStatsStep> | null
}

export function getDamageCalcCharManifest(): Promise<DamageCalcCharManifest> {
  return readDamageCalcJson<DamageCalcCharManifest>('manifest.json')
}

export function getDamageCalcCharDetail(charId: string): Promise<DamageCalcCharDetail> {
  return readDamageCalcJson<DamageCalcCharDetail>(`chars/${charId}.json`)
}
