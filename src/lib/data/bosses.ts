import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Boss, BossIndex } from '@/types/boss';
import type { BossDisplayMap } from '@/types/equipment';

const BOSSES_DIR = join(process.cwd(), 'data/boss');
const INDEX_PATH = join(process.cwd(), 'data/generated/boss-index.json');
const GUIDE_MAP_PATH = join(process.cwd(), 'data/boss-guide-map.json');

type BossGuideMap = Record<string, string>;

/** Get a single boss by ID (stage ID = filename) */
export async function getBoss(id: string): Promise<Boss | null> {
  try {
    const raw = await readFile(join(BOSSES_DIR, `${id}.json`), 'utf-8');
    return JSON.parse(raw) as Boss;
  } catch {
    return null;
  }
}

/** Get the boss index (keyed by English boss name) */
export async function getBossIndex(): Promise<BossIndex> {
  const raw = await readFile(INDEX_PATH, 'utf-8');
  return JSON.parse(raw) as BossIndex;
}

/** Load boss-guide-map.json (cached) */
let guideMapCache: BossGuideMap | null = null;
async function loadGuideMap(): Promise<BossGuideMap> {
  if (!guideMapCache) {
    const raw = await readFile(GUIDE_MAP_PATH, 'utf-8');
    guideMapCache = JSON.parse(raw) as BossGuideMap;
  }
  return guideMapCache;
}

/**
 * Build a lightweight boss display map for equipment source rendering.
 * Takes boss stage IDs, loads each boss JSON directly for display info.
 */
export async function getBossDisplayMap(bossIds: string[]): Promise<BossDisplayMap> {
  const uniqueIds = [...new Set(bossIds)];
  const [bosses, guideMap] = await Promise.all([
    Promise.all(uniqueIds.map(id => getBoss(id))),
    loadGuideMap(),
  ]);

  const map: BossDisplayMap = {};

  for (let i = 0; i < uniqueIds.length; i++) {
    const id = uniqueIds[i];
    const boss = bosses[i];
    if (!boss) continue;

    const guideSlug = guideMap[id];
    map[id] = {
      name: boss.Name,
      icons: boss.icons,
      element: boss.element,
      source: boss.location.mode,
      ...(guideSlug && { guidePath: `/guides/${guideSlug}` }),
    };
  }

  return map;
}
