import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { PATHS } from '../config';

const SCRIPT = join(__dirname, '../../scripts/generate-stat-ranges-v2.py');
const OUTPUT = join(PATHS.equipment, 'stat-ranges-v2.json');
const STAMP = join(PATHS.generated, '.stat-ranges-v2-stamp');

const REQUIRED_INPUTS = [
  'ItemTemplet',
  'ItemOptionTemplet',
  'ItemEnchantTemplet',
  'ItemBreakLimitTemplet',
  'SingularityEquipEnchantTemplet',
];

function latestInputMtime(): number {
  let latest = 0;
  for (const name of REQUIRED_INPUTS) {
    const p = join(PATHS.adminJson2, `${name}.json`);
    if (!existsSync(p)) return 0;
    const m = statSync(p).mtimeMs;
    if (m > latest) latest = m;
  }
  return latest;
}

export async function run() {
  if (!existsSync(SCRIPT)) {
    return 'skipped (script missing)';
  }

  if (!existsSync(PATHS.adminJson2)) {
    return existsSync(OUTPUT) ? 'skipped (no json2, using existing)' : 'skipped (no json2)';
  }

  const latest = latestInputMtime();
  if (latest === 0) {
    return existsSync(OUTPUT) ? 'skipped (missing inputs, using existing)' : 'skipped (missing inputs)';
  }

  if (existsSync(STAMP) && existsSync(OUTPUT)) {
    // Stamp format: `<mtime>|<ISO>` — split off the leading mtime (back-compat
    // with legacy mtime-only stamps, where split('|')[0] is the whole string).
    const saved = Number(readFileSync(STAMP, 'utf-8').split('|')[0]);
    if (saved >= latest) {
      return 'up to date';
    }
  }

  execFileSync('python', [SCRIPT], { timeout: 60_000, stdio: 'ignore' });

  if (!existsSync(OUTPUT)) {
    return 'skipped (no output)';
  }

  mkdirSync(dirname(STAMP), { recursive: true });
  // Provenance (generation time) lives here in the gitignored stamp, not inside
  // the committed JSON — keeps the artifact diff-free across rebuilds.
  writeFileSync(STAMP, `${latest}|${new Date().toISOString()}`, 'utf-8');
  return 'regenerated';
}
