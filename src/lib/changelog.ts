import type { Lang } from '@/lib/i18n/config';
import type {
  ChangelogEntry,
  ResolvedChangelogEntry,
  LangMap,
  LangMapArray,
} from '@/types/changelog';
import rawEntries from '@data/changelog.json';

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
