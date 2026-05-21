import { join } from 'path';
import { readJson } from './_json';
import type { Effect, SkillBuffData } from '@/types/effect';

const EFFECTS_DIR = join(process.cwd(), 'data/effects');
const SKILL_BUFFS_PATH = join(process.cwd(), 'data/generated/skill-buffs.json');

/** Get all buffs */
export async function getBuffs(): Promise<Effect[]> {
  return readJson<Effect[]>(join(EFFECTS_DIR, 'buffs.json'));
}

/** Get all debuffs */
export async function getDebuffs(): Promise<Effect[]> {
  return readJson<Effect[]>(join(EFFECTS_DIR, 'debuffs.json'));
}

/** Get skill-level buff/debuff data with targeting info */
export async function getSkillBuffs(): Promise<Record<string, SkillBuffData>> {
  return readJson<Record<string, SkillBuffData>>(SKILL_BUFFS_PATH);
}
