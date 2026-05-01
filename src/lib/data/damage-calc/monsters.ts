import { readDamageCalcJson } from './_cache'

/**
 * Server-side reader for the baked target catalog.
 * Source: `public/damage-calc/monsters.json`.
 */

export interface DamageCalcLangMap {
  en?: string
  jp?: string
  kr?: string
  zh?: string
}

export interface DamageCalcMonsterStats {
  def: number
  hp: number
  atk: number
  /** Already in % (per-mille from the binary divided by 10). */
  drPct: number
  /** Per-mille (matches `ST_BUFF_RESIST` raw encoding). */
  buffResist: number
}

export interface DamageCalcMonsterEntry {
  id: string
  monsterId: string
  dungeonId: string
  name: DamageCalcLangMap
  stage: DamageCalcLangMap
  mode: DamageCalcLangMap
  level: number
  isBoss: boolean
  element: string
  class: string
  icons: string
  stats: DamageCalcMonsterStats
}

export interface DamageCalcMonstersFile {
  _v: string
  stages: DamageCalcMonsterEntry[]
}

export function getDamageCalcMonsters(): Promise<DamageCalcMonstersFile> {
  return readDamageCalcJson<DamageCalcMonstersFile>('monsters.json')
}
