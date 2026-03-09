import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';

type RecoGearEntry = { name: string; mainStat?: string };
type RecoSetEntry = { name: string; count: number };
type RecoBuild = {
  Weapon?: RecoGearEntry[];
  Amulet?: RecoGearEntry[];
  Set?: (RecoSetEntry[] | string)[];
  Talisman?: string[] | string;
  SubstatPrio?: string;
};
type CharacterReco = Record<string, RecoBuild>;
type RecoPresets = {
  talismans: Record<string, string[]>;
  sets: Record<string, RecoSetEntry[]>;
  substats: Record<string, string>;
};

type GearUsageCharacter = { id: string; slug: string; buildNames: string[] };

type GearUsageEntry = {
  name: string;
  count: number;
  characters: GearUsageCharacter[];
};

type GearUsageOutput = {
  weapon: GearUsageEntry[];
  amulet: GearUsageEntry[];
  set: GearUsageEntry[];
  talisman: GearUsageEntry[];
};

// ── Preset resolution (inline, no TS path aliases in pipeline) ──

function resolveTalismans(val: string[] | string | undefined, presets: RecoPresets): string[] | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') {
    const key = val.startsWith('$') ? val.slice(1) : val;
    return presets.talismans[key];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of val) {
    if (item.startsWith('$')) {
      for (const t of presets.talismans[item.slice(1)] ?? []) {
        if (!seen.has(t)) { seen.add(t); result.push(t); }
      }
    } else {
      if (!seen.has(item)) { seen.add(item); result.push(item); }
    }
  }
  return result;
}

function resolveSets(val: (RecoSetEntry[] | string)[] | undefined, presets: RecoPresets): RecoSetEntry[][] | undefined {
  if (!val) return undefined;
  return val.map(combo => typeof combo === 'string' ? (presets.sets[combo] ?? []) : combo);
}

// ── Main ──

export async function run() {
  // Load slug-to-id for character lookup
  const slugToIdRaw = await readFile(join(PATHS.generated, 'characters-slug-to-id.json'), 'utf-8');
  const slugToId: Record<string, string> = JSON.parse(slugToIdRaw);
  const idToSlug: Record<string, string> = {};
  for (const [slug, id] of Object.entries(slugToId)) idToSlug[id] = slug;

  // Load presets
  const presets: RecoPresets = JSON.parse(await readFile(join(PATHS.reco, '_presets.json'), 'utf-8'));

  // Read all reco files
  const files = (await readdir(PATHS.reco)).filter(f => f !== '_presets.json' && f.endsWith('.json'));

  // Usage maps: equipment name → character list
  const weaponUsage = new Map<string, GearUsageCharacter[]>();
  const amuletUsage = new Map<string, GearUsageCharacter[]>();
  const setUsage = new Map<string, GearUsageCharacter[]>();
  const talismanUsage = new Map<string, GearUsageCharacter[]>();

  function addUsage(map: Map<string, GearUsageCharacter[]>, name: string, charId: string, slug: string, buildName: string, seen: Set<string>) {
    if (seen.has(name)) return;
    seen.add(name);
    const arr = map.get(name) ?? [];
    const existing = arr.find(e => e.id === charId);
    if (existing) {
      existing.buildNames.push(buildName);
    } else {
      arr.push({ id: charId, slug, buildNames: [buildName] });
    }
    map.set(name, arr);
  }

  for (const file of files) {
    const charId = file.replace('.json', '');
    const slug = idToSlug[charId];
    if (!slug) continue;

    const reco: CharacterReco = JSON.parse(await readFile(join(PATHS.reco, file), 'utf-8'));

    const seenW = new Set<string>();
    const seenA = new Set<string>();
    const seenS = new Set<string>();
    const seenT = new Set<string>();

    for (const [buildName, build] of Object.entries(reco)) {
      if (build.Weapon) {
        for (const w of build.Weapon) addUsage(weaponUsage, w.name, charId, slug, buildName, seenW);
      }
      if (build.Amulet) {
        for (const a of build.Amulet) addUsage(amuletUsage, a.name, charId, slug, buildName, seenA);
      }

      const resolvedSets = resolveSets(build.Set, presets);
      if (resolvedSets) {
        for (const combo of resolvedSets) {
          for (const entry of combo) addUsage(setUsage, entry.name, charId, slug, buildName, seenS);
        }
      }

      const resolvedTalismans = resolveTalismans(build.Talisman, presets);
      if (resolvedTalismans) {
        for (const tName of resolvedTalismans) addUsage(talismanUsage, tName, charId, slug, buildName, seenT);
      }
    }
  }

  function toSorted(map: Map<string, GearUsageCharacter[]>): GearUsageEntry[] {
    return Array.from(map.entries())
      .map(([name, chars]) => ({ name, count: chars.length, characters: chars }))
      .sort((a, b) => b.count - a.count);
  }

  const output: GearUsageOutput = {
    weapon: toSorted(weaponUsage),
    amulet: toSorted(amuletUsage),
    set: toSorted(setUsage),
    talisman: toSorted(talismanUsage),
  };

  const totalItems = output.weapon.length + output.amulet.length + output.set.length + output.talisman.length;

  const outPath = join(PATHS.generated, 'gear-usage-stats.json');
  await writeFile(outPath, JSON.stringify(output, null, 2));

  return `${totalItems} items (${output.weapon.length}W ${output.amulet.length}A ${output.set.length}S ${output.talisman.length}T) from ${files.length} characters`;
}
