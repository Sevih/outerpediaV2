import { getWeapons, getAmulets, getTalismans, getArmorSets } from './equipment';
import type { ClassType } from '@/types/enums';
import type { ItemRarity } from '@/lib/theme';
import type {
  SourceDropInfo,
  EquipmentCategory,
  EquipmentDropEntry,
} from '@/types/equipment';

// ── Source labels (EN hardcoded, i18n-ready) ──

const SOURCE_LABELS: Record<string, string> = {
  'Special Request': 'Special Request',
  'Event Shop': 'Event Shop',
  'Irregular Extermination': 'Irregular Extermination',
  'Adventure License': 'Adventure License',
};

/**
 * Get a human-readable label for a source code.
 * Pure function — no file I/O. Ready for future `lang` parameter.
 */
export function getSourceLabel(source: string | null): string {
  if (!source) return 'Unknown';
  return SOURCE_LABELS[source] ?? source;
}

// ── Internal: load all equipment into a flat list ──

type RawEntry = {
  name: string;
  category: EquipmentCategory;
  class: ClassType | null;
  rarity: ItemRarity;
  source: string | null;
  boss: string | null;
  mode: string | null;
};

async function loadAllEquipment(): Promise<RawEntry[]> {
  const [weapons, amulets, talismans, sets] = await Promise.all([
    getWeapons(),
    getAmulets(),
    getTalismans(),
    getArmorSets(),
  ]);

  const entries: RawEntry[] = [];

  for (const w of weapons) {
    entries.push({
      name: w.name,
      category: 'weapon',
      class: w.class ?? null,
      rarity: w.rarity,
      source: w.source ?? null,
      boss: w.boss ?? null,
      mode: w.mode,
    });
  }

  for (const a of amulets) {
    entries.push({
      name: a.name,
      category: 'amulet',
      class: a.class ?? null,
      rarity: a.rarity,
      source: a.source ?? null,
      boss: a.boss ?? null,
      mode: a.mode,
    });
  }

  for (const t of talismans) {
    entries.push({
      name: t.name,
      category: 'talisman',
      class: null,
      rarity: t.rarity,
      source: t.source,
      boss: t.boss,
      mode: t.mode,
    });
  }

  for (const s of sets) {
    entries.push({
      name: s.name,
      category: 'set',
      class: s.class ?? null,
      rarity: s.rarity,
      source: s.source ?? null,
      boss: s.boss ?? null,
      mode: s.mode,
    });
  }

  return entries;
}

// ── Public API ──

/**
 * Get source/drop info for a single equipment item by its English name.
 */
export async function getSourceDrop(itemName: string): Promise<SourceDropInfo | null> {
  const all = await loadAllEquipment();
  const entry = all.find((e) => e.name === itemName);
  if (!entry) return null;

  return {
    source: entry.source,
    boss: entry.boss,
    mode: entry.mode,
    sourceLabel: getSourceLabel(entry.source),
  };
}

/**
 * Get all equipment dropped by a specific boss, grouped by category.
 */
export async function getEquipmentByBoss(
  bossName: string
): Promise<Record<EquipmentCategory, EquipmentDropEntry[]>> {
  const all = await loadAllEquipment();

  const result: Record<EquipmentCategory, EquipmentDropEntry[]> = {
    weapon: [],
    amulet: [],
    set: [],
    talisman: [],
  };

  for (const entry of all) {
    if (entry.boss === bossName) {
      result[entry.category].push({
        name: entry.name,
        category: entry.category,
        class: entry.class,
        rarity: entry.rarity,
      });
    }
  }

  return result;
}

/**
 * Build a full map: source → boss → equipment list.
 * Useful for a dedicated "where to farm" page.
 */
export async function getSourceDropMap(): Promise<
  Map<string, Map<string | null, EquipmentDropEntry[]>>
> {
  const all = await loadAllEquipment();
  const map = new Map<string, Map<string | null, EquipmentDropEntry[]>>();

  for (const entry of all) {
    const sourceKey = entry.source ?? 'Unknown';

    if (!map.has(sourceKey)) {
      map.set(sourceKey, new Map());
    }
    const bossMap = map.get(sourceKey)!;

    if (!bossMap.has(entry.boss)) {
      bossMap.set(entry.boss, []);
    }
    bossMap.get(entry.boss)!.push({
      name: entry.name,
      category: entry.category,
      class: entry.class,
      rarity: entry.rarity,
    });
  }

  return map;
}
