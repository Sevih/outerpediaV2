import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Boss, BossIndexEntry } from '@/types/boss';

const BOSSES_DIR = join(process.cwd(), 'data/game/bosses');
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

/** Get the boss index */
export async function getBossIndex(): Promise<BossIndexEntry[]> {
  const raw = await readFile(INDEX_PATH, 'utf-8');
  return JSON.parse(raw) as BossIndexEntry[];
}
