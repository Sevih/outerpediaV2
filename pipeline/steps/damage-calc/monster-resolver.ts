/**
 * Synthetic-id → real `MonsterTemplet.ID` resolver.
 *
 * Curated boss files in `data/boss/` use composite IDs that don't all map
 * 1:1 to `MonsterTemplet.ID` — multi-phase encounters get a phase suffix
 * and "mob-S-boss" composites use an `S` join. Stripping these gets us
 * back to the canonical templet row.
 *
 * Patterns observed (PR survey + manual inspection):
 *   `4014006-1`           → phase suffix       → strip "-1"      → `4014006`
 *   `440400079-B-1`       → form + phase       → strip "-B-1"    → `440400079`
 *   `51100002-0`          → wave index         → strip "-0"      → `51100002`
 *   `404400450S404400350` → composite (mob `S` boss) → take part before "S"
 *
 * Order matters: the suffix strip runs before the composite split. A real
 * `S` inside an ID with hyphens hasn't been observed but the strip is the
 * safer first attempt.
 */

export function resolveMonsterId<T>(rawId: string, index: Map<string, T>): T | null {
  const direct = index.get(rawId)
  if (direct) return direct

  const stripped = rawId.replace(/-[A-Z0-9]+(?:-\d+)?$/, '')
  if (stripped !== rawId) {
    const hit = index.get(stripped)
    if (hit) return hit
  }

  const sIdx = rawId.indexOf('S')
  if (sIdx > 0) {
    const first = rawId.slice(0, sIdx)
    const hit = index.get(first)
    if (hit) return hit
  }

  return null
}

/**
 * Resolves to the canonical id string (the key in `index` that matched),
 * not the row. Useful when callers need the resolved id for downstream
 * lookups (e.g. mechanics extraction keyed by templet ID).
 */
export function resolveMonsterIdKey(rawId: string, index: Map<string, unknown>): string | null {
  if (index.has(rawId)) return rawId
  const stripped = rawId.replace(/-[A-Z0-9]+(?:-\d+)?$/, '')
  if (stripped !== rawId && index.has(stripped)) return stripped
  const sIdx = rawId.indexOf('S')
  if (sIdx > 0) {
    const first = rawId.slice(0, sIdx)
    if (index.has(first)) return first
  }
  return null
}
