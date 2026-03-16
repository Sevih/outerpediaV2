import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cpus } from 'os';
import { PATHS } from '../config';
import { bundlesChanged, saveStamp } from '../lib/bundle-stamp';

const STAMP = join(PATHS.generated, '.extract-assets-stamp');

/**
 * extract-assets pipeline step
 *
 * Extracts sprite + tex2d from bundles into extracted_astudio
 * (textAsset is handled separately by bytes-cache)
 */
export async function run() {
  if (!existsSync(PATHS.datamineBundles)) {
    return 'skipped (no bundles)';
  }

  if (!existsSync(PATHS.datamineCli)) {
    return 'skipped (AssetStudioModCLI not found)';
  }

  if (!bundlesChanged(STAMP, [PATHS.extractedAssets])) {
    return 'up to date';
  }

  mkdirSync(PATHS.extractedAssets, { recursive: true });

  const cpuCount = cpus().length;
  const maxTasks = Math.min(Math.max(cpuCount - 4, 1), 16);

  execFileSync(PATHS.datamineCli, [
    PATHS.datamineBundles,
    '-m', 'export',
    '-t', 'sprite,tex2d',
    '-g', 'containerFull',
    '-r',
    '-o', PATHS.extractedAssets,
    '--max-export-tasks', String(maxTasks),
    '--log-level', 'warning',
    '--filter-by-container', 'assets/editor/resources/(sprite|texture|prefabs/ui)|assets/art/ui/',
    '--filter-by-name', '^(?!T_FX_)',
    '--filter-with-regex',
  ], { timeout: 600_000, stdio: 'ignore' });

  saveStamp(STAMP);
  return 'extracted';
}
