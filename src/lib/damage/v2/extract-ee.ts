/**
 * Server-side decoder: ItemTemplet (`ITS_EQUIP_EXCLUSIVE`) → flat list of
 * `ApplicableBuff` for character-specific Exclusive Equipment.
 *
 * Walk plan:
 *   ItemTemplet[ItemSubType=ITS_EQUIP_EXCLUSIVE]
 *     ├── MainOptionGroupID  → ItemOptionTemplet[GroupID] → BuffID
 *     │   └── BuffTemplet[BuffID, Level=1..11] (scaling: Level N = EE level N-1)
 *     └── UniqueOptionID (csv)
 *         ├── ItemSpecialOptionTemplet[GroupID, Level=1, IsAdd=False]
 *         │   └── BuffID (csv) → lv0 baseline passives → slot='passive'
 *         └── ItemSpecialOptionTemplet[GroupID, Level=10, IsAdd=True]
 *             └── BuffID (csv) → lv10 add passive    → slot='passive_add'
 *
 * Phase 1a (mainstat) + Phase 1b (lv0/lv10 passives) — both implemented here.
 * Skips (per empirical validation against obs 1-50):
 *   - `BT_STAT_PREMIUM` (already in displayed ATK/DEF/HP — adding would double-count)
 *   - `BT_GROUP` (composite — value indexes a `BuffGroupTemplet` ID; deferred to 1c)
 *   - `BT_ACTION_GAUGE` / `BT_COOL3_CHARGE` (utility — AP/CP gen, no damage)
 *   - `TargetType !== ME` (ally-side; PASSIVE/PASSIVE2 MY_TEAM allowed since
 *     the caster is part of the team — same rule as char_skill extraction)
 *   - Defensive-only effects (`BT_DMG_REDUCE`) — passive damage-taken modifiers
 *     don't affect outgoing damage.
 *
 * Phase 1c (future): BT_GROUP composite resolution (Maxwell lv10 PEN+30%).
 */

import type { ApplicableBuff } from './buffs'
import { decodeCharSkillEffect, resolveCondition, resolveCallerSlots, type BuffRow } from './extract-buffs'

type Row = Record<string, string | undefined>

interface ItemRow {
  ID?: string
  NameID?: string
  ItemSubType?: string
  CharacterLimit?: string
  MainOptionGroupID?: string
  UniqueOptionID?: string
}

interface ItemOptionRow {
  GroupID?: string
  OptionType?: string
  StatType?: string
  BuffID?: string
}

interface ItemSpecialOptionRow {
  GroupID?: string
  Level?: string
  IsAdd?: string
  BuffID?: string
}

export interface ExtractEEInput {
  items: Row[]                  // ItemTemplet rows
  itemOptions: Row[]            // ItemOptionTemplet rows
  itemSpecialOptions: Row[]     // ItemSpecialOptionTemplet rows
  buffs: BuffRow[]              // BuffTemplet rows
  /**
   * Optional `NameID → English` map sourced from `TextItem.json`. When
   * provided, every emitted EE buff carries `ui.name = <EE display name>`
   * (e.g. Maxwell EE "Agateram") so the lab's variant picker can label
   * the dropdown by the in-game item name instead of "own/base EE".
   */
  textItem?: Map<string, string>
}

/**
 * EE-specific BuffTemplet level lookup: groups buff rows by `BuffID` and
 * returns `[Level=1, Level=2, …, Level=11]` sorted ascending. The mainstat
 * buff has 11 rows whose `Value` scales with EE level (the lv0 = Level=1
 * convention is the binary's, kept here for fidelity).
 */
function indexBuffsByLevel(buffs: BuffRow[]): Map<string, BuffRow[]> {
  const out = new Map<string, BuffRow[]>()
  for (const b of buffs) {
    if (!b.BuffID) continue
    const arr = out.get(b.BuffID) ?? []
    arr.push(b)
    out.set(b.BuffID, arr)
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => parseInt(a.Level ?? '0', 10) - parseInt(b.Level ?? '0', 10))
  }
  return out
}

