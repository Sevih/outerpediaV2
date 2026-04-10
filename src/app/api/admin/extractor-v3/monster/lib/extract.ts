import { extractBase, type MonsterBase } from './base'
import { localizeNamesDict } from './localization'
import {
  findMonsterLocations,
  loadLocationTables,
  resolveModeLabelDict,
  resolveTextDict,
  type MonsterLocation,
} from './location'
import { extractMonsterSkills, type MonsterSkill } from './skills'
import { langDict, getLangTexts, type LangDict, type Row } from './common'

// ── Output type (wiki format) ───────────────────────────────────────

export type WikiSkill = {
  name: LangDict
  type: string
  description: LangDict
  icon: string
  buff?: string[]
  debuff?: string[]
  removeBuff?: string[]
  removeDebuff?: string[]
}

export type WikiLocation = {
  dungeon: LangDict
  mode: LangDict
  area_id: LangDict
}

export type ExtractedMonster = {
  id: string
  Name: LangDict
  Surname: LangDict | null
  IncludeSurname: boolean
  class: string
  element: string
  level: number
  icons: string
  BuffImmune: string
  StatBuffImmune: string
  location: WikiLocation
  skills: WikiSkill[]
  // ── debug / non-wiki fields kept around for the route to use ──
  _allLocations?: MonsterLocation[]
  _base?: MonsterBase
}

// ── Class / element resolution ──────────────────────────────────────

function resolveClass(cct: string | null, textIndex: Map<string, Row>): string {
  if (!cct) return ''
  // CCT_ATTACKER → SYS_CLASS_ATTACKER → "Striker"
  const suffix = cct.replace(/^CCT_/, '')
  return textIndex.get(`SYS_CLASS_${suffix}`)?.English ?? ''
}

function resolveElement(cet: string | null, textIndex: Map<string, Row>): string {
  if (!cet) return ''
  const suffix = cet.replace(/^CET_/, '')
  return textIndex.get(`SYS_ELEMENT_${suffix}`)?.English ?? ''
}

// ── Skill → wiki shape ──────────────────────────────────────────────

function toWikiSkill(s: MonsterSkill): WikiSkill {
  // s.nameTexts / s.descTexts are the per-language records produced by skills.ts
  const nameTexts = (s.nameTexts ?? null) as Record<'en' | 'jp' | 'kr' | 'zh', string> | null
  const descTexts = (s.descTexts ?? null) as Record<'en' | 'jp' | 'kr' | 'zh', string> | null
  const out: WikiSkill = {
    name: langDict(nameTexts),
    type: String(s.type ?? ''),
    description: langDict(descTexts),
    icon: String(s.iconName ?? ''),
  }
  const buff = (s.buff ?? []) as string[]
  const debuff = (s.debuff ?? []) as string[]
  const removeBuff = (s.removeBuff ?? []) as string[]
  const removeDebuff = (s.removeDebuff ?? []) as string[]
  if (buff.length > 0) out.buff = buff
  if (debuff.length > 0) out.debuff = debuff
  if (removeBuff.length > 0) out.removeBuff = removeBuff
  if (removeDebuff.length > 0) out.removeDebuff = removeDebuff
  return out
}

// ── Main entrypoint ─────────────────────────────────────────────────

export function extractMonster(
  id: string,
  locationFilter?: { dungeonId?: string }
): ExtractedMonster | null {
  const base = extractBase(id)
  if (!base) return null

  const tables = loadLocationTables()
  const txt = tables.textSystemIndex

  const names = localizeNamesDict(base.nameId, base.nickNameId)
  // If every Surname language is empty, drop it to null (matches the wiki convention).
  const surname =
    names.Surname && Object.values(names.Surname).some((v) => v && v.trim() !== '')
      ? names.Surname
      : null

  // Locations: keep all for the UI/dropdown, pick one as primary.
  let locations = findMonsterLocations(id)
  if (locationFilter?.dungeonId) {
    locations = locations.filter((l) => l.dungeonId === locationFilter.dungeonId)
  }
  const primary = locations[0] ?? null

  // Build the wiki location triple. dungeon = full per-floor NameID lookup,
  // mode = section title from resolveModeLabelDict, area_id = area NameID.
  const emptyDict: LangDict = { en: '', jp: '', kr: '', zh: '' }

  let dungeonDict: LangDict = emptyDict
  let modeDict: LangDict = emptyDict
  let areaDict: LangDict = emptyDict

  if (primary) {
    dungeonDict = resolveTextDict(primary.dungeonNameId, txt)
    // Substitute `{0}` stage placeholder (guild raid dungeon names).
    const grade = tables.dungeonGradeMap.get(primary.dungeonId)
    if (grade) {
      const subbed: LangDict = { en: '', jp: '', kr: '', zh: '' }
      for (const lang of ['en', 'jp', 'kr', 'zh'] as const) {
        subbed[lang] = dungeonDict[lang].replace(/\{0\}/g, grade)
      }
      dungeonDict = subbed
    }
    // area_id: for story dungeons, use the per-stage ShortNameID (e.g. "3-11").
    // For everything else the wiki leaves this empty.
    const areaRow = primary.areaId ? tables.areaIndex.get(primary.areaId) : undefined
    const primaryDungeon = tables.dungeonsByGroup.get(primary.groupId)?.find(
      (d) => d.dungeon.ID === primary.dungeonId
    )?.dungeon
    const shortNameId = (primaryDungeon?.ShortNameID as string | undefined) ?? null
    if (primary.mode === 'DM_NORMAL' && shortNameId) {
      areaDict = resolveTextDict(shortNameId, txt)
    }
    const md = resolveModeLabelDict(primary.mode, areaRow?.AreaGroupType ?? null, primary.dungeonNameId, txt)
    if (md) modeDict = md
  }

  const skills = extractMonsterSkills(base.skillIds, base.id).map(toWikiSkill)

  return {
    id: base.id,
    Name: names.Name,
    Surname: surname,
    IncludeSurname: false, // manual flag, preserved by caller from existing file
    class: resolveClass(base.class, txt),
    element: resolveElement(base.element, txt),
    level: primary?.level ?? 0,
    icons: base.faceIconId ?? '',
    BuffImmune: base.buffImmune,
    StatBuffImmune: base.statBuffImmune,
    location: {
      dungeon: dungeonDict,
      mode: modeDict,
      area_id: areaDict,
    },
    skills,
    _allLocations: locations,
    _base: base,
  }
}

// Convenience: drop the underscore-prefixed debug fields before saving.
export function stripInternalFields(extracted: ExtractedMonster): Record<string, unknown> {
  const { _allLocations, _base, ...rest } = extracted
  void _allLocations
  void _base
  return rest
}

/** Re-export of getLangTexts for callers that want raw per-language data. */
export { getLangTexts }
