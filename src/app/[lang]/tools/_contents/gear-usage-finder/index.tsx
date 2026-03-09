import { getWeapons, getAmulets, getArmorSets, getGearFinderData } from '@/lib/data/equipment';
import { getCharactersForList } from '@/lib/data/characters';
import GearUsageFinderClient from './GearUsageFinderClient';

export default async function GearUsageFinderTool() {
  const [weapons, amulets, sets, builds, characters] = await Promise.all([
    getWeapons(),
    getAmulets(),
    getArmorSets(),
    getGearFinderData(),
    getCharactersForList(),
  ]);

  return (
    <GearUsageFinderClient
      weapons={weapons}
      amulets={amulets}
      sets={sets}
      builds={builds}
      characters={characters}
    />
  );
}
