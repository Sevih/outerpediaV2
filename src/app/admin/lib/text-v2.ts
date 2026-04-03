/**
 * Shared helpers for admin extractors v2.
 * Reads from data/admin/json2/ (flat arrays, ID field).
 */

import { LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang } from '@/lib/i18n/config';
import fs from 'fs/promises';
import path from 'path';

export { LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang };

const JSON_DIR = path.join(process.cwd(), 'data', 'admin', 'json2');

/** Read a json2 templet file (flat array) */
export async function readTemplet(name: string): Promise<Record<string, string>[]> {
  const raw = await fs.readFile(path.join(JSON_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

export type LangTexts = Record<Lang, string>;

const LANG_COL: Record<Lang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
};

/** Build ID → LangTexts lookup from a Text*.json array */
export function buildTextMap(data: Record<string, string>[]): Record<string, LangTexts> {
  const map: Record<string, LangTexts> = {};
  for (const row of data) {
    const key = row.ID;
    if (!key) continue;
    const texts = {} as LangTexts;
    for (const lang of LANGS) texts[lang] = (row[LANG_COL[lang]] ?? '').trim();
    map[key] = texts;
  }
  return map;
}

/** Empty LangTexts */
export function emptyLang(): LangTexts {
  const t = {} as LangTexts;
  for (const lang of LANGS) t[lang] = '';
  return t;
}

/** Build a LangTexts by applying a fn per lang */
export function mapLang(fn: (lang: Lang) => string): LangTexts {
  const t = {} as LangTexts;
  for (const lang of LANGS) t[lang] = fn(lang);
  return t;
}

// ── Buff placeholder resolution ──────────────────────────────────────

/** Index BuffTemplet by BuffID → level → row */
export function buildBuffIndex(data: Record<string, string>[]): Map<string, Map<number, Record<string, string>>> {
  const index = new Map<string, Map<number, Record<string, string>>>();
  for (const row of data) {
    const buffId = row.BuffID;
    if (!buffId) continue;
    const level = parseInt(row.Level) || 1;
    let levels = index.get(buffId);
    if (!levels) { levels = new Map(); index.set(buffId, levels); }
    if (!levels.has(level)) levels.set(level, row);
  }
  return index;
}

/** Resolve [Buff_C_...], [Buff_V_...], [Buff_T_...] placeholders in skill descriptions */
export function resolveBuffPlaceholders(
  text: string,
  skillLevel: number,
  buffIndex: Map<string, Map<number, Record<string, string>>>,
): string {
  return text.replace(/\[(?:buff|Buff)_(c|v|t)_([^\]]+)\]/gi, (_match, type: string, buffId: string) => {
    let levels = buffIndex.get(buffId);
    if (!levels) {
      const lower = buffId.toLowerCase();
      for (const [key, val] of buffIndex) {
        if (key.toLowerCase() === lower) { levels = val; break; }
      }
    }
    if (!levels) return _match;
    // Find closest level <= skillLevel
    let row: Record<string, string> | undefined;
    for (let lv = skillLevel; lv >= 1; lv--) { row = levels.get(lv); if (row) break; }
    if (!row) return _match;

    const t = type.toLowerCase();
    const num = (field: string) => parseInt(row![field] ?? '') || 0;
    if (t === 'c') return `${num('CreateRate') / 10}%`;
    if (t === 'v') return row.ApplyingType === 'OAT_RATE' ? `${Math.abs(num('Value')) / 10}%` : String(Math.abs(num('Value')));
    if (t === 't') return String(num('TurnDuration'));
    return _match;
  });
}

/** Resolve a game enum via TextSystem: CET_FIRE → Fire */
export function resolveEnum(sysMap: Record<string, LangTexts>, raw: string, prefix: string, sysPrefix: string): LangTexts | undefined {
  const stripped = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!stripped || stripped === 'NONE') return undefined;
  return sysMap[`${sysPrefix}${stripped}`];
}
