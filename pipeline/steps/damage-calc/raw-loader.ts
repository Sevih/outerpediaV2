import { readFile } from 'fs/promises'
import { join } from 'path'
import { INPUTS } from './shared'

/**
 * Lazy, deduplicated loader for raw `data/admin/json2/*.json` templets.
 * Several builders (chars, buffs, monsters…) need the same source files —
 * caching here ensures each templet is parsed once per pipeline run, even
 * when builders are added or reordered.
 */

type Row = Record<string, string | undefined>

const cache = new Map<string, Promise<unknown>>()

export function loadJson2<T = Row[]>(file: string): Promise<T> {
  let p = cache.get(file)
  if (!p) {
    p = readFile(join(INPUTS.json2, file), 'utf-8').then(s => JSON.parse(s))
    cache.set(file, p)
  }
  return p as Promise<T>
}

/**
 * Read a single file from `data/generated/` (pipeline outputs from earlier
 * steps — characters-index, character-stats, etc.). Same dedup contract.
 */
export function loadGenerated<T = unknown>(file: string): Promise<T> {
  const key = `__gen__/${file}`
  let p = cache.get(key)
  if (!p) {
    p = readFile(join(INPUTS.generated, file), 'utf-8').then(s => JSON.parse(s))
    cache.set(key, p)
  }
  return p as Promise<T>
}
