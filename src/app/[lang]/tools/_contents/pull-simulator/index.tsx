import { getCharacterIndex } from '@/lib/data/characters';
import PullSimulatorClient from './PullSimulatorClient';

export type GachaCharacterEntry = {
  id: string;
  slug: string;
  name: string;
  name_jp: string;
  name_kr: string;
  name_zh: string;
  category: 'normal' | 'premium' | 'limited';
};

export type GachaMinorEntry = {
  id: string;
  name: string;
  name_jp: string;
  name_kr: string;
  name_zh: string;
};

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
      name_jp: entry.Fullname_jp ?? entry.Fullname,
      name_kr: entry.Fullname_kr ?? entry.Fullname,
      name_zh: entry.Fullname_zh ?? entry.Fullname,
    };

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
