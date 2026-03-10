import { readFile } from 'fs/promises';
import { join } from 'path';
import { getCharactersForList } from '@/lib/data/characters';
import { getWeapons, getAmulets, getArmorSets, getTalismans } from '@/lib/data/equipment';
import type { Weapon, Amulet, Talisman } from '@/types/equipment';
import type { WithLocalizedFields } from '@/types/common';
import { SUFFIX_LANGS } from '@/lib/i18n/config';
import GearUsageStatisticsClient from './GearUsageStatisticsClient';

export type GearCategory = 'weapon' | 'amulet' | 'set' | 'talisman';

export type GearUsageCharacter = {
  id: string;
  slug: string;
  buildNames: string[];
};

export type GearUsageEntry = WithLocalizedFields<{
  name: string;
  count: number;
  characters: GearUsageCharacter[];
  image: string;
  rarity: string;
  effectIcon: string | null;
  classType: string | null;
  level: number | null;
}, 'name'>;

export type GearUsageData = Record<GearCategory, GearUsageEntry[]>;

type RawGearUsageEntry = { name: string; count: number; characters: GearUsageCharacter[] };
type RawGearUsageData = Record<GearCategory, RawGearUsageEntry[]>;

type VisualInfo = WithLocalizedFields<{
  image: string; rarity: string; effectIcon: string | null; classType: string | null; level: number | null;
}, 'name'>;

/** Extract localized name fields from an item */
function localizedNames(item: { name: string } & Record<string, unknown>) {
  return Object.fromEntries(SUFFIX_LANGS.map(l => [`name_${l}`, item[`name_${l}`]]));
}

/** Enrich raw usage entries with visual info + localized names */
function enrichEntries(
  raw: RawGearUsageEntry[],
  lookup: Map<string, VisualInfo>,
): GearUsageEntry[] {
  return raw.map(entry => {
    const info = lookup.get(entry.name);
    return {
      ...entry,
      ...info,
      image: info?.image ?? '',
      rarity: info?.rarity ?? 'legendary',
      effectIcon: info?.effectIcon ?? null,
      classType: info?.classType ?? null,
      level: info?.level ?? null,
    };
  });
}

function buildLookup<T>(items: T[], getName: (t: T) => string, getInfo: (t: T) => VisualInfo) {
  const map = new Map<string, VisualInfo>();
  for (const item of items) map.set(getName(item), getInfo(item));
  return map;
}

export default async function GearUsageStatisticsTool() {
  const [characters, weapons, amulets, sets, talismans, usageRaw] = await Promise.all([
    getCharactersForList(),
    getWeapons(),
    getAmulets(),
    getArmorSets(),
    getTalismans(),
    readFile(join(process.cwd(), 'data/generated/gear-usage-stats.json'), 'utf-8'),
  ]);

  const rawData: RawGearUsageData = JSON.parse(usageRaw);

  // Build visual info lookups (with localized names)
  const weaponLookup = buildLookup(weapons, w => w.name, (w: Weapon) => ({
    image: `equipment/${w.image}`, rarity: w.rarity, effectIcon: w.effect_icon, classType: w.class, level: w.level,
    ...localizedNames(w),
  }));
  const amuletLookup = buildLookup(amulets, a => a.name, (a: Amulet) => ({
    image: `equipment/${a.image}`, rarity: a.rarity, effectIcon: a.effect_icon, classType: a.class, level: a.level,
    ...localizedNames(a),
  }));
  const setLookup = new Map<string, VisualInfo>();
  for (const s of sets) {
    const info: VisualInfo = {
      image: `equipment/TI_Equipment_Armor_${s.image_prefix}`, rarity: s.rarity, effectIcon: s.set_icon, classType: s.class, level: null,
      ...localizedNames(s),
    };
    setLookup.set(s.name, info);
    setLookup.set(s.name.replace(/ [Ss]et$/, ''), info);
  }
  const talismanLookup = buildLookup(talismans, t => t.name, (t: Talisman) => ({
    image: `equipment/${t.image}`, rarity: t.rarity, effectIcon: t.effect_icon, classType: null, level: t.level,
    ...localizedNames(t),
  }));

  const data: GearUsageData = {
    weapon: enrichEntries(rawData.weapon, weaponLookup),
    amulet: enrichEntries(rawData.amulet, amuletLookup),
    set: enrichEntries(rawData.set, setLookup),
    talisman: enrichEntries(rawData.talisman, talismanLookup),
  };

  return <GearUsageStatisticsClient data={data} characters={characters} />;
}
