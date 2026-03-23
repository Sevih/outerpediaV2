import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

const OUTPUT = join(PATHS.generated, 'cf-skill-names.json');

const SKILL_KEYS = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const;
const LANGS = ['', '_jp', '_kr', '_zh'] as const;

/**
 * Generates a mapping of CF char ID → skill names (base + CF),
 * so the CF guide can display localized skill name changes
 * without importing full character JSONs client-side.
 *
 * Output shape:
 * {
 *   "2700037": {
 *     "s1": { "old": "Battlefield Commander", "old_jp": "…", "new": "Resolute Command", "new_jp": "…" },
 *     "s2": { ... },
 *     "s3": { ... }
 *   }
 * }
 */
export async function run() {
  const charDir = PATHS.characters;
  const files = readdirSync(charDir).filter(f => f.endsWith('.json'));

  // Load all character data keyed by ID
  const chars: Record<string, Record<string, unknown>> = {};
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(charDir, f), 'utf-8'));
    if (data.ID) chars[data.ID] = data;
  }

  const result: Record<string, Record<string, Record<string, string>>> = {};

  // Find all CF characters (ID starts with 2700)
  for (const [id, char] of Object.entries(chars)) {
    if (!id.startsWith('2700')) continue;

    const baseId = id.replace('2700', '2000');
    const baseChar = chars[baseId];
    if (!baseChar) continue;

    const skills = char.skills as Record<string, Record<string, string>> | undefined;
    const baseSkills = baseChar.skills as Record<string, Record<string, string>> | undefined;
    if (!skills || !baseSkills) continue;

    const mapping: Record<string, Record<string, string>> = {};
    const keyMap = { SKT_FIRST: 's1', SKT_SECOND: 's2', SKT_ULTIMATE: 's3' } as const;

    for (const sktKey of SKILL_KEYS) {
      const label = keyMap[sktKey];
      const baseSkill = baseSkills[sktKey];
      const cfSkill = skills[sktKey];
      if (!baseSkill || !cfSkill) continue;

      const entry: Record<string, string> = {};
      for (const suffix of LANGS) {
        const key = `name${suffix}`;
        entry[`old${suffix}`] = baseSkill[key] ?? '';
        entry[`new${suffix}`] = cfSkill[key] ?? '';
      }
      mapping[label] = entry;
    }

    if (Object.keys(mapping).length > 0) {
      result[id] = mapping;
    }
  }

  const content = JSON.stringify(result, null, 2);

  if (existsSync(OUTPUT)) {
    const existing = readFileSync(OUTPUT, 'utf-8');
    if (existing.trim() === content.trim()) {
      return `skipped (up to date, ${Object.keys(result).length} CF heroes)`;
    }
  }

  writeFileSync(OUTPUT, content, 'utf-8');
  return `${Object.keys(result).length} CF heroes`;
}
