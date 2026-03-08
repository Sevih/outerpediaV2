import { getCharactersForList } from '@/lib/data/characters';
import TierListPveClient from './TierListPveClient';

export default async function TierlistPveTool() {
  const characters = await getCharactersForList();
  return <TierListPveClient characters={characters} />;
}
