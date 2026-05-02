import type { LangMap } from '@/types/common'
import { readDamageCalcJson } from './_cache'

/**
 * Server-side reader for the baked equipment passives catalog.
 * Source: `public/damage-calc/equipment.json`.
 *
 * Browser fetches the same file directly via `fetch('/damage-calc/equipment.json')`
 * — no API hop. Loaded eagerly at page boot from `index.tsx` (single ~50-100KB file).
 *
 * The bake reads json2 directly (`ItemTemplet` + `ItemSpecialOptionTemplet`
 * + `BuffTemplet` + `TextItem` + `TextSkill`) and keeps only the structured
 * data the calc needs: name (4 langs), class restriction, effect label +
 * its underlying `BuffTemplet` rows. Stat-only sets are filtered out
 * because their bonuses are already in the user's typed stat block.
 *
 * No description text is exposed — the UI renders the scaling directly
 * from the buff Values (one entry per enchant level).
 *
 * Names use the canonical project-wide `LangMap` shape (`{ en?, jp?, kr?, zh? }`)
 * so `lRec()` from `@/lib/i18n/localize` works directly without casts.
 */

/**
 * Single buff entry — stripped down to fields the recompute pipeline needs
 * for runtime evaluation (gating, target type, scaling). Mirrors the
 * structure in `pipeline/steps/damage-calc/build-equipment.ts`.
 */
export interface DamageCalcBuffEntry {
  buffId: string
  /** BuffTemplet `Type` (BT_DMG, BT_DMG_TARGET_STAT, BT_STAT_PREMIUM, ...). */
  type: string
  /**
   * Per-level scaling values. `values[0]` = enchant level 1, `values[N-1]`
   * = max enchant. Length varies by buff (5 for most, 11 for EE main stats).
   */
  values: number[]
  statType?: string
  applyingType?: string
  // Runtime gating fields preserved verbatim; absent when not set in templet.
  targetType?: string
  buffCreateType?: string
  buffConditionType?: string
  buffConditionValue?: string
  callerSkillType?: string
  targetSkillType?: string
  turnDuration?: number
}

export interface DamageCalcEffectGroup {
  /**
   * Passive label (e.g. "Destruction") in 4 langs. Optional — EE main
   * stats omit this since the in-game label is element-derived
   * ("vs Fire DMG↑%") rather than a fixed text id; the UI builds it
   * from `targetElement` + the buff stat tag.
   */
  name?: LangMap
  /** Passive icon — lives under `/images/ui/effect/{iconName}.webp`. */
  iconName?: string
  /**
   * For EE main stats only: the element the conditional triggers on
   * (`Earth`/`Water`/`Fire`/`Light`/`Dark`). Parsed from the buff ID
   * suffix at bake time. Absent for other groups.
   */
  targetElement?: string
  /** Composing buffs — usually 1 entry, sometimes more for composite passives. */
  buffs: DamageCalcBuffEntry[]
}

export interface DamageCalcEquipmentItem {
  /** Stable ID = ItemTemplet ID of the 6★ variant (5★ when no 6★ exists). */
  id: string
  name: LangMap
  /** Item icon — lives under `/images/equipment/{iconName}.webp`. */
  iconName?: string
  /**
   * Class restriction (`CCT_ATTACKER`, `CCT_DEFENDER`, ...) when the item
   * can only be equipped by a given class. Undefined when class-agnostic.
   */
  classLimit?: string
  /** The passive effect — null when no buff is mapped (rare). */
  effect: DamageCalcEffectGroup | null
}

export interface DamageCalcEquipmentSet {
  /** GroupID from ItemSpecialOptionTemplet — stable across releases. */
  id: string
  name: LangMap
  /** Set icon — lives under `/images/ui/effect/{iconName}.webp`. */
  iconName?: string
  /** 2-piece bonus — null when the set has no 2-pc passive. */
  bonus2: DamageCalcEffectGroup | null
  /** 4-piece bonus — null when the set has no 4-pc passive. */
  bonus4: DamageCalcEffectGroup | null
}

export interface DamageCalcEquipmentEE {
  /** charId this EE is bound to (= ItemTemplet ID = key in `ees`). */
  charId: string
  name: LangMap
  /** Item icon — lives under `/images/characters/ee/{charId}.webp`. */
  iconName?: string
  /**
   * Element-conditional main stat (e.g. -DMG vs Earth). Buff values cover
   * 11 enchant levels (lv 0 → lv 10) and gate via `BuffConditionType =
   * TARGET_ELEMENT`. The UI renders the label from `targetElement` +
   * the buff's stat tag.
   */
  mainStat: DamageCalcEffectGroup | null
  /** Baseline passive (always active). */
  passiveLv0: DamageCalcEffectGroup | null
  /** Additional passive unlocked at EE level 10. */
  passiveLv10: DamageCalcEffectGroup | null
}

export interface DamageCalcEquipmentFile {
  _v: string
  weapons: DamageCalcEquipmentItem[]
  accessories: DamageCalcEquipmentItem[]
  talismans: DamageCalcEquipmentItem[]
  sets: DamageCalcEquipmentSet[]
  /** Indexed by charId — direct lookup for the perso's EE + base CF EE. */
  ees: Record<string, DamageCalcEquipmentEE>
}

export function getDamageCalcEquipment(): Promise<DamageCalcEquipmentFile> {
  return readDamageCalcJson<DamageCalcEquipmentFile>('equipment.json')
}
