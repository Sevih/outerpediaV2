import { join } from 'path'
import { readJson } from '../_json'

/**
 * Process-level read cache for `public/damage-calc/*.json` files.
 *
 * The bake runs once per pipeline pass — files are immutable until the next
 * build. Caching the parsed result avoids re-parsing on every server render
 * and dedupes concurrent reads (multiple SSR requests targeting the same
 * char detail file share a single in-flight promise).
 *
 * Same module is reused by every reader under `src/lib/data/damage-calc/`.
 */

const PUBLIC_DAMAGE_CALC = join(process.cwd(), 'public', 'damage-calc')

const cache = new Map<string, Promise<unknown>>()

export function readDamageCalcJson<T>(relPath: string): Promise<T> {
  let p = cache.get(relPath)
  if (!p) {
    p = readJson<unknown>(join(PUBLIC_DAMAGE_CALC, relPath))
    // Don't poison the cache if a read fails (e.g. transient mid-rewrite).
    p.catch(() => cache.delete(relPath))
    cache.set(relPath, p)
  }
  return p as Promise<T>
}

/** Test/dev helper — drops the cache so a re-bake is reflected without restart. */
export function _clearDamageCalcCache(): void {
  cache.clear()
}
