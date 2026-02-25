import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { PATHS } from '../config';

type LangMap = Partial<Record<string, string>>;

type GuideBossMapEntry = {
  boss_id: string;
  name: LangMap;
  surname?: LangMap;
  icons: string;
  element: string;
  class: string;
};

export async function run() {
  const adventureDir = join(PATHS.guidesContent, 'adventure');

  if (!existsSync(adventureDir)) {
    return 'no adventure content directory';
  }

  const slugDirs = (await readdir(adventureDir, { withFileTypes: true }))
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const map: Record<string, GuideBossMapEntry> = {};
  let matched = 0;

  for (const slug of slugDirs) {
    const indexPath = join(adventureDir, slug, 'index.tsx');
    if (!existsSync(indexPath)) continue;

    const content = await readFile(indexPath, 'utf-8');

    // Extract defaultBossId="XXXXX" from <BossDisplay>
    const bossIdMatch = content.match(/defaultBossId\s*=\s*"(\d+)"/);
    if (!bossIdMatch) continue;

    const bossId = bossIdMatch[1];
    const bossPath = join(PATHS.bosses, `${bossId}.json`);
    if (!existsSync(bossPath)) continue;

    const boss = JSON.parse(await readFile(bossPath, 'utf-8'));

    const entry: GuideBossMapEntry = {
      boss_id: bossId,
      name: boss.Name,
      icons: boss.icons,
      element: boss.element,
      class: boss.class,
    };

    if (boss.IncludeSurname && boss.Surname) {
      entry.surname = boss.Surname;
    }

    map[slug] = entry;
    matched++;
  }

  const outPath = join(PATHS.generated, 'guide-boss-map.json');
  await writeFile(outPath, JSON.stringify(map, null, 2));

  return `${matched} boss mappings from ${slugDirs.length} adventure guides`;
}
