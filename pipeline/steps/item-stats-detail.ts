import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { PATHS } from '../config';

const SCRIPT = join(__dirname, '../../scripts/generate-item-stats-detail.py');
const OUTPUT = join(PATHS.equipment, 'item-stats-detail.json');
const STAMP = join(PATHS.generated, '.item-stats-detail-stamp');

// json2 datamine inputs (all required — bail if any is missing)
const REQUIRED_INPUTS = [
  'ItemTemplet',
  'ItemOptionTemplet',
  'ItemEnchantTemplet',
  'ItemBreakLimitTemplet',
  'SingularityEquipEnchantTemplet',
  'BuffTemplet',
];

// Curated equipment files cross-referenced by the script — all required. item-names.json
// is itself produced by the `item-names` step, so this step must run after it.
const REQUIRED_EQUIP = ['weapon', 'accessory', 'talisman', 'sets', 'item-names'];

function latestInputMtime(): number {
  let latest = 0;
  for (const name of REQUIRED_INPUTS) {
    const p = join(PATHS.adminJson2, `${name}.json`);
    if (!existsSync(p)) return 0;
    const m = statSync(p).mtimeMs;
    if (m > latest) latest = m;
  }
  for (const name of REQUIRED_EQUIP) {
    const p = join(PATHS.equipment, `${name}.json`);
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
