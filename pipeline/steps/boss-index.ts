import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';
import type { Boss, BossIndex } from '../../src/types/boss';

/**
 * Extract stage number from dungeon name
 * e.g. "Blazing Knight (Stage 13)" -> 13
 */
function extractStageNumber(dungeonName: string): number | null {
  const match = dungeonName.match(/Stage\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract difficulty priority from dungeon name
 * Extreme (4) > Very Hard (3) > Hard (2) > Normal (1) > None (0)
 */
function extractDifficultyPriority(dungeonName: string): number {
  if (/Extreme/i.test(dungeonName)) return 4;
  if (/Very Hard/i.test(dungeonName)) return 3;
  if (/Hard/i.test(dungeonName)) return 2;
  if (/Normal/i.test(dungeonName)) return 1;
  return 0;
}

export async function run() {
  const files = await readdir(PATHS.bosses);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');

  // Load all boss data
  const allBosses = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await readFile(join(PATHS.bosses, file), 'utf-8');
      return JSON.parse(raw) as Boss;
    })
  );

  // Group by English boss name -> English mode name -> versions
  const index: BossIndex = {};

  for (const boss of allBosses) {
    const bossName = boss.Name.en!;
    const modeKey = boss.location.mode.en!;

    if (!index[bossName]) {
      index[bossName] = {
        name: boss.Name,
        element: boss.element,
        class: boss.class,
        icons: boss.icons,
        modes: {},
      };
    }

    if (!index[bossName].modes[modeKey]) {
      index[bossName].modes[modeKey] = {
        name: boss.location.mode,
        versions: [],
      };
    }

    index[bossName].modes[modeKey].versions.push({
      id: boss.id,
      label: boss.location.dungeon,
      level: boss.level,
    });
  }

  // Sort versions within each mode: by stage desc, then difficulty desc
  for (const entry of Object.values(index)) {
    for (const mode of Object.values(entry.modes)) {
      mode.versions.sort((a, b) => {
        const stageA = extractStageNumber(a.label.en!);
        const stageB = extractStageNumber(b.label.en!);

        if (stageA !== null && stageB !== null) return stageB - stageA;
        if (stageA !== null) return -1;
        if (stageB !== null) return 1;

        return extractDifficultyPriority(b.label.en!) - extractDifficultyPriority(a.label.en!);
      });
    }
  }

  const outputPath = join(PATHS.generated, 'boss-index.json');
  await writeFile(outputPath, JSON.stringify(index, null, 2));

  const bossCount = Object.keys(index).length;
  const totalVersions = allBosses.length;
  return `${bossCount} bosses, ${totalVersions} versions`;
}
