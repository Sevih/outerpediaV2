import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';

type EffectEntry = {
  name: string;
  group?: string;
};

export async function run() {
  const [buffsRaw, debuffsRaw] = await Promise.all([
    readFile(join(PATHS.effects, 'buffs.json'), 'utf-8'),
    readFile(join(PATHS.effects, 'debuffs.json'), 'utf-8'),
  ]);

  const buffs: EffectEntry[] = JSON.parse(buffsRaw);
  const debuffs: EffectEntry[] = JSON.parse(debuffsRaw);

  const groupMap: Record<string, string> = {};
  for (const effect of [...buffs, ...debuffs]) {
    if (effect.group) groupMap[effect.name] = effect.group;
  }

  const outPath = join(PATHS.generated, 'effect-group-map.json');
  await writeFile(outPath, JSON.stringify(groupMap, null, 2));

  console.log(`  Generated ${Object.keys(groupMap).length} effect group mappings → ${outPath}`);
}
