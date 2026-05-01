import { readDamageCalcJson } from './_cache'
import type { MonsterMechanics } from '@/lib/damage/v2/extract-monster'

/**
 * Server-side reader for the baked monster mechanics catalog.
 * Source: `public/damage-calc/mechanics/_index.json` + `mechanics/{monsterId}.json`.
 *
 * The index lists which monsters have non-empty passives — load it
 * alongside `monsters.json` so the picker can flag mechanics-bearing
 * targets without per-row 404 probes. The full payload is fetched only
 * when the user opens the mechanics toggle for the selected target.
 */

export interface DamageCalcMechanicsIndex {
  _v: string
  /** Resolved templet IDs that have at least one extracted passive. */
  monsterIds: string[]
}

export interface DamageCalcMechanicsFile {
  _v: string
  data: MonsterMechanics
}

export function getDamageCalcMechanicsIndex(): Promise<DamageCalcMechanicsIndex> {
  return readDamageCalcJson<DamageCalcMechanicsIndex>('mechanics/_index.json')
}

export function getDamageCalcMechanics(monsterId: string): Promise<DamageCalcMechanicsFile> {
  return readDamageCalcJson<DamageCalcMechanicsFile>(`mechanics/${monsterId}.json`)
}
