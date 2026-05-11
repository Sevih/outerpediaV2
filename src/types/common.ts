import type { Lang, GameSuffixLang } from '@/lib/i18n/config';

// Re-export language types from the single source of truth
export type { Lang, SuffixLang, GameLang, GameSuffixLang } from '@/lib/i18n/config';
export { LANGS, DEFAULT_LANG, SUFFIX_LANGS, GAME_LANGS, GAME_SUFFIX_LANGS } from '@/lib/i18n/config';

/**
 * Adds localized suffix fields to a base type. Suffixes cover the game's
 * official languages only (jp/kr/zh) — fr is a community translation and
 * is NOT produced by the extractors, so it must not appear here.
 *
 * Example: WithLocalizedFields<{ name: string }, 'name'>
 * → { name: string; name_jp?: string; name_kr?: string; name_zh?: string }
 */
export type WithLocalizedFields<T, K extends string> = T & {
  [P in `${K}_${GameSuffixLang}`]?: string;
};

/**
 * A record mapping languages to strings.
 * Used for editorial content (guides, notes, etc.)
 */
export type LangMap = Partial<Record<Lang, string>>;

/**
 * A note entry in guide/team content.
 */
export type NoteEntry =
  | { type: 'p'; string: string }
  | { type: 'ul'; items: string[] };
