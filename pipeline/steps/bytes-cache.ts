import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { PATHS } from '../config';
import { bundlesChanged, saveStamp } from '../lib/bundle-stamp';

const DELETE_PREFIXES = ['BadWord'];
const STAMP = join(PATHS.generated, '.bytes-cache-stamp');

/**
 * bytes-cache pipeline step
 *
 * If bundles changed: extract .bytes with AssetStudioModCLI then parse all to JSON
 */
export async function run() {
  if (!existsSync(PATHS.datamineBundles)) {
    return 'skipped (no bundles)';
  }

  if (!bundlesChanged(STAMP, [PATHS.adminBytes, PATHS.adminJson])) {
    const count = existsSync(PATHS.adminJson)
      ? readdirSync(PATHS.adminJson).filter(f => f.endsWith('.json')).length
      : 0;
    return `up to date (${count} files)`;
  }

  if (!existsSync(PATHS.datamineCli)) {
    return 'skipped (AssetStudioModCLI not found)';
  }

  mkdirSync(PATHS.adminBytes, { recursive: true });
  mkdirSync(PATHS.adminJson, { recursive: true });

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

  // ── Parse .bytes → .json ──

  const bytesFiles = readdirSync(PATHS.adminBytes).filter(f => f.endsWith('.bytes'));
  if (bytesFiles.length === 0) {
    return 'no bytes files found';
  }

  // Lazy import — files excluded by sparse-checkout in prod
  const { parseBytes } = await import('../../src/app/admin/lib/bytes-parser');

  let parsed = 0;
  for (const file of bytesFiles) {
    try {
      const buffer = readFileSync(join(PATHS.adminBytes, file));
      const result = parseBytes(Buffer.from(buffer));
      writeFileSync(join(PATHS.adminJson, file.replace('.bytes', '.json')), JSON.stringify(result), 'utf-8');
      parsed++;
    } catch {
      // Skip files that fail to parse
    }
  }

  saveStamp(STAMP);
  return `extracted + ${parsed} parsed`;
}
