import { existsSync, openSync, readSync, closeSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { PATHS } from '../config';

const MANIFEST = join(PATHS.datamineBundles, 'manifest.dat');
const OUTPUT = join(PATHS.generated, 'game-version.json');

// Extract the trailing root-level `"version":"X.Y.Z"` from a (possibly large)
// `manifest.dat`. We read only the last 256 bytes — the field always sits at the
// very end of the JSON object, so this avoids parsing the multi-megabyte body.
function readTrailingVersion(path: string): string | null {
  const size = statSync(path).size;
  const window = Math.min(size, 256);
  const buf = Buffer.alloc(window);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, window, size - window);
  } finally {
    closeSync(fd);
  }
  const tail = buf.toString('utf-8');
  const m = tail.match(/"version"\s*:\s*"([^"]+)"\s*\}\s*$/);
  return m ? m[1] : null;
}

export async function run() {
  if (!existsSync(MANIFEST)) {
    return existsSync(OUTPUT) ? 'skipped (no manifest, using existing)' : 'skipped (no manifest)';
  }

  const manifestMtime = statSync(MANIFEST).mtimeMs;
  if (existsSync(OUTPUT)) {
    const outMtime = statSync(OUTPUT).mtimeMs;
    if (outMtime >= manifestMtime) return 'up to date';
  }

  const resVersion = readTrailingVersion(MANIFEST);
  if (!resVersion) {
    return existsSync(OUTPUT) ? 'skipped (parse failed, using existing)' : 'skipped (parse failed)';
  }

  const next = { resVersion };
  if (existsSync(OUTPUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUTPUT, 'utf-8')) as { resVersion?: string };
      if (prev.resVersion === resVersion) return 'up to date';
    } catch {
      // fall through to rewrite
    }
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(next, null, 2) + '\n', 'utf-8');
  return `res ${resVersion}`;
}
