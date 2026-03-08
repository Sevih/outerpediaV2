import { getCharactersForList } from '@/lib/data/characters';
import { getExclusiveEquipment } from '@/lib/data/equipment';
import EePriorityBaseClient from './EePriorityBaseClient';

export default async function EePriorityBaseTool() {
  const [characters, eeMap] = await Promise.all([
    getCharactersForList(),
    getExclusiveEquipment(),
  ]);

  const entries = characters
    .filter(c => eeMap[c.ID])
    .map(c => ({ ...c, eeRank: eeMap[c.ID].rank }));

  return <EePriorityBaseClient characters={entries} />;
}
