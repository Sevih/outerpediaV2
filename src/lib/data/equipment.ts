import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, CharacterReco, RecoPresets } from '@/types/equipment';
import { resolveRecoPresets } from '@/lib/data/reco';
import { slugifyEquipment } from '@/lib/format-text';

export { slugifyEquipment };

const EQUIP_DIR = join(process.cwd(), 'data/equipment');
const RECO_DIR = join(process.cwd(), 'data/reco');

type StatRangesByRarity = Record<string, Record<string, [number, number]>>;
type StatRangesJSON = Record<string, Record<string, StatRangesByRarity>>;

let statRangesCache: Record<string, unknown> | null = null;

async function getStatRanges(): Promise<Record<string, unknown>> {
  if (!statRangesCache) {
    const raw = await readFile(join(EQUIP_DIR, 'statRanges.json'), 'utf-8');
    statRangesCache = JSON.parse(raw);
  }
  return statRangesCache!;
}

/** Returns stat ranges for a given equipment category, rarity, and level */
export async function getWeaponStatRanges(
  rarity: string,
  level: number
): Promise<Record<string, [number, number]>> {
  const data = await getStatRanges() as StatRangesJSON;
  const weaponStats = data.weapons;
  const result: Record<string, [number, number]> = {};
  for (const [stat, rarities] of Object.entries(weaponStats)) {
    const levels = rarities[rarity];
    if (levels) {
      const range = levels[String(level)];
      if (range) result[stat] = range as [number, number];
    }
  }
  return result;
}

/** Returns stat ranges for a given accessory rarity and level, filtered by mainStats */
export async function getAccessoryStatRanges(
  rarity: string,
  level: number,
  mainStats: string[] | null
): Promise<Record<string, [number, number]>> {
  const data = await getStatRanges() as StatRangesJSON;
  const accStats = data.accessories;
  const result: Record<string, [number, number]> = {};
  for (const [stat, rarities] of Object.entries(accStats)) {
    if (mainStats && !mainStats.includes(stat)) continue;
    const levels = rarities[rarity];
    if (levels) {
      const range = levels[String(level)];
      if (range) result[stat] = range as [number, number];
    }
  }
  return result;
}

const ARMOR_PIECES = ['Helmet', 'Armor', 'Gloves', 'Shoes'] as const;
export type ArmorPiece = typeof ARMOR_PIECES[number];
export type ArmorSetStatRanges = Record<ArmorPiece, Record<string, [number, number]>>;

/** Returns stat ranges for each armor piece (Helmet, Armor, Gloves, Shoes) */
export async function getArmorSetStatRanges(): Promise<ArmorSetStatRanges> {
  const data = await getStatRanges() as StatRangesJSON;
  const result = {} as ArmorSetStatRanges;
  for (const piece of ARMOR_PIECES) {
    const pieceStats = data[piece];
    result[piece] = {};
    if (!pieceStats) continue;
    for (const [stat, rarities] of Object.entries(pieceStats)) {
      const levels = rarities['legendary'];
      if (levels) {
        const range = levels['6'];
        if (range) result[piece][stat] = range as [number, number];
      }
    }
  }
  return result;
}

export type TalismanStatRanges = Record<string, [number, number]>;

/** Returns stat ranges for talismans (flat map: stat → [min, max]) */
export async function getTalismanStatRanges(): Promise<TalismanStatRanges> {
  const data = await getStatRanges();
  return (data.talismans as TalismanStatRanges) ?? {};
}

/** Map EE mainStat (EN) to a stat key in statRanges.ee */
const EE_STAT_KEY_MAP: { test: RegExp; key: string }[] = [
  { test: /Reduced DMG|Reduces.*Damage Taken/i, key: 'DMG RED%' },
  { test: /DMG Increase|Damage Increase/i,      key: 'DMG UP%' },
  { test: /Effectiveness/i,                      key: 'EFF' },
  { test: /Critical Hit Chance/i,                key: 'CHC' },
];

export type EEStatRange = { key: string; range: [number, number] };

/** Returns stat key + [min, max] range for an EE based on its mainStat string, or null */
export async function getEEStatRange(mainStat: string): Promise<EEStatRange | null> {
  const match = EE_STAT_KEY_MAP.find(m => m.test.test(mainStat));
  if (!match) return null;
  const data = await getStatRanges();
  const eeRanges = data.ee as Record<string, [number, number]> | undefined;
  if (!eeRanges) return null;
  const range = eeRanges[match.key];
  return range ? { key: match.key, range } : null;
}

