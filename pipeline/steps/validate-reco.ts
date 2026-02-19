import { readFile, readdir } from 'fs/promises';
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
  Note?: string;
};
type RecoPresets = {
  talismans: Record<string, string[]>;
  sets: Record<string, RecoSetEntry[]>;
};

export async function run() {
  // Load equipment reference data
  const [weaponsRaw, amuletsRaw, talismansRaw, setsRaw, presetsRaw] = await Promise.all([
    readFile(join(PATHS.equipment, 'weapon.json'), 'utf-8'),
    readFile(join(PATHS.equipment, 'accessory.json'), 'utf-8'),
    readFile(join(PATHS.equipment, 'talisman.json'), 'utf-8'),
    readFile(join(PATHS.equipment, 'sets.json'), 'utf-8'),
    readFile(join(PATHS.reco, '_presets.json'), 'utf-8'),
  ]);

  const weaponNames = new Set((JSON.parse(weaponsRaw) as { name: string }[]).map(w => w.name));
  const amuletNames = new Set((JSON.parse(amuletsRaw) as { name: string }[]).map(a => a.name));
  const talismanNames = new Set((JSON.parse(talismansRaw) as { name: string }[]).map(t => t.name));
  const setNames = new Set((JSON.parse(setsRaw) as { name: string }[]).map(s => s.name));
  // Also accept short names without " Set" suffix (used in reco files)
  const setShortNames = new Set(
    (JSON.parse(setsRaw) as { name: string }[]).map(s => s.name.replace(/ Set$/, ''))
  );
  const presets: RecoPresets = JSON.parse(presetsRaw);

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
          }
        }
      }

      // Validate amulets
      if (build.Amulet) {
        for (const a of build.Amulet) {
          if (!amuletNames.has(a.name)) {
            console.warn(`  WARN ${ctx} Unknown amulet: "${a.name}"`);
            errorCount++;
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