function indexOptionsByGroup(rows: ItemOptionRow[]): Map<string, ItemOptionRow[]> {
  const out = new Map<string, ItemOptionRow[]>()
  for (const r of rows) {
    const g = r.GroupID
    if (!g) continue
    const arr = out.get(g) ?? []
    arr.push(r)
    out.set(g, arr)
  }
  return out
}

function indexSpecialByGroup(rows: ItemSpecialOptionRow[]): Map<string, ItemSpecialOptionRow[]> {
  const out = new Map<string, ItemSpecialOptionRow[]>()
  for (const r of rows) {
    const g = r.GroupID
    if (!g) continue
    const arr = out.get(g) ?? []
    arr.push(r)
    out.set(g, arr)
  }
  return out
}

/** Buff types we don't propagate from EE passives — utility/defensive/composite. */
const SKIP_PASSIVE_TYPES = new Set([
  'BT_STAT_PREMIUM',      // ATK/DEF/HP already in displayed input
  'BT_GROUP',             // composite (deferred to phase 1c)
  'BT_ACTION_GAUGE',      // AP gauge utility
  'BT_COOL3_CHARGE',      // skill cooldown utility
  'BT_DMG_REDUCE',        // defensive (taken damage)
  'BT_DMG_REDUCE_FINAL',  // defensive
  'BT_HEAL', 'BT_HEAL_PERCENT', 'BT_SHIELD_BASED_CASTER',  // heal/shield utility
  'BT_REMOVE_BUFF', 'BT_REMOVE_DEBUFF',                     // utility
  'BT_AGGRO',                                              // taunt utility
  'BT_CALL_BACKUP', 'BT_CALL_BACKUP_2',                    // ally call (separate damage instance)
])

/**
 * Decode a single EE passive `BuffRow` (lv0 base or lv10 add) into an
 * ApplicableBuff. Returns null when the buff is utility/defensive/composite
 * and shouldn't propagate into the damage formula.
 */
function buildPassiveBuff(
  row: BuffRow,
  charId: string,
  slot: 'passive' | 'passive_add',
  buffId: string,
): ApplicableBuff | null {
  if (SKIP_PASSIVE_TYPES.has(row.Type ?? '')) return null
  // Caster-side only. Same rule as `extractCharSkillBuffs`: ME always; MY_TEAM
  // accepted only when permanent (PASSIVE/PASSIVE2). Non-permanent MY_TEAM
  // buffs apply AFTER the cast — they can't lift the current hit.
  const target = row.TargetType ?? ''
  const isPermanent = row.BuffCreateType === 'PASSIVE' || row.BuffCreateType === 'PASSIVE2'
  if (target !== 'ME' && !(target === 'MY_TEAM' && isPermanent)) return null

  const eff = decodeCharSkillEffect(row)
  if (!eff) return null
  const requires = resolveCondition(row.BuffConditionType, row.BuffConditionValue)
  if (!requires) return null

  // Slot restriction from CallerSkillType (e.g. Asphodel CF Veronica passive
  // `BID_CEQUIP_2700037` is `SKT_SECOND` — fires only on S2 / Sword Destroyer).
  // Drop the buff entirely if it's burst-only (CallerSkillType resolves to []).
  const filterSlots = resolveCallerSlots(row.CallerSkillType)
  if (filterSlots !== 'all' && filterSlots.length === 0) return null
  return {
    id: `ee:${charId}:${slot}:${buffId}`,
    source: { kind: 'ee', charId, slot, buffId },
    appliesTo: { kind: 'char', value: charId },
    effect: eff,
    trigger: { requires, callerSlots: filterSlots },
  }
}

