import type { Lang } from '@/lib/i18n/config';
import type {
  ChangelogEntry,
  ChangelogType,
  ResolvedChangelogEntry,
  LangMap,
  LangMapArray,
} from '@/types/changelog';
import rawEntries from '@data/changelog.json';

export const CHANGELOG_TYPE_STYLES: Record<ChangelogType, string> = {
  feature: 'bg-emerald-600/20 text-emerald-400',
  update: 'bg-blue-600/20 text-blue-400',
  fix: 'bg-red-600/20 text-red-400',
  balance: 'bg-amber-600/20 text-amber-400',
  news: 'bg-violet-600/20 text-violet-400',
};

const entries = rawEntries as ChangelogEntry[];

function resolveLangMap(map: LangMap, lang: Lang): string {
  return map[lang] ?? map.en ?? '';
}

function resolveLangMapArray(map: LangMapArray, lang: Lang): string[] {
  return map[lang] ?? map.en ?? [];
}

function resolveEntry(
  entry: ChangelogEntry,
  lang: Lang
): ResolvedChangelogEntry {
  return {
    date: entry.date,
    type: entry.type,
    title: resolveLangMap(entry.title, lang),
    content: resolveLangMapArray(entry.content, lang),
    ...(entry.url && { url: entry.url }),
  };
}

export function getChangelog(
  lang: Lang,
  options?: { limit?: number }
): ResolvedChangelogEntry[] {
  const resolved = entries.map((e) => resolveEntry(e, lang));
  return options?.limit ? resolved.slice(0, options.limit) : resolved;
}
