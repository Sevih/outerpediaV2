import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Effect } from '@/types/effect';

const EFFECTS_DIR = join(process.cwd(), 'data/effects');

/** Get all buffs */
export async function getBuffs(): Promise<Effect[]> {
  const raw = await readFile(join(EFFECTS_DIR, 'buffs.json'), 'utf-8');
  return JSON.parse(raw) as Effect[];
}

/** Get all debuffs */
export async function getDebuffs(): Promise<Effect[]> {
  const raw = await readFile(join(EFFECTS_DIR, 'debuffs.json'), 'utf-8');
  return JSON.parse(raw) as Effect[];
}
