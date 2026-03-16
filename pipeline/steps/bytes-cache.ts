import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { PATHS } from '../config';

const DELETE_PREFIXES = ['BadWord'];

/**
 * bytes-cache pipeline step
 *
 * 1. Check if bundles are newer than extracted .bytes → extract with AssetStudioModCLI
 * 2. Check if .bytes are newer than parsed .json → parse all
 */
export async function run() {
  if (!existsSync(PATHS.datamineBundles)) {
    return 'skipped (no bundles)';
  }

  mkdirSync(PATHS.adminBytes, { recursive: true });
  mkdirSync(PATHS.adminJson, { recursive: true });

  // ── Step 1: Extract .bytes from bundles if needed ──

  const needsExtract = needsExtraction();
  if (needsExtract) {
    if (!existsSync(PATHS.datamineCli)) {
      return 'skipped (AssetStudioModCLI not found)';
    }

    execFileSync(PATHS.datamineCli, [
      PATHS.datamineBundles,
      '-m', 'export',
      '-t', 'textAsset',
      '-g', 'none',
      '-r',                           // overwrite existing
      '-o', PATHS.adminBytes,
      '--log-level', 'warning',
      '--filter-by-name', 'Templet',
    ], { timeout: 300_000, stdio: 'ignore' });

    // Clean up unwanted files after extraction
    for (const f of readdirSync(PATHS.adminBytes)) {
      if (DELETE_PREFIXES.some(p => f.startsWith(p))) {
        unlinkSync(join(PATHS.adminBytes, f));
      }
    }
  }

  // ── Step 2: Parse .bytes → .json if needed ──

  const bytesFiles = readdirSync(PATHS.adminBytes)
    .filter(f => f.endsWith('.bytes'));

  if (bytesFiles.length === 0) {
    return 'no bytes files found';
  }

  if (!needsExtract && !needsParsing(bytesFiles)) {
    return `up to date (${bytesFiles.length} files)`;
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

  return `${needsExtract ? 'extracted + ' : ''}${parsed} parsed`;
}

/** Check if bundles are newer than the oldest .bytes file */
function needsExtraction(): boolean {
  const bytesFiles = existsSync(PATHS.adminBytes)
    ? readdirSync(PATHS.adminBytes).filter(f => f.endsWith('.bytes'))
    : [];

  if (bytesFiles.length === 0) return true;

  // Get most recent bundle mtime
  const bundleFiles = readdirSync(PATHS.datamineBundles).filter(f => !f.endsWith('.crc'));
  if (bundleFiles.length === 0) return false;

  let latestBundle = 0;
  for (const f of bundleFiles) {
    const mtime = statSync(join(PATHS.datamineBundles, f)).mtimeMs;
    if (mtime > latestBundle) latestBundle = mtime;
  }

  // Get oldest .bytes mtime
  let oldestBytes = Infinity;
  for (const f of bytesFiles) {
    const mtime = statSync(join(PATHS.adminBytes, f)).mtimeMs;
    if (mtime < oldestBytes) oldestBytes = mtime;
  }

  return latestBundle > oldestBytes;
}

/** Check if .bytes are newer than the oldest .json file */
function needsParsing(bytesFiles: string[]): boolean {
  const jsonFiles = existsSync(PATHS.adminJson)
    ? readdirSync(PATHS.adminJson).filter(f => f.endsWith('.json'))
    : [];

  if (jsonFiles.length < bytesFiles.length) return true;

  // Get most recent .bytes mtime
  let latestBytes = 0;
  for (const f of bytesFiles) {
    const mtime = statSync(join(PATHS.adminBytes, f)).mtimeMs;
    if (mtime > latestBytes) latestBytes = mtime;
  }

  // Get oldest .json mtime
  let oldestJson = Infinity;
  for (const f of jsonFiles) {
    const mtime = statSync(join(PATHS.adminJson, f)).mtimeMs;
    if (mtime < oldestJson) oldestJson = mtime;
  }

  return latestBytes > oldestJson;
}
