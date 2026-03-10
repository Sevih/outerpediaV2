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

/** Minimal character data needed by the most-used-units page */
export type MostUsedCharacter = Pick<
  Awaited<ReturnType<typeof getCharactersForList>>[number],
  'ID' | 'Fullname' | 'Fullname_jp' | 'Fullname_kr' | 'Fullname_zh' | 'slug' | 'Element' | 'Class' | 'Rarity'
>;

export default async function MostUsedUnitsTool() {
  const [allCharacters, usageRaw, guides] = await Promise.all([
    getCharactersForList(),
    readFile(join(process.cwd(), 'data/generated/most-used-units.json'), 'utf-8'),
    getAllGuides(),
  ]);

  const usage: MostUsedEntry[] = JSON.parse(usageRaw);

  // Trim character data to only fields used by this page
  const characters: MostUsedCharacter[] = allCharacters.map(c => ({
    ID: c.ID,
    Fullname: c.Fullname,
    Fullname_jp: c.Fullname_jp,
    Fullname_kr: c.Fullname_kr,
    Fullname_zh: c.Fullname_zh,
    slug: c.slug,
    Element: c.Element,
    Class: c.Class,
    Rarity: c.Rarity,
  }));

  // Build guide slug → localized title map
  const guideTitles: GuideTitleMap = {};
  for (const guide of guides) {
    guideTitles[guide.slug] = guide.title as unknown as Record<string, string>;
  }

  return <MostUsedUnitsClient characters={characters} usage={usage} guideTitles={guideTitles} />;
}
