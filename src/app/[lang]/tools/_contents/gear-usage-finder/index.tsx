import { getWeapons, getAmulets, getTalismans, getArmorSets, getAllEquipmentUsage } from '@/lib/data/equipment';
import { getCharactersForList } from '@/lib/data/characters';
import GearUsageFinderClient from './GearUsageFinderClient';
import type { EquipmentItem } from './GearUsageFinderClient';

export default async function GearUsageFinderTool() {
  const [weapons, amulets, talismans, sets, usage, characters] = await Promise.all([
    getWeapons(),
    getAmulets(),
    getTalismans(),
    getArmorSets(),
    getAllEquipmentUsage(),
    getCharactersForList(),
  ]);

  const items: EquipmentItem[] = [];

  for (const w of weapons) {
    items.push({
      name: w.name, name_jp: w.name_jp, name_kr: w.name_kr, name_zh: w.name_zh,
      type: 'weapon', rarity: w.rarity, image: `equipment/${w.image}`,
      effectIcon: w.effect_icon, classType: w.class, level: w.level,
      users: usage[w.name] ?? [],
    });
  }

  for (const a of amulets) {
    items.push({
      name: a.name, name_jp: a.name_jp, name_kr: a.name_kr, name_zh: a.name_zh,
      type: 'amulet', rarity: a.rarity, image: `equipment/${a.image}`,
      effectIcon: a.effect_icon, classType: a.class, level: a.level,
      users: usage[a.name] ?? [],
    });
  }

  for (const t of talismans) {
    items.push({
      name: t.name, name_jp: t.name_jp, name_kr: t.name_kr, name_zh: t.name_zh,
      type: 'talisman', rarity: t.rarity, image: `equipment/${t.image}`,
      effectIcon: t.effect_icon, classType: null, level: t.level,
      users: usage[t.name] ?? [],
    });
  }

  for (const s of sets) {
    items.push({
      name: s.name, name_jp: s.name_jp, name_kr: s.name_kr, name_zh: s.name_zh,
      type: 'set', rarity: s.rarity, image: `equipment/${s.set_icon}`,
      effectIcon: null, classType: s.class, level: null,
      users: usage[s.name] ?? [],
    });
  }

  return <GearUsageFinderClient items={items} characters={characters} />;
}
