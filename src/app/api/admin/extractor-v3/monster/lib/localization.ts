import { loadTable, indexBy, getLangTexts, expandLang, langDict, type Row, type LangDict } from './common'
import type { GameLang } from '@/lib/i18n/config'

// Localized name fields are exposed as flat keys: Name, Name_jp, Name_kr, Name_zh
// (and same for NickName when present), matching the convention used elsewhere.
export type LocalizedNames = Record<string, string | null>

let textCharIndex: Map<string, Row> | null = null

export function loadTextCharacterIndex(): Map<string, Row> {
  if (!textCharIndex) {
    textCharIndex = indexBy(loadTable('TextCharacter'))
  }
  return textCharIndex
}

/**
 * Resolve a single text key into a per-language record.
 * Returns null entries for each language if the key is missing.
 */
export function resolveText(textId: string | null, index?: Map<string, Row>): Record<GameLang, string> | null {
  if (!textId) return null
  const map = index ?? loadTextCharacterIndex()
  return getLangTexts(map.get(textId))
}

/**
 * Resolve Name + (optional) NickName for a monster.
 * Output: { Name, Name_jp, Name_kr, Name_zh, [NickName, NickName_jp, ...] }
 */
export function localizeNames(
  nameId: string | null,
  nickNameId: string | null,
  index?: Map<string, Row>
): LocalizedNames {
  const map = index ?? loadTextCharacterIndex()
  const out: LocalizedNames = {}
  Object.assign(out, expandLang('Name', resolveText(nameId, map)))
  if (nickNameId) {
    Object.assign(out, expandLang('NickName', resolveText(nickNameId, map)))
  }
  return out
}

/**
 * Resolve Name + Surname (NickName) for a monster, in the wiki dict format.
 * Returns `{ Name, Surname }` where each is `{ en, jp, kr, zh }`.
 */
export function localizeNamesDict(
  nameId: string | null,
  nickNameId: string | null,
  index?: Map<string, Row>
): { Name: LangDict; Surname: LangDict } {
  const map = index ?? loadTextCharacterIndex()
  return {
    Name: langDict(resolveText(nameId, map)),
    Surname: langDict(resolveText(nickNameId, map)),
  }
}

/**
 * Search monsters by english name (case-insensitive substring match).
 * Returns a list of { id, NameID, name } for matches.
 *
 * The query matches the english name. We need a reverse lookup:
 *   query → matching TextCharacter entries → NameID
 * then we filter MonsterTemplet rows whose NameID is in that set.
 *
 * To avoid scanning everything multiple times, this function takes the
 * monster rows as input (caller decides if pre-filtering by Type is wanted).
 */
export function searchMonstersByName(
  monsterRows: Row[],
  query: string,
  textIndex?: Map<string, Row>
): Array<{ id: string; nameId: string; name: string }> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const txt = textIndex ?? loadTextCharacterIndex()
  const results: Array<{ id: string; nameId: string; name: string }> = []

  for (const row of monsterRows) {
    const nameId = row.NameID ?? ''
    const text = nameId ? txt.get(nameId) : undefined
    const en = (text?.English ?? '').trim()
    const idMatch = row.ID.toLowerCase().includes(q)
    const nameMatch = !!en && en.toLowerCase().includes(q)
    if (idMatch || nameMatch) {
      results.push({ id: row.ID, nameId, name: en || row.ID })
    }
  }
  return results
}
