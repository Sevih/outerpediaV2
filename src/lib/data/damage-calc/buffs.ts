import { readDamageCalcJson } from './_cache'
import type { ApplicableBuff } from '@/lib/damage/v2/buffs'

/**
 * Server-side reader for the baked buff catalog.
 * Source: `public/damage-calc/buffs/awakening.json` (shared) + `buffs/{charId}.json` (per-char).
 *
 * The split is intentional — awakening buffs apply across many chars based
 * on `appliesTo` (element/class/...) so they're loaded once and filtered
 * client-side. Per-char files only contain `char_skill` + `ee` buffs whose
 * `source.charId` matches (with a CF-union for core-fusion chars: their
 * file additionally includes the base char's EE buffs).
 */

export interface DamageCalcAwakeningBuffs {
  _v: string
  buffs: ApplicableBuff[]
}

export interface DamageCalcCharBuffs {
  _v: string
  charId: string
  buffs: ApplicableBuff[]
}

export function getDamageCalcAwakeningBuffs(): Promise<DamageCalcAwakeningBuffs> {
  return readDamageCalcJson<DamageCalcAwakeningBuffs>('buffs/awakening.json')
}

export function getDamageCalcCharBuffs(charId: string): Promise<DamageCalcCharBuffs> {
  return readDamageCalcJson<DamageCalcCharBuffs>(`buffs/${charId}.json`)
}
