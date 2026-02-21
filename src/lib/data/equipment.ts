import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, CharacterReco, RecoPresets } from '@/types/equipment';
import { resolveRecoPresets } from '@/lib/data/reco';
import { slugifyEquipment } from '@/lib/format-text';

export { slugifyEquipment };

const EQUIP_DIR = join(process.cwd(), 'data/equipment');
const RECO_DIR = join(process.cwd(), 'data/reco');

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
  return JSON.parse(raw) as Talisman[];
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
  const [weapons, amulets, talismans, sets, eeMap] = await Promise.all([
    getWeapons(), getAmulets(), getTalismans(), getArmorSets(), getExclusiveEquipment(),
  ]);

  for (const w of weapons) {
    if (slugifyEquipment(w.name) === slug) return { type: 'weapon', data: w };
  }
  for (const a of amulets) {
    if (slugifyEquipment(a.name) === slug) return { type: 'amulet', data: a };
  }
  for (const t of talismans) {
    if (slugifyEquipment(t.name) === slug) return { type: 'talisman', data: t };
  }
  for (const s of sets) {
    if (slugifyEquipment(s.name) === slug) return { type: 'set', data: s };
  }
  for (const [charId, ee] of Object.entries(eeMap)) {
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

  const results: RecoReference[] = [];

  for (const file of files) {
    if (file === '_presets.json' || !file.endsWith('.json')) continue;
    const charId = file.replace('.json', '');
    const raw = await readFile(join(RECO_DIR, file), 'utf-8');
    const reco = JSON.parse(raw) as CharacterReco;
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
          combo.some(entry => entry.name === equipmentName)
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
