import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Boss, BossIndex, BossIndexEntry } from '@/types/boss';
import type { BossDisplayInfo, BossDisplayMap } from '@/types/equipment';

const BOSSES_DIR = join(process.cwd(), 'data/boss');
const INDEX_PATH = join(process.cwd(), 'data/generated/boss-index.json');

/** Get a single boss by ID */
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

/** Find the equipment-relevant mode (Special Request or Pursuit Operation) */
const EQUIP_MODE_PREFIXES = ['Special Request', 'Pursuit Operation'];

function findEquipmentMode(entry: BossIndexEntry) {
  for (const prefix of EQUIP_MODE_PREFIXES) {
    for (const [key, mode] of Object.entries(entry.modes)) {
      if (key.startsWith(prefix)) return mode.name;
    }
  }
  return {};
}

function buildDisplayInfo(entry: BossIndexEntry): BossDisplayInfo {
  return {
    name: entry.name,
    icons: entry.icons,
    element: entry.element,
    source: findEquipmentMode(entry),
  };
}

/**
 * Build a lightweight boss display map for equipment source rendering.
 * Handles combined boss names like "Dek'Ril & Mek'Ril" by looking up the first part.
 */
export async function getBossDisplayMap(bossNames: string[]): Promise<BossDisplayMap> {
  const index = await getBossIndex();
  const map: BossDisplayMap = {};

  for (const name of bossNames) {
    if (map[name]) continue;

    // Direct match
    if (index[name]) {
      map[name] = buildDisplayInfo(index[name]);
      continue;
    }

    // Handle combined names like "Dek'Ril & Mek'Ril"
    const parts = name.split(' & ');
    if (parts.length > 1 && index[parts[0]]) {
      map[name] = buildDisplayInfo(index[parts[0]]);
    }
  }

  return map;
}
