import { readFile } from 'fs/promises';

/**
 * Read and parse a JSON file, tolerant of the brief window where a file appears
 * empty or half-written because a pipeline step (or a Python generator) is
 * rewriting it non-atomically. A concurrent read landing in that window would
 * otherwise throw `SyntaxError: Unexpected end of JSON input`.
 *
 * Retries a few times (with a short backoff) on empty/partial content, then
 * surfaces a clear error. Genuine read errors (e.g. ENOENT for a missing file)
 * propagate immediately, preserving the "return null on missing" behaviour of
 * the optional readers that wrap this in a try/catch.
 */
export async function readJson<T>(path: string): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = await readFile(path, 'utf-8');
    if (raw.trim().length > 0) {
      try {
        return JSON.parse(raw) as T;
      } catch (err) {
        lastErr = err; // file caught mid-rewrite — retry
      }
    }
    // Writer is likely mid-flush; back off briefly and re-read.
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
  throw new Error(
    `readJson: ${path} unreadable after retries (${lastErr instanceof Error ? lastErr.message : 'empty file'})`,
  );
}
