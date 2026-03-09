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

// ── Preset resolution (inline, no TS path aliases in pipeline) ──

function resolveSets(val: (RecoSetEntry[] | string)[] | undefined, presets: RecoPresets): RecoSetEntry[][] {
  if (!val) return [];
  return val.map(combo => typeof combo === 'string' ? (presets.sets[combo] ?? []) : combo);
}

function resolveSubstats(val: string | undefined, presets: RecoPresets): string | undefined {
  if (!val) return undefined;
  const key = val.startsWith('$') ? val.slice(1) : val;
  return presets.substats[key] ?? val;
}

// ── Output types ──

type GearFinderGear = { name: string; mainStats: string[] };

type GearFinderEntry = {
  characterId: string;
  buildName: string;
  weapons: GearFinderGear[];
  amulets: GearFinderGear[];
  sets: string[];
  substatPrio: string[];
};

// ── Main ──

export async function run() {
  const presets: RecoPresets = JSON.parse(await readFile(join(PATHS.reco, '_presets.json'), 'utf-8'));
  const files = (await readdir(PATHS.reco)).filter(f => f !== '_presets.json' && f.endsWith('.json'));

  const results: GearFinderEntry[] = [];

  for (const file of files) {
    const charId = file.replace('.json', '');
    const reco: CharacterReco = JSON.parse(await readFile(join(PATHS.reco, file), 'utf-8'));

    for (const [buildName, build] of Object.entries(reco)) {
      // Weapons with main stats (split "/" alternatives)
      const weaponMap = new Map<string, Set<string>>();
      if (build.Weapon) {
        for (const w of build.Weapon) {
          if (!weaponMap.has(w.name)) weaponMap.set(w.name, new Set());
          if (w.mainStat) {
            for (const s of w.mainStat.split('/')) weaponMap.get(w.name)!.add(s.trim());
          }
        }
      }

      // Amulets with main stats
      const amuletMap = new Map<string, Set<string>>();
      if (build.Amulet) {
        for (const a of build.Amulet) {
          if (!amuletMap.has(a.name)) amuletMap.set(a.name, new Set());
          if (a.mainStat) {
            for (const s of a.mainStat.split('/')) amuletMap.get(a.name)!.add(s.trim());
          }
        }
      }

      // Set names (normalize to match armor set data: add " Set" suffix)
      const sets = new Set<string>();
      const resolvedSets = resolveSets(build.Set, presets);
      for (const combo of resolvedSets) {
        for (const entry of combo) {
          const n = entry.name;
          sets.add(n.endsWith(' Set') || n.endsWith(' set') ? n : `${n} Set`);
        }
      }

      // Substat priority → ordered array
      const substatPrio: string[] = [];
      const resolvedSub = resolveSubstats(build.SubstatPrio, presets);
      if (resolvedSub) {
        for (const s of resolvedSub.split(/[>=]/)) {
          const trimmed = s.trim();
          if (trimmed) substatPrio.push(trimmed);
        }
      }

      results.push({
        characterId: charId,
        buildName,
        weapons: Array.from(weaponMap, ([name, stats]) => ({ name, mainStats: [...stats] })),
        amulets: Array.from(amuletMap, ([name, stats]) => ({ name, mainStats: [...stats] })),
        sets: [...sets],
        substatPrio,
      });
    }
  }

  const outPath = join(PATHS.generated, 'gear-finder-index.json');
  await writeFile(outPath, JSON.stringify(results, null, 2));

  return `${results.length} builds from ${files.length} characters`;
}
