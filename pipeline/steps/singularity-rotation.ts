import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { PATHS } from '../config';

const SCRIPT = join(__dirname, '../../scripts/generate-singularity-rotation.py');
const OUTPUT = join(PATHS.generated, 'singularity-rotation.json');
const STAMP = join(PATHS.generated, '.singularity-rotation-stamp');

const REQUIRED_INPUTS = ['SingularityTemplet', 'SingularityDungeonGroupTemplet'];

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

  // Up-to-date check — also rebuild once per UTC day so the dated rotation window slides
  const todayKey = new Date().toISOString().slice(0, 10);
  if (existsSync(STAMP) && existsSync(OUTPUT)) {
    const [savedMtimeRaw, savedDay] = readFileSync(STAMP, 'utf-8').trim().split('|');
    const savedMtime = Number(savedMtimeRaw);
    if (savedMtime >= latest && savedDay === todayKey) {
      return 'up to date';
    }
  }

  execFileSync('python', [SCRIPT], { timeout: 60_000, stdio: 'ignore' });

  if (!existsSync(OUTPUT)) {
    return 'skipped (no output)';
  }

  mkdirSync(dirname(STAMP), { recursive: true });
  writeFileSync(STAMP, `${latest}|${todayKey}`, 'utf-8');
  return 'regenerated';
}
