import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { PATHS } from '../config';

const SCRIPT = join(__dirname, '../../scripts/generate-ascension-view.py');
const SOURCE = join(PATHS.generated, 'singularity-ascension.json');
const OUTPUT = join(PATHS.equipment, 'ascension-view.json');
const STAMP = join(PATHS.generated, '.ascension-view-stamp');

export async function run() {
  if (!existsSync(SCRIPT)) {
    return 'skipped (script missing)';
  }

  // Upstream gate — ascension-view is a derived view of singularity-ascension.json,
  // which itself only refreshes when the json2 datamine is present. Mirror the same
  // skip behaviour so prod builds (no json2) reuse the committed output cleanly.
  if (!existsSync(PATHS.adminJson2)) {
    return existsSync(OUTPUT) ? 'skipped (no json2, using existing)' : 'skipped (no json2)';
  }

  if (!existsSync(SOURCE)) {
    return existsSync(OUTPUT) ? 'skipped (no source, using existing)' : 'skipped (no source)';
  }

  const latest = statSync(SOURCE).mtimeMs;

  if (existsSync(STAMP) && existsSync(OUTPUT)) {
    const saved = Number(readFileSync(STAMP, 'utf-8').trim());
    if (saved >= latest) {
      return 'up to date';
    }
  }

  execFileSync('python', [SCRIPT], { timeout: 60_000, stdio: 'ignore' });

  if (!existsSync(OUTPUT)) {
    return 'skipped (no output)';
  }

  mkdirSync(dirname(STAMP), { recursive: true });
  writeFileSync(STAMP, String(latest), 'utf-8');
  return 'regenerated';
}
