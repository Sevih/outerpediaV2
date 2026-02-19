import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';

type EquipItem = { name: string; mainStats: string[] | null };
type RecoGearEntry = { name: string; mainStat?: string };
type RecoSetEntry = { name: string; count: number };
type RecoBuild = {
  Weapon?: RecoGearEntry[];
  Amulet?: RecoGearEntry[];
  Set?: (RecoSetEntry[] | string)[];
  Talisman?: string[] | string;
  SubstatPrio?: string;
  Note?: string;
};
type RecoPresets = {
  talismans: Record<string, string[]>;
  sets: Record<string, RecoSetEntry[]>;
  substats: Record<string, string>;
};

export async function run() {
  // Load equipment reference data + stats
  const [weaponsRaw, amuletsRaw, talismansRaw, setsRaw, presetsRaw, statsRaw] = await Promise.all([
    readFile(join(PATHS.equipment, 'weapon.json'), 'utf-8'),
    readFile(join(PATHS.equipment, 'accessory.json'), 'utf-8'),
    readFile(join(PATHS.equipment, 'talisman.json'), 'utf-8'),
    readFile(join(PATHS.equipment, 'sets.json'), 'utf-8'),
    readFile(join(PATHS.reco, '_presets.json'), 'utf-8'),
    readFile(join(process.cwd(), 'data/stats.json'), 'utf-8'),
  ]);

  const weapons = JSON.parse(weaponsRaw) as EquipItem[];
  const amulets = JSON.parse(amuletsRaw) as EquipItem[];
  const weaponNames = new Set(weapons.map(w => w.name));
  const amuletNames = new Set(amulets.map(a => a.name));
  const weaponMap = new Map(weapons.map(w => [w.name, w]));
  const amuletMap = new Map(amulets.map(a => [a.name, a]));
  const talismanNames = new Set((JSON.parse(talismansRaw) as { name: string }[]).map(t => t.name));
  const setNames = new Set((JSON.parse(setsRaw) as { name: string }[]).map(s => s.name));
  // Also accept short names without " Set" suffix (used in reco files)
  const setShortNames = new Set(
    (JSON.parse(setsRaw) as { name: string }[]).map(s => s.name.replace(/ Set$/, ''))
  );
  const presets: RecoPresets = JSON.parse(presetsRaw);
  const validStats = new Set(Object.keys(JSON.parse(statsRaw) as Record<string, unknown>));

  // Load reco files
  const files = (await readdir(PATHS.reco)).filter(f => f.endsWith('.json') && f !== '_presets.json');

  let errorCount = 0;
  let fileCount = 0;

  for (const file of files) {
    const filePath = join(PATHS.reco, file);
    let data: Record<string, RecoBuild>;
    try {
      data = JSON.parse(await readFile(filePath, 'utf-8'));
    } catch {
      console.error(`  ERROR [${file}] Invalid JSON`);
      errorCount++;
      continue;
    }

    fileCount++;

    for (const [buildName, build] of Object.entries(data)) {
      const ctx = `[${file} → ${buildName}]`;

      // Validate weapons
      if (build.Weapon) {
        for (const w of build.Weapon) {
          if (!weaponNames.has(w.name)) {
            console.warn(`  WARN ${ctx} Unknown weapon: "${w.name}"`);
            errorCount++;
          } else if (w.mainStat) {
            const item = weaponMap.get(w.name);
            if (item?.mainStats) {
              for (const s of w.mainStat.split('/')) {
                if (!item.mainStats.includes(s)) {
                  console.warn(`  WARN ${ctx} Weapon "${w.name}" has no mainStat "${s}" (valid: ${item.mainStats.join(', ')})`);
                  errorCount++;
                }
              }
            }
          }
        }
      }

      // Validate amulets
      if (build.Amulet) {
        for (const a of build.Amulet) {
          if (!amuletNames.has(a.name)) {
            console.warn(`  WARN ${ctx} Unknown amulet: "${a.name}"`);
            errorCount++;
          } else if (a.mainStat) {
            const item = amuletMap.get(a.name);
            if (item?.mainStats) {
              for (const s of a.mainStat.split('/')) {
                if (!item.mainStats.includes(s)) {
                  console.warn(`  WARN ${ctx} Amulet "${a.name}" has no mainStat "${s}" (valid: ${item.mainStats.join(', ')})`);
                  errorCount++;
                }
              }
            }
          }
        }
      }

      // Validate SubstatPrio (supports > and = separators, or preset ref)
      if (build.SubstatPrio) {
        const prio = build.SubstatPrio.startsWith('$')
          ? presets.substats?.[build.SubstatPrio.slice(1)]
          : presets.substats?.[build.SubstatPrio] ?? build.SubstatPrio;

        if (!prio) {
          console.warn(`  WARN ${ctx} Unknown SubstatPrio preset: "${build.SubstatPrio}"`);
          errorCount++;
        } else {
          for (const s of prio.split(/[>=]/)) {
            const stat = s.trim();
            if (stat && !validStats.has(stat)) {
              console.warn(`  WARN ${ctx} Unknown stat in SubstatPrio: "${stat}"`);
              errorCount++;
            }
          }
        }
      }

      // Validate talismans
      if (build.Talisman) {
        const tals = typeof build.Talisman === 'string'
          ? (build.Talisman.startsWith('$')
              ? presets.talismans[build.Talisman.slice(1)]
              : presets.talismans[build.Talisman])
          : build.Talisman;

        if (!tals) {
          console.warn(`  WARN ${ctx} Unknown talisman preset: "${build.Talisman}"`);
          errorCount++;
        } else {
          for (const name of tals) {
            if (!talismanNames.has(name)) {
              console.warn(`  WARN ${ctx} Unknown talisman: "${name}"`);
              errorCount++;
            }
          }
        }
      }

      // Validate sets
      if (build.Set) {
        for (const combo of build.Set) {
          if (typeof combo === 'string') {
            if (!presets.sets[combo]) {
              console.warn(`  WARN ${ctx} Unknown set preset: "${combo}"`);
              errorCount++;
            }
          } else {
            for (const piece of combo) {
              if (!setNames.has(piece.name) && !setShortNames.has(piece.name)) {
                console.warn(`  WARN ${ctx} Unknown set: "${piece.name}"`);
                errorCount++;
              }
            }
          }
        }
      }
    }
  }

  if (errorCount > 0) {
    throw new Error(`${errorCount} issue(s) in ${fileCount} files`);
  }

  return `${fileCount} files, all references valid`;
}
