import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Effect, SkillBuffData } from '@/types/effect';

const EFFECTS_DIR = join(process.cwd(), 'data/effects');
const SKILL_BUFFS_PATH = join(process.cwd(), 'data/generated/skill-buffs.json');

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

/** Get skill-level buff/debuff data with targeting info */
export async function getSkillBuffs(): Promise<Record<string, SkillBuffData>> {
  const raw = await readFile(SKILL_BUFFS_PATH, 'utf-8');
  return JSON.parse(raw) as Record<string, SkillBuffData>;
}
