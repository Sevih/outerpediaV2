import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

type EffectEntry = { name: string };
type FilterIndex = {
  buffs: Record<string, number>;
  debuffs: Record<string, number>;
  tags: Record<string, number>;
};

// Build index: keep existing IDs, assign next available for new entries
function mergeIndex(existing: Record<string, number>, names: string[]): Record<string, number> {
  const result: Record<string, number> = { ...existing };
  let maxId = Object.values(result).reduce((m, v) => Math.max(m, v), 0);

  for (const name of names) {
    if (!(name in result)) {
      result[name] = ++maxId;
    }
  }
  return result;
}

export async function run() {
  const outPath = join(PATHS.generated, 'effectsIndex.json');

  // Load existing index to preserve stable IDs
  let existing: FilterIndex = { buffs: {}, debuffs: {}, tags: {} };
  if (existsSync(outPath)) {
    const raw = JSON.parse(await readFile(outPath, 'utf-8'));
    existing = { buffs: raw.buffs ?? {}, debuffs: raw.debuffs ?? {}, tags: raw.tags ?? {} };
  }

  // Load current data
  const [buffsRaw, debuffsRaw, tagsRaw] = await Promise.all([
    readFile(join(PATHS.effects, 'buffs.json'), 'utf-8'),
    readFile(join(PATHS.effects, 'debuffs.json'), 'utf-8'),
    readFile(join(PATHS.effects, '..', 'tags.json'), 'utf-8'),
  ]);
  const buffs: EffectEntry[] = JSON.parse(buffsRaw);
  const debuffs: EffectEntry[] = JSON.parse(debuffsRaw);
  const tags: Record<string, unknown> = JSON.parse(tagsRaw);

  const index: FilterIndex = {
    buffs: mergeIndex(existing.buffs, buffs.map(b => b.name)),
    debuffs: mergeIndex(existing.debuffs, debuffs.map(d => d.name)),
    tags: mergeIndex(existing.tags, Object.keys(tags)),
  };

  await writeFile(outPath, JSON.stringify(index, null, 2));

  const newBuffs = buffs.filter(b => !(b.name in existing.buffs)).length;
  const newDebuffs = debuffs.filter(d => !(d.name in existing.debuffs)).length;
  const newTags = Object.keys(tags).filter(k => !(k in existing.tags)).length;
  console.log(`  ${Object.keys(index.buffs).length} buffs, ${Object.keys(index.debuffs).length} debuffs, ${Object.keys(index.tags).length} tags`);
  if (newBuffs || newDebuffs || newTags) {
    console.log(`  New: +${newBuffs} buffs, +${newDebuffs} debuffs, +${newTags} tags`);
  }
}
