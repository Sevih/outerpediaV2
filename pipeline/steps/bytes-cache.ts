import { readdirSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { PATHS } from '../config';
import { bundlesChanged, saveStamp } from '../lib/bundle-stamp';

const DELETE_PREFIXES = ['BadWord'];
const STAMP = join(PATHS.generated, '.bytes-cache-stamp');

/**
 * bytes-cache pipeline step
 *
 * If bundles changed: extract .bytes with AssetStudioModCLI then parse all to JSON (json2 format)
 */
export async function run() {
  if (!existsSync(PATHS.datamineBundles)) {
    return 'skipped (no bundles)';
  }

  if (!bundlesChanged(STAMP, [PATHS.adminBytes, PATHS.adminJson2])) {
    const count = existsSync(PATHS.adminJson2)
      ? readdirSync(PATHS.adminJson2).filter(f => f.endsWith('.json')).length
      : 0;
    return `up to date (${count} files)`;
  }

  if (!existsSync(PATHS.datamineCli)) {
    return 'skipped (AssetStudioModCLI not found)';
  }

  mkdirSync(PATHS.adminBytes, { recursive: true });
  mkdirSync(PATHS.adminJson2, { recursive: true });

  // ── Extract .bytes from bundles ──

  execFileSync(PATHS.datamineCli, [
    PATHS.datamineBundles,
    '-m', 'export',
    '-t', 'textAsset',
    '-g', 'none',
    '-r',
    '-o', PATHS.adminBytes,
    '--log-level', 'warning',
    '--filter-by-name', 'Templet|^Text',
    '--filter-with-regex',
  ], { timeout: 300_000, stdio: 'ignore' });

  // Clean up unwanted files
  for (const f of readdirSync(PATHS.adminBytes)) {
    if (DELETE_PREFIXES.some(p => f.startsWith(p))) {
      unlinkSync(join(PATHS.adminBytes, f));
    }
  }

  const bytesFiles = readdirSync(PATHS.adminBytes).filter(f => f.endsWith('.bytes'));
  if (bytesFiles.length === 0) {
    return 'no bytes files found';
  }

  // ── Parse .bytes → .json via Python (json2) ──

  const convertScript = join(__dirname, '../../scripts/convert_bytes.py');
  if (existsSync(convertScript)) {
    execFileSync('python', [convertScript, PATHS.adminBytes, PATHS.adminJson2], { timeout: 120_000, stdio: 'ignore' });
  }

  // ── Generate skill-buffs.json ──

  const skillBuffsScript = join(__dirname, '../../scripts/generate-skill-buffs.py');
  if (existsSync(skillBuffsScript)) {
    execFileSync('python', [skillBuffsScript], { timeout: 60_000, stdio: 'ignore' });
  }

  saveStamp(STAMP);
  const parsed = readdirSync(PATHS.adminJson2).filter(f => f.endsWith('.json')).length;
  return `extracted + ${parsed} parsed`;
}
