import { readFile } from 'fs/promises';
import { join } from 'path';
import { getCharactersForList } from '@/lib/data/characters';
import { getAllGuides } from '@/lib/data/guides';
import MostUsedUnitsClient from './MostUsedUnitsClient';

export type MostUsedEntry = {
  slug: string;
  total: number;
  categories: Record<string, string[]>;
};

export type GuideTitleMap = Record<string, Record<string, string>>;

export default async function MostUsedUnitsTool() {
  const [characters, usageRaw, guides] = await Promise.all([
    getCharactersForList(),
    readFile(join(process.cwd(), 'data/generated/most-used-units.json'), 'utf-8'),
    getAllGuides(),
  ]);

  const usage: MostUsedEntry[] = JSON.parse(usageRaw);

  // Build guide slug → localized title map
  const guideTitles: GuideTitleMap = {};
  for (const guide of guides) {
    guideTitles[guide.slug] = guide.title as unknown as Record<string, string>;
  }

  return <MostUsedUnitsClient characters={characters} usage={usage} guideTitles={guideTitles} />;
}