export async function getWeapons(): Promise<Weapon[]> {
  const raw = await readFile(join(EQUIP_DIR, 'weapon.json'), 'utf-8');
  return JSON.parse(raw) as Weapon[];
}

export async function getAmulets(): Promise<Amulet[]> {
  const raw = await readFile(join(EQUIP_DIR, 'accessory.json'), 'utf-8');
  return JSON.parse(raw) as Amulet[];
}

export async function getTalismans(): Promise<Talisman[]> {
  const raw = await readFile(join(EQUIP_DIR, 'talisman.json'), 'utf-8');
  const data = JSON.parse(raw) as Talisman[];
  for (const t of data) t.level = Number(t.level);
  return data;
}

export async function getArmorSets(): Promise<ArmorSet[]> {
  const raw = await readFile(join(EQUIP_DIR, 'sets.json'), 'utf-8');
  return JSON.parse(raw) as ArmorSet[];
}

export async function getExclusiveEquipment(): Promise<Record<string, ExclusiveEquipment>> {
  const raw = await readFile(join(EQUIP_DIR, 'ee.json'), 'utf-8');
  return JSON.parse(raw) as Record<string, ExclusiveEquipment>;
}

// ── Lookup types ──

export type EquipmentLookup =
  | { type: 'weapon'; data: Weapon }
  | { type: 'amulet'; data: Amulet }
  | { type: 'talisman'; data: Talisman }
  | { type: 'set'; data: ArmorSet }
  | { type: 'ee'; data: ExclusiveEquipment; characterId: string };

// ── Lookup by slug ──

export async function getEquipmentBySlug(slug: string): Promise<EquipmentLookup | null> {
  for (const w of await getWeapons()) {
    if (slugifyEquipment(w.name) === slug) return { type: 'weapon', data: w };
  }
  for (const a of await getAmulets()) {
    if (slugifyEquipment(a.name) === slug) return { type: 'amulet', data: a };
  }
  for (const t of await getTalismans()) {
    if (slugifyEquipment(t.name) === slug) return { type: 'talisman', data: t };
  }
  for (const s of await getArmorSets()) {
    if (slugifyEquipment(s.name) === slug) return { type: 'set', data: s };
  }
  for (const [charId, ee] of Object.entries(await getExclusiveEquipment())) {
    if (slugifyEquipment(ee.name) === slug) return { type: 'ee', data: ee, characterId: charId };
  }
  return null;
}

// ── All slugs (for generateStaticParams) ──

export async function getAllEquipmentSlugs(): Promise<string[]> {
  const [weapons, amulets, talismans, sets, eeMap] = await Promise.all([
    getWeapons(), getAmulets(), getTalismans(), getArmorSets(), getExclusiveEquipment(),
  ]);

  return [
    ...weapons.map(w => slugifyEquipment(w.name)),
    ...amulets.map(a => slugifyEquipment(a.name)),
    ...talismans.map(t => slugifyEquipment(t.name)),
    ...sets.map(s => slugifyEquipment(s.name)),
    ...Object.values(eeMap).map(ee => slugifyEquipment(ee.name)),
  ];
}

// ── Cross-reference: which characters recommend this equipment? ──

export type RecoReference = {
  characterId: string;
  buildName: string;
};

