import fs from 'fs'
import path from 'path'
import { LANGS, DEFAULT_LANG, type Lang } from '@/lib/i18n/config'

export type LangDict = { en: string; jp: string; kr: string; zh: string }

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

export type Row = Record<string, string>

export const LANG_COLUMNS: Record<Lang, string> = {
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

export function indexBy(rows: Row[], key = 'ID'): Map<string, Row> {
  const m = new Map<string, Row>()
  for (const r of rows) {
    const k = r[key]
    if (k) m.set(k, r)
  }
  return m
}

export function getLangTexts(entry: Row | undefined): Record<Lang, string> | null {
  if (!entry) return null
  const r = {} as Record<Lang, string>
  for (const lang of LANGS) r[lang] = entry[LANG_COLUMNS[lang]] ?? ''
  return r
}

export function expandLang(prefix: string, texts: Record<Lang, string> | null): Record<string, string | null> {
  const r: Record<string, string | null> = {}
  for (const lang of LANGS) {
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
export function langDict(texts: Record<Lang, string> | null): LangDict {
  const out: LangDict = { en: '', jp: '', kr: '', zh: '' }
  if (!texts) return out
  for (const lang of LANGS) {
    out[lang] = (texts[lang] ?? '').trim().replace(/[\u2018\u2019]/g, "'")
  }
  return out
}

export function num(v: string | undefined | null): number {
  if (v == null || v === '') return 0
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}
