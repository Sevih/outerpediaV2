import type {
  DamageCalcCharDetail,
  DamageCalcCharBuffs,
  DamageCalcMechanicsFile,
} from '@/lib/data/damage-calc'

/**
 * Client-side fetchers for the lazy parts of the damage-calc bake.
 *
 * Page-boot data (manifest, monsters, awakening, mechanics index, transcend)
 * is loaded server-side and passed as props. The per-char detail / buffs
 * and per-monster mechanics are fetched on demand from `public/damage-calc/`,
 * which the browser caches indefinitely (filenames are versioned via the
 * pipeline rebuild — content changes only when the bake re-runs).
 *
 * In-process Map cache dedupes concurrent fetches: clicking the same char
 * twice or rapidly switching attackers won't re-issue the network request.
 */

const cache = new Map<string, Promise<unknown>>()

function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined
  if (!p) {
    // Default cache mode (`'default'`) — respects the browser's normal HTTP
    // freshness checks via ETag/Last-Modified, so a re-bake is picked up
    // on the next page load. Per-session dedupe is handled by the in-process
    // Map cache below; we don't need `'force-cache'` to skip the network on
    // repeat fetches within a session.
    p = fetch(path)
      .then(r => {
        if (!r.ok) throw new Error(`Fetch failed: ${path} (${r.status})`)
        return r.json() as Promise<T>
      })
    cache.set(path, p)
  }
  return p
}

export function fetchCharDetail(charId: string): Promise<DamageCalcCharDetail> {
  return fetchJson<DamageCalcCharDetail>(`/damage-calc/chars/${charId}.json`)
}

export function fetchCharBuffs(charId: string): Promise<DamageCalcCharBuffs> {
  return fetchJson<DamageCalcCharBuffs>(`/damage-calc/buffs/${charId}.json`)
}

export function fetchMonsterMechanics(monsterId: string): Promise<DamageCalcMechanicsFile> {
  return fetchJson<DamageCalcMechanicsFile>(`/damage-calc/mechanics/${monsterId}.json`)
}
