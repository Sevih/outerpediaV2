import fs from 'fs'
import path from 'path'
import { GAME_LANGS, DEFAULT_LANG, type GameLang } from '@/lib/i18n/config'

export type LangDict = Record<GameLang, string>

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

export type Row = Record<string, string>

export const LANG_COLUMNS: Record<GameLang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
}

const tableCache = new Map<string, Row[]>()

export function loadTable(name: string): Row[] {
  if (!tableCache.has(name)) {
    tableCache.set(name, JSON.parse(fs.readFileSync(path.join(JSON2_DIR, `${name}.json`), 'utf-8')))
  }
  return tableCache.get(name)!
}

export function clearTableCache() {
  tableCache.clear()
}

/**
 * Install a case-insensitive `.get` on an existing Map. Keeps the
 * original-case map intact (so `.keys()` / `.values()` / `.entries()` /
 * `.has()` still see each entry exactly once with its original casing)
 * while transparently falling back to a lowercase-indexed lookup when
 * a caller passes a key in a different casing. Cross-file case drift
 * (e.g. `_Lv1` in MonsterSkillTemplet vs `_LV1` in TextSkill) resolves
 * without any per-call workaround.
 */
export function withCaseInsensitiveGet<V>(m: Map<string, V>): Map<string, V> {
  const originalGet = m.get.bind(m)
  const lowerIndex = new Map<string, V>()
  for (const [k, v] of m) {
    const lk = k.toLowerCase()
    if (!lowerIndex.has(lk)) lowerIndex.set(lk, v)
  }
  m.get = (k: string) => originalGet(k) ?? lowerIndex.get(k.toLowerCase())
  return m
}

export function indexBy(rows: Row[], key = 'ID'): Map<string, Row> {
  const m = new Map<string, Row>()
  for (const r of rows) {
    const k = r[key]
    if (k) m.set(k, r)
  }
  return withCaseInsensitiveGet(m)
}

export function getLangTexts(entry: Row | undefined): Record<GameLang, string> | null {
  if (!entry) return null
  const r = {} as Record<GameLang, string>
  for (const lang of GAME_LANGS) r[lang] = entry[LANG_COLUMNS[lang]] ?? ''
  return r
}

export function expandLang(prefix: string, texts: Record<GameLang, string> | null): Record<string, string | null> {
  const r: Record<string, string | null> = {}
  for (const lang of GAME_LANGS) {
    const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
    r[`${prefix}${suffix}`] = texts?.[lang]?.trim().replace(/[\u2018\u2019]/g, "'") ?? null
  }
  return r
}

/**
 * Convert a per-language record into the wiki dict format:
 *   { en, jp, kr, zh }
 * Empty string for missing languages so the diff stays clean.
 */
export function langDict(texts: Record<GameLang, string> | null): LangDict {
  const out: LangDict = { en: '', jp: '', kr: '', zh: '' }
  if (!texts) return out
  for (const lang of GAME_LANGS) {
    out[lang] = (texts[lang] ?? '').trim().replace(/[\u2018\u2019]/g, "'")
  }
  return out
}

export function num(v: string | undefined | null): number {
  if (v == null || v === '') return 0
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}
