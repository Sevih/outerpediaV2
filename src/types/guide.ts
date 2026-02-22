import type { LangMap } from './common';

export type GuideMeta = {
  slug: string;
  category: string;
  title: LangMap;
  description: LangMap;
  icon: string;
  author: string;
  last_updated: string;
};

export type GuideCategory = {
  slug: string;
  icon: string;
  order: number;
  keywords?: string[];
};
