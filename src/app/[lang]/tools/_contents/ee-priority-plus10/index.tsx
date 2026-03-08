import { getCharactersForList } from '@/lib/data/characters';
import { getExclusiveEquipment } from '@/lib/data/equipment';
import EePriorityPlus10Client from './EePriorityPlus10Client';

export default async function EePriorityPlus10Tool() {
  const [characters, eeMap] = await Promise.all([
    getCharactersForList(),
    getExclusiveEquipment(),
  ]);

  const entries = characters
    .filter(c => eeMap[c.ID] && eeMap[c.ID].rank10)
    .map(c => ({ ...c, eeRank: eeMap[c.ID].rank10! }));

  return <EePriorityPlus10Client characters={entries} />;
}
