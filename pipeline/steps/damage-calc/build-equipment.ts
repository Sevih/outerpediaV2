import { writeJsonMin, SCHEMA_VERSION } from './shared'
import { loadJson2 } from './raw-loader'

/**
 * Bake equipment passives surfaced by the damage calculator from json2 raw
 * templets. Output: `public/damage-calc/equipment.json`.
 *
 * ── Resolution chain (matches the in-game lookup) ────────────────────────
 *   ItemTemplet[ItemGrade=IG_UNIQUE]                — unique passive items
 *     ├── UniqueOptionID                            — CSV of GroupIDs
 *     │   └── ItemSpecialOptionTemplet[GroupID]     — passive effect rows
 *     │       ├── NameID  → TextSkill[UO_*_NAME]    — passive label
 *     │       ├── IconName                          — passive icon
 *     │       └── BuffID  → BuffTemplet[BuffID]     — actual scaling rows
 *     └── ClassLimit                                — class restriction (or CCT_NONE)
 *
 *   ItemSpecialOptionTemplet[OptionType_2P/4P=IOT_BUFF]  — passive sets
 *     ├── NameID    → TextItem[ST_Set_*_NAME]
 *     ├── IconName
 *     ├── BuffID_2P → BuffTemplet                   — 2-pc effect
 *     └── BuffID_4P → BuffTemplet                   — 4-pc effect
 *
 * Stat-only sets (Attack / Defense / Life / etc.) are excluded because
 * they're already in the user's typed stat block — the calc only needs
 * passives that gate on runtime conditions.
 *
 * ── Output shape ─────────────────────────────────────────────────────────
 * Each item carries: stable item ID (max-BasicStar variant), name (4 langs),
 * class restriction, effect{name, icon, buffs[]}. Buffs are kept verbatim
 * (one entry per enchant level) so the recompute pipeline can pick the
 * right Value from the user's enchant slider.
 *
 * No description text is baked — only the structured buff data + passive
 * label. The UI renders the scaling from the buff Values.
 *
 * ── Exclusion file ───────────────────────────────────────────────────────
 * `data/equipment/_calc-exclude.json` lists item/set IDs to drop (irrelevant
 * to damage builds — boss-drop curiosities, etc.). ID-based instead of
 * slug-based for stability across releases.
 */

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { PATHS } from '../../config'

type Row = Record<string, string | undefined>

interface ExcludeFile {
  weapons?: string[]      // ItemTemplet IDs (max-BasicStar variants)
  accessories?: string[]
  talismans?: string[]
  sets?: string[]         // ItemSpecialOptionTemplet GroupIDs
  ees?: string[]          // charIds
}

// ── Output types ────────────────────────────────────────────────────────────

type LangMap = { en: string; jp?: string; kr?: string; zh?: string }

/** Single buff entry — stripped down to fields the recompute pipeline needs. */
interface BuffEntry {
  buffId: string
  type: string
  /** Scaling values across enchant levels (index 0 = lv 1, length = max enchant). */
  values: number[]
  statType?: string
  applyingType?: string
  /** Runtime gating fields preserved verbatim — null when not set. */
  targetType?: string
  buffCreateType?: string
  buffConditionType?: string
  buffConditionValue?: string
  callerSkillType?: string
  targetSkillType?: string
  turnDuration?: number
}

interface EffectGroup {
  /**
   * Passive label (e.g. "Destruction"). Optional because EE main stats
   * don't carry a meaningful TextSkill name — the UI derives their label
   * from `targetElement` + the underlying stat ("vs Fire DMG↑%").
   */
  name?: LangMap
  /** Passive icon (e.g. `TI_Icon_UO_Weapon_11`). */
  iconName?: string
  /**
   * For EE main stats: the element the conditional triggers on
   * (`Earth`/`Water`/`Fire`/`Light`/`Dark`). Parsed from the buff ID
   * suffix because `BuffConditionValue` is inconsistently populated.
   * Absent for non-element-conditional groups.
   */
  targetElement?: string
  /** Composing buffs — usually 1 entry, sometimes more for composite passives. */
  buffs: BuffEntry[]
}

