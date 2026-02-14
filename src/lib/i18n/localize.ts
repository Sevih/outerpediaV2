import type { Lang, LangMap } from '@/types/common';

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