export async function getCharactersRecommendingEquipment(
  equipmentName: string,
  equipmentType: EquipmentLookup['type']
): Promise<RecoReference[]> {
  // EE is 1:1 with a character — no need to scan reco files
  if (equipmentType === 'ee') return [];

  const files = await readdir(RECO_DIR);
  const presetsRaw = await readFile(join(RECO_DIR, '_presets.json'), 'utf-8');
  const presets = JSON.parse(presetsRaw) as RecoPresets;

  const recoFiles = files.filter(f => f !== '_presets.json' && f.endsWith('.json'));
  const recoEntries = await Promise.all(
    recoFiles.map(async (file) => {
      const charId = file.replace('.json', '');
      const raw = await readFile(join(RECO_DIR, file), 'utf-8');
      return { charId, reco: JSON.parse(raw) as CharacterReco };
    })
  );

  const results: RecoReference[] = [];

  for (const { charId, reco } of recoEntries) {
    const resolved = resolveRecoPresets(reco, presets);

    for (const [buildName, build] of Object.entries(resolved)) {
      let found = false;

      if (equipmentType === 'weapon' && build.Weapon) {
        found = build.Weapon.some(w => w.name === equipmentName);
      } else if (equipmentType === 'amulet' && build.Amulet) {
        found = build.Amulet.some(a => a.name === equipmentName);
      } else if (equipmentType === 'talisman' && build.Talisman) {
        found = build.Talisman.includes(equipmentName);
      } else if (equipmentType === 'set' && build.Set) {
        found = build.Set.some(combo =>
          combo.some(entry => entry.name === equipmentName || `${entry.name} Set` === equipmentName)
        );
      }

      if (found) {
        results.push({ characterId: charId, buildName });
      }
    }
  }

  // Deduplicate by characterId (keep first build match)
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.characterId)) return false;
    seen.add(r.characterId);
    return true;
  });
}

/**
 * Build a complete mapping of equipment name → characters that recommend it.
 * Scans all reco files once and returns a Map keyed by equipment EN name.
 * Each value is an array of { characterId, buildNames } (deduplicated per character,
 * collecting all build names).
 */
export type EquipmentUsageEntry = { characterId: string; buildNames: string[] };

export async function getAllEquipmentUsage(): Promise<Record<string, EquipmentUsageEntry[]>> {
  const files = await readdir(RECO_DIR);
  const presetsRaw = await readFile(join(RECO_DIR, '_presets.json'), 'utf-8');
  const presets = JSON.parse(presetsRaw) as RecoPresets;

  const recoFiles = files.filter(f => f !== '_presets.json' && f.endsWith('.json'));
  const recoEntries = await Promise.all(
    recoFiles.map(async (file) => {
      const charId = file.replace('.json', '');
      const raw = await readFile(join(RECO_DIR, file), 'utf-8');
      return { charId, reco: JSON.parse(raw) as CharacterReco };
    })
  );

  // Intermediate: equipName → Map<charId, Set<buildName>>
  const intermediate = new Map<string, Map<string, Set<string>>>();

  const addUsage = (equipName: string, charId: string, buildName: string) => {
    if (!intermediate.has(equipName)) intermediate.set(equipName, new Map());
    const charMap = intermediate.get(equipName)!;
    if (!charMap.has(charId)) charMap.set(charId, new Set());
    charMap.get(charId)!.add(buildName);
  };

  for (const { charId, reco } of recoEntries) {
    const resolved = resolveRecoPresets(reco, presets);
    for (const [buildName, build] of Object.entries(resolved)) {
      if (build.Weapon) {
        for (const w of build.Weapon) addUsage(w.name, charId, buildName);
      }
      if (build.Amulet) {
        for (const a of build.Amulet) addUsage(a.name, charId, buildName);
      }
      if (build.Talisman) {
        for (const t of build.Talisman) addUsage(t, charId, buildName);
      }
      if (build.Set) {
        for (const combo of build.Set) {
          for (const entry of combo) addUsage(entry.name, charId, buildName);
        }
      }
    }
  }

  // Convert to final format
  const result: Record<string, EquipmentUsageEntry[]> = {};
  for (const [equipName, charMap] of intermediate) {
    result[equipName] = Array.from(charMap.entries()).map(([characterId, builds]) => ({
      characterId,
      buildNames: Array.from(builds),
    }));
  }
  return result;
}

// ── Gear Finder: read pre-built index from pipeline ──

export type GearFinderRecoGear = { name: string; mainStats: string[] };

export type GearFinderBuild = {
  characterId: string;
  buildName: string;
  weapons: GearFinderRecoGear[];
  amulets: GearFinderRecoGear[];
  sets: string[];
  substatPrio: string[];
};

const GENERATED_DIR = join(process.cwd(), 'data/generated');

/** Read the gear-finder index generated by the pipeline */
export async function getGearFinderData(): Promise<GearFinderBuild[]> {
  const raw = await readFile(join(GENERATED_DIR, 'gear-finder-index.json'), 'utf-8');
  return JSON.parse(raw);
}