interface EquipmentItem {
  /** Stable ID = ItemTemplet ID of the max-BasicStar variant. */
  id: string
  name: LangMap
  iconName?: string
  /** Class restriction (e.g. CCT_ATTACKER) or undefined when CCT_NONE. */
  classLimit?: string
  /** Resolved effect — null when no UO buff is mapped (rare, datamine-incomplete). */
  effect: EffectGroup | null
}

interface EquipmentSet {
  /** GroupID from ItemSpecialOptionTemplet. */
  id: string
  name: LangMap
  iconName?: string
  /** 2-piece bonus — null when the set has no 2-pc effect. */
  bonus2: EffectGroup | null
  /** 4-piece bonus — null when the set has no 4-pc effect. */
  bonus4: EffectGroup | null
}

interface EquipmentEE {
  /** charId this EE is bound to (= ItemTemplet ID). */
  charId: string
  name: LangMap
  iconName?: string
  /** Element-conditional main stat (e.g. -DMG vs Earth). */
  mainStat: EffectGroup | null
  /** Baseline passive (level 1 / IsAdd=False). */
  passiveLv0: EffectGroup | null
  /** Additional passive unlocked at level 10 (IsAdd=True). */
  passiveLv10: EffectGroup | null
}

interface EquipmentFile {
  _v: string
  weapons: EquipmentItem[]
  accessories: EquipmentItem[]
  talismans: EquipmentItem[]
  sets: EquipmentSet[]
  /** Indexed by charId for O(1) lookup (incl. base CF picker). */
  ees: Record<string, EquipmentEE>
}

// ── Helpers ────────────────────────────────────────────────────────────────

