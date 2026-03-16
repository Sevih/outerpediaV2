import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { PATHS } from '../config';

/**
 * Get the mtime of the most recent bundle file.
 * Returns 0 if no bundles exist.
 */
export function getLatestBundleMtime(): number {
  if (!existsSync(PATHS.datamineBundles)) return 0;

  const files = readdirSync(PATHS.datamineBundles).filter(f => !f.endsWith('.crc'));
  if (files.length === 0) return 0;

  let latest = 0;
  for (const f of files) {
    const mtime = statSync(join(PATHS.datamineBundles, f)).mtimeMs;
    if (mtime > latest) latest = mtime;
  }
  return latest;
}

/**
 * Check if a step needs to run by comparing latest bundle mtime
 * against a saved stamp file, and verifying output dirs exist and are non-empty.
 *
 * @param stampPath Path to the stamp file for this step
 * @param outputDirs Directories that must exist and be non-empty for the step to be considered up to date
 * @returns true if bundles are newer than the stamp, stamp doesn't exist, or any output dir is missing/empty
 */
export function bundlesChanged(stampPath: string, outputDirs?: string[]): boolean {
  const latest = getLatestBundleMtime();
  if (latest === 0) return false; // no bundles → nothing to do

  if (!existsSync(stampPath)) return true;

  // Check output dirs exist and are non-empty
  if (outputDirs) {
    for (const dir of outputDirs) {
      if (!existsSync(dir)) return true;
      const entries = readdirSync(dir).filter(f => !f.startsWith('.'));
      if (entries.length === 0) return true;
    }
  }

  const saved = Number(readFileSync(stampPath, 'utf-8').trim());
  return latest > saved;
}

/**
 * Save the current latest bundle mtime to a stamp file.
 */
export function saveStamp(stampPath: string): void {
  const latest = getLatestBundleMtime();
  mkdirSync(dirname(stampPath), { recursive: true });
  writeFileSync(stampPath, String(latest), 'utf-8');
}
