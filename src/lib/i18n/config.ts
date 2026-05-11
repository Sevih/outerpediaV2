/**
 * SINGLE SOURCE OF TRUTH for all supported languages.
 * To add a language: add one entry here. Everything else derives automatically.
 *
 * `isOfficial: true` = officially supported by the game (data extraction produces these).
 * `isOfficial: false` = community-translated language (no game data, fallback to EN).
 */
export const LANGUAGES = {
  en: { label: 'English', abbrev: 'EN', flag: 'gb', subdomain: '', htmlLang: 'en', isDefault: true, isOfficial: true },
  jp: { label: '日本語', abbrev: 'JP', flag: 'jp', subdomain: 'jp', htmlLang: 'ja', isDefault: false, isOfficial: true },
  kr: { label: '한국어', abbrev: 'KR', flag: 'kr', subdomain: 'kr', htmlLang: 'ko', isDefault: false, isOfficial: true },
  zh: { label: '中文', abbrev: 'ZH', flag: 'cn', subdomain: 'zh', htmlLang: 'zh', isDefault: false, isOfficial: true },
  fr: { label: 'Français', abbrev: 'FR', flag: 'fr', subdomain: 'fr', htmlLang: 'fr', isDefault: false, isOfficial: false },
} as const;

/** All language keys — derived from LANGUAGES */
export type Lang = keyof typeof LANGUAGES;

/** Array of all language keys */
export const LANGS = Object.keys(LANGUAGES) as Lang[];

/** Extract the key where isDefault is true — preserves the literal type */
type DefaultLang = { [K in Lang]: (typeof LANGUAGES)[K]['isDefault'] extends true ? K : never }[Lang];

/** The default language key */
export const DEFAULT_LANG = (
  Object.entries(LANGUAGES).find(([, v]) => v.isDefault)?.[0] ?? 'en'
) as DefaultLang;

/** Non-default languages (used for suffix fields) */
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

/**
 * GameLang = subset of Lang that the game officially provides (extracted data, baked content).
 * Use this type for Records that come from the game's text bundles, not for site UI.
 * The game currently ships 4 official languages; community translations (e.g. fr) are NOT in this set.
 */
type OfficialLang = { [K in Lang]: (typeof LANGUAGES)[K]['isOfficial'] extends true ? K : never }[Lang];
export type GameLang = OfficialLang;

/** Array of game-official language keys, in the same order as LANGUAGES */
export const GAME_LANGS = LANGS.filter((l): l is GameLang => LANGUAGES[l].isOfficial);

/** Non-default GAME languages (used for suffix fields on extracted data) */
export type GameSuffixLang = Exclude<GameLang, typeof DEFAULT_LANG>;

/** Array of game-official suffix language keys (excludes the default lang) */
export const GAME_SUFFIX_LANGS = GAME_LANGS.filter((l): l is GameSuffixLang => l !== DEFAULT_LANG);

/** Type guard for game-official languages */
export function isGameLang(value: string): value is GameLang {
  return value in LANGUAGES && LANGUAGES[value as Lang].isOfficial;
}