function num(v: string | undefined): number {
  if (!v) return 0
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

function csv(s: string | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

function langFromText(textIdx: Map<string, Row>, id?: string): LangMap | null {
  if (!id) return null
  const row = textIdx.get(id)
  if (!row) return null
  return {
    en: row.English ?? id,
    jp: row.Japanese ?? undefined,
    kr: row.Korean ?? undefined,
    zh: row.China_Simplified ?? undefined,
  }
}

function buildTextIndex(rows: Row[]): Map<string, Row> {
  const out = new Map<string, Row>()
  for (const r of rows) if (r.ID) out.set(r.ID, r)
  return out
}

/** Group BuffTemplet rows by BuffID, sorted by Level ascending. */
function indexBuffsById(buffs: Row[]): Map<string, Row[]> {
  const out = new Map<string, Row[]>()
  for (const b of buffs) {
    if (!b.BuffID) continue
    const arr = out.get(b.BuffID) ?? []
    arr.push(b)
    out.set(b.BuffID, arr)
  }
  for (const arr of out.values()) arr.sort((a, b) => num(a.Level) - num(b.Level))
  return out
}

/** Pull the scaling Values across all levels of a BuffID, plus a single representative row for metadata. */
function bakeBuffEntry(buffId: string, levels: Row[]): BuffEntry | null {
  if (!levels || levels.length === 0) return null
  const first = levels[0]
  const out: BuffEntry = {
    buffId,
    type: first.Type ?? '',
    values: levels.map(r => num(r.Value)),
  }
  if (first.StatType && first.StatType !== 'ST_NONE') out.statType = first.StatType
  if (first.ApplyingType && first.ApplyingType !== 'OAT_NONE') out.applyingType = first.ApplyingType
  if (first.TargetType && first.TargetType !== 'NONE')  out.targetType = first.TargetType
  if (first.BuffCreateType)      out.buffCreateType = first.BuffCreateType
  if (first.BuffConditionType && first.BuffConditionType !== 'NONE') {
    out.buffConditionType = first.BuffConditionType
    if (first.BuffConditionValue) out.buffConditionValue = first.BuffConditionValue
  }
  if (first.CallerSkillType && first.CallerSkillType !== 'SKT_NONE') out.callerSkillType = first.CallerSkillType
  if (first.TargetSkillType && first.TargetSkillType !== 'SKT_NONE') out.targetSkillType = first.TargetSkillType
  const turn = num(first.TurnDuration)
  if (turn > 0) out.turnDuration = turn
  return out
}

/**
 * Build an EffectGroup from a single ItemSpecialOptionTemplet row.
 * The row's BuffID is a CSV — each entry maps to BuffTemplet rows that
 * scale across enchant levels.
 */
function bakeEffectGroup(
  row: Row,
  buffsById: Map<string, Row[]>,
  textSkillIdx: Map<string, Row>,
  textItemIdx: Map<string, Row>,
): EffectGroup | null {
  const buffIds = csv(row.BuffID)
  const buffs: BuffEntry[] = []
  for (const id of buffIds) {
    const levels = buffsById.get(id)
    const entry = bakeBuffEntry(id, levels ?? [])
    if (entry) buffs.push(entry)
  }
  if (buffs.length === 0) return null

  // Passive labels usually live in TextSkill (UO_* keys) but some sets fall
  // back to TextItem (ST_Set_* keys). Try both — TextSkill first.
  const name = langFromText(textSkillIdx, row.NameID) ?? langFromText(textItemIdx, row.NameID)
  if (!name) return null

  const out: EffectGroup = { name, buffs }
  if (row.IconName) out.iconName = row.IconName
  return out
}

// ── Per-category bakers ─────────────────────────────────────────────────────

/**
 * Group items by their resolved English name and pick the 6★ variant.
 * Falls back to 5★ when no 6★ exists (legacy / starter items). Series
 * whose highest-tier variant is below 5★ are dropped — those are
 * placeholder gear nobody runs in damage builds.
 *
 * The English name is stable across BasicStar tiers for all item types,
 * unlike `UniqueOptionID` which only stays constant for weapons/accessories
 * (talismans get a fresh UOID at each tier).
 *
 * Items without a UniqueOptionID are also dropped (stat-only basics with
 * no passive worth surfacing).
 */
function dedupeSixStar(items: Row[], textItemIdx: Map<string, Row>): Row[] {
  const bySeries = new Map<string, Map<number, Row>>()
  for (const r of items) {
    if (!r.UniqueOptionID) continue
    const en = textItemIdx.get(r.NameID ?? '')?.English
    if (!en) continue
    const key = en
    const star = num(r.BasicStar)
    if (!bySeries.has(key)) bySeries.set(key, new Map())
    bySeries.get(key)!.set(star, r)
  }
  const out: Row[] = []
  for (const variants of bySeries.values()) {
    // Prefer 6★, fall back to 5★ — anything lower is dropped.
    const pick = variants.get(6) ?? variants.get(5)
    if (pick) out.push(pick)
  }
  return out
}

function bakeStandardItem(
  row: Row,
  specOptByGid: Map<string, Row[]>,
  buffsById: Map<string, Row[]>,
  textItemIdx: Map<string, Row>,
  textSkillIdx: Map<string, Row>,
): EquipmentItem | null {
  const id = row.ID ?? ''
  const name = langFromText(textItemIdx, row.NameID)
  if (!id || !name) return null

  // Walk every UOID row (CSV may carry multiple group IDs) and aggregate
  // all linked buffs — including IsAdd=True (lv10 unlocks). This is what
  // surfaces e.g. Rogue's Charm's "DMG vs Break" lv10 add on top of its
  // baseline CP-on-crit passive. Without this aggregation talismans only
  // showed the baseline buff and missed the lv10 add.
  const uoidList = csv(row.UniqueOptionID)
  const allBuffs: BuffEntry[] = []
  let firstName: LangMap | undefined
  let firstIcon: string | undefined
  for (const uoid of uoidList) {
    for (const r of specOptByGid.get(uoid) ?? []) {
      // Only take Level 1 (and the lv10 IsAdd=True row when present) — the
      // higher Levels of the same row repeat the same BuffIDs, just for
      // different break-limit gating which doesn't affect the calc.
      const lvl = num(r.Level)
      if (lvl !== 1 && lvl !== 10) continue
      const grp = bakeEffectGroup(r, buffsById, textSkillIdx, textItemIdx)
      if (!grp) continue
      if (!firstName && grp.name) firstName = grp.name
      if (!firstIcon) firstIcon = grp.iconName
      for (const b of grp.buffs) allBuffs.push(b)
    }
  }

  const effect: EffectGroup | null = firstName != null && allBuffs.length > 0
    ? { name: firstName, iconName: firstIcon, buffs: allBuffs }
    : null

  const out: EquipmentItem = { id, name, effect }
  if (row.IconName) out.iconName = row.IconName
  if (row.ClassLimit && row.ClassLimit !== 'CCT_NONE') out.classLimit = row.ClassLimit
  return out
}

/** Bake passive sets — those with at least one IOT_BUFF tier. */
function bakeSets(
  specOpts: Row[],
  buffsById: Map<string, Row[]>,
  textItemIdx: Map<string, Row>,
  textSkillIdx: Map<string, Row>,
): EquipmentSet[] {
  // Group spec-opt rows by GroupID, pick the LOWEST `Level` row — at higher
  // levels the 2P/4P BuffIDs sometimes duplicate (data quirk, e.g.
  // Pulverization Lv2 has BuffID_4P=BID_ITEM_UO_SET_17 instead of the
  // distinct _17_1 4pc variant). The lv1 row has the correct distinct IDs;
  // the actual enchant scaling lives inside each BuffTemplet (Level 1..N).
  const byGroup = new Map<string, Row>()
  for (const r of specOpts) {
    if (!r.GroupID) continue
    if (r.OptionType_2P !== 'IOT_BUFF' && r.OptionType_4P !== 'IOT_BUFF') continue
    const cur = byGroup.get(r.GroupID)
    if (!cur || num(r.Level) < num(cur.Level)) byGroup.set(r.GroupID, r)
  }

  const out: EquipmentSet[] = []
  for (const [groupId, row] of byGroup) {
    const name = langFromText(textItemIdx, row.NameID)
    if (!name) continue
    const set: EquipmentSet = {
      id: groupId,
      name,
      bonus2: null,
      bonus4: null,
    }
    if (row.IconName) set.iconName = row.IconName

    // Synthesize per-tier rows so bakeEffectGroup can resolve buff IDs +
    // labels from the same templet record. The label hint ID lives in
    // TextSkill under UO_SET_<groupId>_<tier>_DESC — but we want the NAME,
    // not the desc. The set's name from TextItem is usable as the passive
    // label too since the set-name effectively IS the passive ("Pulverization").
    if (row.OptionType_2P === 'IOT_BUFF' && row.BuffID_2P) {
      const synth: Row = { BuffID: row.BuffID_2P, NameID: row.NameID, IconName: row.IconName }
      set.bonus2 = bakeEffectGroup(synth, buffsById, textSkillIdx, textItemIdx)
    }
    if (row.OptionType_4P === 'IOT_BUFF' && row.BuffID_4P) {
      const synth: Row = { BuffID: row.BuffID_4P, NameID: row.NameID, IconName: row.IconName }
      set.bonus4 = bakeEffectGroup(synth, buffsById, textSkillIdx, textItemIdx)
    }

    if (set.bonus2 || set.bonus4) out.push(set)
  }
  return out.sort((a, b) => a.name.en.localeCompare(b.name.en))
}

/**
 * EE (ITS_EQUIP_EXCLUSIVE) is structured differently from other items:
 *   - MainOptionGroupID → ItemOptionTemplet → element-conditional main stat
 *   - UniqueOptionID is a CSV of TWO group IDs:
 *       [0] = lv 0 baseline passive (Level=1, IsAdd=False)
 *       [1] = lv 10 add passive    (Level=10, IsAdd=True)
 *   - CharacterLimit pins the EE to a specific char
 *
 * For now we bake the lv0 passive + lv10 add passive separately so the UI
 * can show "what's unlocked at lv 10". Main stat carries `targetElement`
 * derived from the buff ID suffix — the UI renders "vs Fire DMG↑%"
 * rather than "Demonic Twin DMG↑%" (the EE item name is irrelevant here).
 */
function bakeEE(
  row: Row,
  itemOptByGid: Map<string, Row[]>,
  specOptByGid: Map<string, Row[]>,
  buffsById: Map<string, Row[]>,
  textItemIdx: Map<string, Row>,
  textSkillIdx: Map<string, Row>,
): EquipmentEE | null {
  const charId = row.CharacterLimit
  if (!charId) return null
  const name = langFromText(textItemIdx, row.NameID)
  if (!name) return null

  // Main stat — bake all ItemOption buffs under MainOptionGroupID. We
  // intentionally drop the synthesized passive name (it would copy the
  // EE item name, which is wrong) and instead expose `targetElement`
  // parsed from the buff ID suffix so the UI builds "vs Fire DMG↑%".
  const mainOpts = itemOptByGid.get(row.MainOptionGroupID ?? '') ?? []
  let mainStat: EffectGroup | null = null
  const mainBuffs: BuffEntry[] = []
  for (const o of mainOpts) {
    if (!o.BuffID) continue
    const entry = bakeBuffEntry(o.BuffID, buffsById.get(o.BuffID) ?? [])
    if (entry) mainBuffs.push(entry)
  }
  if (mainBuffs.length > 0) {
    mainStat = { buffs: mainBuffs }
    const elem = targetElementFromBuff(mainBuffs[0])
    if (elem) mainStat.targetElement = elem
  }

  // Lv0 / Lv10 passives — both groups in the CSV UOID.
  const uoidList = csv(row.UniqueOptionID)
  let passiveLv0: EffectGroup | null = null
  let passiveLv10: EffectGroup | null = null
  for (const uoid of uoidList) {
    const rows = specOptByGid.get(uoid) ?? []
    const lv0Row = rows.find(r => r.IsAdd === 'False' && num(r.Level) === 1)
    const lv10Row = rows.find(r => r.IsAdd === 'True' && num(r.Level) === 10)
    if (lv0Row && !passiveLv0)  passiveLv0  = bakeEffectGroup(lv0Row, buffsById, textSkillIdx, textItemIdx)
    if (lv10Row && !passiveLv10) passiveLv10 = bakeEffectGroup(lv10Row, buffsById, textSkillIdx, textItemIdx)
  }

  const out: EquipmentEE = {
    charId,
    name,
    mainStat,
    passiveLv0,
    passiveLv10,
  }
  if (row.IconName) out.iconName = row.IconName
  return out
}

/**
 * Resolve the EE main-stat **target** element from the buff's
 * `BuffConditionValue`. The numeric encoding is the game's canonical
 * element enum — verified against the curated `data/equipment/ee.json`
 * for both `TARGET_ELEMENT` and `OWNER_ELEMENT` condition types (the
 * value field encodes the displayed target element in either context):
 *   undef/0 → Earth, 1 → Water, 2 → Fire, 3 → Light, 4 → Dark
 *
 * The buff ID suffix (e.g. `_WATER` in `BID_CEQUIP_MAIN_DMG_WATER`)
 * names the EE *owner's* element, not the target — relying on it would
 * require hardcoding the elemental wheel. The condition value is the
 * source of truth and lives directly in `BuffTemplet`.
 *
 * Returns undefined for non-element-gated buffs (e.g. the `_CORE`
 * family with `BuffConditionType=NONE`).
 */
function targetElementFromBuff(buff: BuffEntry): string | undefined {
  const t = buff.buffConditionType
  if (t !== 'TARGET_ELEMENT' && t !== 'OWNER_ELEMENT') return undefined
  const ELEMENT: Record<string, string> = {
    '':  'Earth', '0': 'Earth',
    '1': 'Water',
    '2': 'Fire',
    '3': 'Light',
    '4': 'Dark',
  }
  return ELEMENT[buff.buffConditionValue ?? '']
}

// ── Public entrypoint ──────────────────────────────────────────────────────

async function loadExclude(): Promise<ExcludeFile> {
  const abs = join(PATHS.equipment, '_calc-exclude.json')
  if (!existsSync(abs)) return {}
  return JSON.parse(await readFile(abs, 'utf-8')) as ExcludeFile
}

export async function buildEquipment(): Promise<{
  weapons: number; accessories: number; talismans: number; sets: number; ees: number
}> {
  const [
    items, opts, specOpts, buffs, textItem, textSkill, exclude,
  ] = await Promise.all([
    loadJson2<Row[]>('ItemTemplet.json'),
    loadJson2<Row[]>('ItemOptionTemplet.json'),
    loadJson2<Row[]>('ItemSpecialOptionTemplet.json'),
    loadJson2<Row[]>('BuffTemplet.json'),
    loadJson2<Row[]>('TextItem.json'),
    loadJson2<Row[]>('TextSkill.json'),
    loadExclude(),
  ])

  const textItemIdx  = buildTextIndex(textItem)
  const textSkillIdx = buildTextIndex(textSkill)
  const buffsById    = indexBuffsById(buffs)
  const itemOptByGid = new Map<string, Row[]>()
  for (const o of opts) {
    if (!o.GroupID) continue
    const arr = itemOptByGid.get(o.GroupID) ?? []
    arr.push(o)
    itemOptByGid.set(o.GroupID, arr)
  }
  const specOptByGid = new Map<string, Row[]>()
  for (const s of specOpts) {
    if (!s.GroupID) continue
    const arr = specOptByGid.get(s.GroupID) ?? []
    arr.push(s)
    specOptByGid.set(s.GroupID, arr)
  }

  const isUnique = (r: Row, sub: string) => r.ItemSubType === sub && r.ItemGrade === 'IG_UNIQUE'

  const excW = new Set(exclude.weapons     ?? [])
  const excA = new Set(exclude.accessories ?? [])
  const excT = new Set(exclude.talismans   ?? [])
  const excS = new Set(exclude.sets        ?? [])
  const excE = new Set(exclude.ees         ?? [])

  const bakeStandard = (rows: Row[], excluded: Set<string>): EquipmentItem[] => {
    const dedup = dedupeSixStar(rows, textItemIdx)
    const out: EquipmentItem[] = []
    for (const r of dedup) {
      const baked = bakeStandardItem(r, specOptByGid, buffsById, textItemIdx, textSkillIdx)
      if (baked && !excluded.has(baked.id) && baked.effect) out.push(baked)
    }
    return out.sort((a, b) => (a.name.en ?? '').localeCompare(b.name.en ?? ''))
  }

  const weapons     = bakeStandard(items.filter(r => isUnique(r, 'ITS_EQUIP_WEAPON')),    excW)
  const accessories = bakeStandard(items.filter(r => isUnique(r, 'ITS_EQUIP_ACCESSORY')), excA)
  const talismans   = bakeStandard(items.filter(r => isUnique(r, 'ITS_EQUIP_OOPARTS')),   excT)

  const sets = bakeSets(specOpts, buffsById, textItemIdx, textSkillIdx)
    .filter(s => !excS.has(s.id))

  const ees: Record<string, EquipmentEE> = {}
  for (const r of items.filter(r => isUnique(r, 'ITS_EQUIP_EXCLUSIVE'))) {
    const baked = bakeEE(r, itemOptByGid, specOptByGid, buffsById, textItemIdx, textSkillIdx)
    if (baked && !excE.has(baked.charId)) ees[baked.charId] = baked
  }

  const file: EquipmentFile = {
    _v: SCHEMA_VERSION,
    weapons, accessories, talismans, sets, ees,
  }
  await writeJsonMin('equipment.json', file)

  return {
    weapons:     weapons.length,
    accessories: accessories.length,
    talismans:   talismans.length,
    sets:        sets.length,
    ees:         Object.keys(ees).length,
  }
}
