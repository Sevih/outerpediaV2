/**
 * SINGLE SOURCE OF TRUTH for all supported languages.
 * To add a language: add one entry here. Everything else derives automatically.
 */
export const LANGUAGES = {
  en: { label: 'English', abbrev: 'EN', flag: 'gb', subdomain: '', htmlLang: 'en', isDefault: true },
  jp: { label: '日本語', abbrev: 'JP', flag: 'jp', subdomain: 'jp', htmlLang: 'ja', isDefault: false },
  kr: { label: '한국어', abbrev: 'KR', flag: 'kr', subdomain: 'kr', htmlLang: 'ko', isDefault: false },
  zh: { label: '中文', abbrev: 'ZH', flag: 'cn', subdomain: 'zh', htmlLang: 'zh', isDefault: false },
} as const;

/** All language keys — derived from LANGUAGES */
export type Lang = keyof typeof LANGUAGES;

/** Array of all language keys */
export const LANGS = Object.keys(LANGUAGES) as Lang[];

/** The default language key */
export const DEFAULT_LANG = (
  Object.entries(LANGUAGES).find(([, v]) => v.isDefault)?.[0] ?? 'en'
) as Lang;

/** Non-default languages (used for suffix fields like name_jp) */
export type SuffixLang = Exclude<Lang, typeof DEFAULT_LANG>;

/** Array of suffix language keys */
export const SUFFIX_LANGS = LANGS.filter((l): l is SuffixLang => l !== DEFAULT_LANG);

/** Get config for a specific language */
export function getLangConfig(lang: Lang) {
  return LANGUAGES[lang];
}

/** Type guard */
export function isValidLang(value: string): value is Lang {
  return value in LANGUAGES;
}