export function extractEEBuffs(input: ExtractEEInput): ApplicableBuff[] {
  const buffsByLevel = indexBuffsByLevel(input.buffs)
  const optsByGroup = indexOptionsByGroup(input.itemOptions as ItemOptionRow[])
  const specialByGroup = indexSpecialByGroup(input.itemSpecialOptions as ItemSpecialOptionRow[])
  const out: ApplicableBuff[] = []

  for (const item of input.items as ItemRow[]) {
    if (item.ItemSubType !== 'ITS_EQUIP_EXCLUSIVE') continue
    const charId = item.CharacterLimit
    if (!charId || charId === '0') continue

    // EE display name (e.g. "Agateram" for Maxwell). Falls back to the EE
    // ID when the text map is missing — keeps the catalog buildable in
    // contexts where TextItem isn't loaded.
    const eeName = (item.NameID && input.textItem?.get(item.NameID)) || item.ID || charId
    const ui = { name: eeName, desc: '', defaultEnabled: false, maxLevel: 10 }

    // ── Mainstat (single buff scaled across 11 levels) ─────────────────
    const mainGroup = item.MainOptionGroupID
    if (mainGroup) {
      const opts = optsByGroup.get(mainGroup) ?? []
      for (const opt of opts) {
        // Mainstat is `OptionType=IOT_BUFF` with a single `BuffID`. The
        // displayed-stat sub-options (`IOT_STAT` ATK/DEF/HP) are already in the
        // user's stat input — skip them.
        if (opt.OptionType !== 'IOT_BUFF' || !opt.BuffID) continue

        const buffId = opt.BuffID.trim()
        const levels = buffsByLevel.get(buffId)
        if (!levels || levels.length === 0) continue

        // Level=1 row is the canonical decode source (Type/StatType/cond
        // are stable across all 11 levels — only Value changes).
        const base = levels[0]
        if (base.TargetType && base.TargetType !== 'ME') continue
        if (base.Type === 'BT_DMG_REDUCE' || base.Type === 'BT_DMG_REDUCE_FINAL') continue

        const eff = decodeCharSkillEffect(base)
        if (!eff) continue
        const requires = resolveCondition(base.BuffConditionType, base.BuffConditionValue)
        if (!requires) continue

        // Per-level value array (length 11, EE level 0..10 = BuffTemplet
        // Level 1..11). Buffs with fewer than 11 rows fall back to the
        // highest available level for the missing tail.
        const levelValues: number[] = new Array(11).fill(0)
        let lastValue = 0
        for (let i = 0; i < 11; i++) {
          const row = levels.find(l => parseInt(l.Level ?? '0', 10) === i + 1)
          if (row) {
            const raw = parseInt(row.Value ?? '0', 10)
            lastValue = eff.unit === '%' ? raw / 10 : raw
          }
          levelValues[i] = lastValue
        }

        // Mainstat CallerSkillType is typically SKT_ALL but a few EEs pin it
        // to a specific slot — respect it the same way char_skill does.
        const mainSlots = resolveCallerSlots(base.CallerSkillType)
        if (mainSlots !== 'all' && mainSlots.length === 0) continue   // burst-only — drop
        out.push({
          id: `ee:${charId}:main:${buffId}`,
          source: { kind: 'ee', charId, slot: 'main', buffId },
          appliesTo: { kind: 'char', value: charId },
          effect: { ...eff, eeLevelValues: levelValues },
          trigger: { requires, callerSlots: mainSlots },
          ui,
        })
      }
    }

    // ── Passives (lv0 base + lv10 IsAdd) ───────────────────────────────
    // UniqueOptionID is csv of group IDs in `ItemSpecialOptionTemplet`.
    // Each group can hold multiple Level rows — we map Level=1 → 'passive'
    // (always-on once EE is equipped) and Level=10 IsAdd=True →
    // 'passive_add' (gated `eeLevel >= 10` in the reducer).
    if (item.UniqueOptionID) {
      for (const groupId of item.UniqueOptionID.split(',').map(s => s.trim())) {
        if (!groupId) continue
        const rows = specialByGroup.get(groupId) ?? []
        for (const row of rows) {
          const slot: 'passive' | 'passive_add' = row.IsAdd === 'True' ? 'passive_add' : 'passive'
          const buffIds = (row.BuffID ?? '').split(',').map(s => s.trim()).filter(Boolean)
          for (const buffId of buffIds) {
            const levels = buffsByLevel.get(buffId)
            if (!levels || levels.length === 0) continue
            const base = levels[levels.length - 1]   // pick max level (most passives ship a single Level=1)
            const buff = buildPassiveBuff(base, charId, slot, buffId)
            if (buff) out.push({ ...buff, ui })
          }
        }
      }
    }
  }

  return out
}
