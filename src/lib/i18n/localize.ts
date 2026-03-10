import type { Lang, LangMap } from '@/types/common';
import { DEFAULT_LANG, SUFFIX_LANGS } from '@/lib/i18n/config';

/**
 * Get a localized suffix field with English fallback.
 * Works with parser output format: { name: "X", name_jp: "Y", name_kr: "Z" }
 */
export function l<T extends Record<string, unknown>>(
  obj: T,
  field: string,
  lang: Lang
): string {
  if (lang === 'en') {
    return (obj[field] as string) ?? '';
  }
  const localized = obj[`${field}_${lang}`] as string | undefined;
  return localized ?? (obj[field] as string) ?? '';
}

/**
 * Get a value from a LangMap with English fallback.
 * Works with editorial content format: { en: "X", jp: "Y" }
 */
export function lRec(record: LangMap | undefined, lang: Lang): string {
  if (!record) return '';
  return record[lang] ?? record.en ?? '';
}

const LANG_SUFFIXES = SUFFIX_LANGS.map(l => `_${l}`);

/**
 * Strip unused language suffix fields from an object.
 * Keeps base (en) fields and only the suffix for the target language.
 * e.g. for lang='jp': keeps 'name' and 'name_jp', removes 'name_kr' and 'name_zh'.
 * For lang='en': removes all '_jp', '_kr', '_zh' fields.
 */
export function stripOtherLangs<T extends Record<string, unknown>>(obj: T, lang: Lang): T {
  const suffixesToRemove = lang === DEFAULT_LANG
    ? LANG_SUFFIXES
    : LANG_SUFFIXES.filter(s => s !== `_${lang}`);
  const result = {} as Record<string, unknown>;
  for (const key in obj) {
    if (suffixesToRemove.some(s => key.endsWith(s))) continue;
    result[key] = obj[key];
  }
  return result as T;
}

/** Strip unused language fields from an array of objects */
export function stripOtherLangsArray<T extends Record<string, unknown>>(arr: T[], lang: Lang): T[] {
  return arr.map(item => stripOtherLangs(item, lang));
}

/** Strip unused language fields from a Record of objects */
export function stripOtherLangsRecord<T extends Record<string, unknown>>(rec: Record<string, T>, lang: Lang): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(rec)) {
    result[key] = stripOtherLangs(value, lang);
  }
  return result;
}
