/**
 * Shared text resolution helpers for admin extractors v2.
 *
 * Reads from data/admin/json2/ (flat arrays, ID instead of IDSymbol).
 * Handles: multilingual text maps, enum resolution, buff placeholder resolution.
 */

import { LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang } from '@/lib/i18n/config';
import fs from 'fs/promises';
import path from 'path';

// Re-export for convenience
export { LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang };

// ── Templet reader ──────────────────────────────────────────────────

const JSON_DIR = path.join(process.cwd(), 'data', 'admin', 'json2');

/** Read and parse one of the admin JSON templet files (json2 format: flat array) */
export async function readTemplet(name: string): Promise<Record<string, string>[]> {
  const raw = await fs.readFile(path.join(JSON_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

// ── Text column mapping ──────────────────────────────────────────────

/** Maps our Lang keys to the column names found in Text*.json templet files */
export const LANG_TO_COLUMN: Record<Lang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
};

// ── LangTexts helpers ────────────────────────────────────────────────

export type LangTexts = Record<Lang, string>;

/** Build a lookup map from a Text*.json data array: ID → LangTexts */
export function buildTextMap(data: Record<string, string>[]): Record<string, LangTexts> {
  const map: Record<string, LangTexts> = {};
  for (const row of data) {
    const key = row.ID;
    if (!key) continue;
    const texts = {} as LangTexts;
    for (const lang of LANGS) {
      texts[lang] = row[LANG_TO_COLUMN[lang]] ?? '';
    }
    map[key] = texts;
  }
  return map;
}

/**
 * Expand a LangTexts into suffixed output fields.
 *
 * expandLang('Fullname', { en: 'K', jp: 'ケイ', kr: '케이', zh: '凯伊' })
 * → { Fullname: 'K', Fullname_jp: 'ケイ', Fullname_kr: '케이', Fullname_zh: '凯伊' }
 */
export function expandLang(fieldName: string, texts: LangTexts | undefined, fallback = ''): Record<string, string> {
  const result: Record<string, string> = {};
  result[fieldName] = texts?.[DEFAULT_LANG] ?? fallback;
  for (const lang of SUFFIX_LANGS) {
    result[`${fieldName}_${lang}`] = texts?.[lang] ?? fallback;
  }
  return result;
}

// ── Enum resolution ──────────────────────────────────────────────────

export function resolveEnum(textSys: Record<string, LangTexts>, raw: string, prefix: string, sysPrefix: string): string {
  const stripped = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!stripped || stripped === 'NONE') return '';
  return textSys[`${sysPrefix}${stripped}`]?.[DEFAULT_LANG] ?? stripped;
}

export function resolveElement(textSys: Record<string, LangTexts>, raw: string): string {
  return resolveEnum(textSys, raw, 'CET_', 'SYS_ELEMENT_');
}

export function resolveClass(textSys: Record<string, LangTexts>, raw: string): string {
  return resolveEnum(textSys, raw, 'CCT_', 'SYS_CLASS_');
}

export function resolveSubClass(textSys: Record<string, LangTexts>, raw: string): string {
  return resolveEnum(textSys, raw, '', 'SYS_CLASS_NAME_');
}

// ── Buff placeholder resolution ──────────────────────────────────────

type BuffRow = Record<string, string>;

/**
 * Index BuffTemplet data by BuffID → level → row.
 * Levels in the game data are sparse (typically 1, 3, 5).
 */
export function buildBuffIndex(data: BuffRow[]): Map<string, Map<number, BuffRow>> {
  const index = new Map<string, Map<number, BuffRow>>();
  for (const row of data) {
    const buffId = row.BuffID;
    if (!buffId) continue;
    const level = parseInt(row.Level) || 1;
    let levels = index.get(buffId);
    if (!levels) {
      levels = new Map();
      index.set(buffId, levels);
    }
    if (!levels.has(level)) {
      levels.set(level, row);
    }
  }
  return index;
}

function getBuffAtLevel(levels: Map<number, BuffRow> | undefined, skillLevel: number): BuffRow | undefined {
  if (!levels) return undefined;
  for (let lv = skillLevel; lv >= 1; lv--) {
    const row = levels.get(lv);
    if (row) return row;
  }
  return undefined;
}

function formatBuffValue(type: string, raw: string | undefined, applyingType?: string): string {
  if (!raw) return '';
  const num = parseInt(raw);
  if (isNaN(num)) return raw;
  switch (type) {
    case 'c':
      return `${num / 10}%`;
    case 'v':
      if (applyingType === 'OAT_RATE') return `${Math.abs(num) / 10}%`;
      return String(Math.abs(num));
    case 't':
      return String(num);
    default:
      return raw;
  }
}

const BUFF_PLACEHOLDER_RE = /\[(?:buff|Buff)_(c|v|t)_([^\]]+)\]/gi;

export function resolveBuffPlaceholders(
  text: string,
  skillLevel: number,
  buffIndex: Map<string, Map<number, BuffRow>>,
): string {
  return text.replace(BUFF_PLACEHOLDER_RE, (_match, type: string, buffId: string) => {
    let levels = buffIndex.get(buffId);
    if (!levels) {
      const lower = buffId.toLowerCase();
      for (const [key, val] of buffIndex) {
        if (key.toLowerCase() === lower) { levels = val; break; }
      }
    }
    const row = getBuffAtLevel(levels, skillLevel);
    if (!row) return _match;

    const t = type.toLowerCase();
    switch (t) {
      case 'c': return formatBuffValue('c', row.CreateRate);
      case 'v': return formatBuffValue('v', row.Value, row.ApplyingType);
      case 't': return formatBuffValue('t', row.TurnDuration);
      default: return _match;
    }
  });
}
