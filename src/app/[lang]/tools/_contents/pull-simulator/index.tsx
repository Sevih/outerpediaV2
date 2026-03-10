import { getCharacterIndex } from '@/lib/data/characters';
import { SUFFIX_LANGS } from '@/lib/i18n/config';
import type { SuffixLang } from '@/lib/i18n/config';
import PullSimulatorClient from './PullSimulatorClient';

type LocalizedName = { [P in `name_${SuffixLang}`]: string };

export type GachaCharacterEntry = {
  id: string;
  slug: string;
  name: string;
  category: 'normal' | 'premium' | 'limited';
} & LocalizedName;

export type GachaMinorEntry = {
  id: string;
  name: string;
} & LocalizedName;

const LIMITED_TAGS = new Set(['limited', 'seasonal', 'collab']);

export default async function PullSimulatorTool() {
  const index = await getCharacterIndex();

  const characters: GachaCharacterEntry[] = [];
  const pool1: GachaMinorEntry[] = [];
  const pool2: GachaMinorEntry[] = [];

  for (const [id, entry] of Object.entries(index)) {
    const minor = {
      id,
      name: entry.Fullname,
      ...Object.fromEntries(SUFFIX_LANGS.map((l) => [`name_${l}`, entry[`Fullname_${l}`] ?? entry.Fullname])),
    } as GachaMinorEntry;

    if (entry.Rarity === 1) { pool1.push(minor); continue; }
    if (entry.Rarity === 2) { pool2.push(minor); continue; }

    let category: GachaCharacterEntry['category'] = 'normal';
    if (entry.tags.includes('premium')) {
      category = 'premium';
    } else if (entry.tags.some((t) => LIMITED_TAGS.has(t))) {
      category = 'limited';
    }

    characters.push({ ...minor, slug: entry.slug, category });
  }

  const sortByName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  characters.sort(sortByName);
  pool1.sort(sortByName);
  pool2.sort(sortByName);

  return <PullSimulatorClient characters={characters} pool1={pool1} pool2={pool2} />;
}
