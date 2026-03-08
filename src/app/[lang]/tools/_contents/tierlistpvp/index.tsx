import { getCharactersForList } from '@/lib/data/characters';
import TierListPvpClient from './TierListPvpClient';

export default async function TierlistPvpTool() {
  const characters = await getCharactersForList();
  return <TierListPvpClient characters={characters} />;
}
