import type { Lang, SuffixLang } from '@/lib/i18n/config';

// Re-export language types from the single source of truth
export type { Lang, SuffixLang } from '@/lib/i18n/config';
export { LANGS, DEFAULT_LANG, SUFFIX_LANGS } from '@/lib/i18n/config';

/**
 * Adds localized suffix fields to a base type.
 * Suffixes are auto-derived from LANGUAGES config.
 *
 * Example: WithLocalizedFields<{ name: string }, 'name'>
 * → { name: string; name_jp?: string; name_kr?: string; name_zh?: string }
 */
export type WithLocalizedFields<T, K extends string> = T & {
  [P in `${K}_${SuffixLang}`]?: string;
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
