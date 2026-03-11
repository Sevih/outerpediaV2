import type { Lang } from '@/lib/i18n/config';

export type ChangelogType = 'feature' | 'fix' | 'update' | 'balance' | 'news';

export type LangMap = Partial<Record<Lang, string>>;
export type LangMapArray = Partial<Record<Lang, string[]>>;

export type ChangelogEntry = {
  date: string;
  type: ChangelogType;
  title: LangMap;
  content: LangMapArray;
  url?: string;
};

export type ResolvedChangelogEntry = {
  date: string;
  type: ChangelogType;
  title: string;
  content: string[];
  url?: string;
};
