import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCHEMA_VERSION, writeJsonMin } from './shared'
import { loadJson2 } from './raw-loader'
import { resolveMonsterIdKey } from './monster-resolver'
import { extractMonsterPassives } from '../../../src/lib/damage/v2/extract-monster'
import type { MonsterMechanics } from '../../../src/lib/damage/v2/extract-monster'

/**
 * Bake monster mechanics (passives + collapsed enrage) for the public
 * damage calculator's target panel.
 *
 *   public/damage-calc/mechanics/_index.json — list of monsterIds that have
 *     non-empty passives. Loaded alongside `monsters.json` so the picker
 *     can show a "has mechanics" badge without an extra fetch.
 *   public/damage-calc/mechanics/{monsterId}.json — full mechanics payload
 *     for that monster. Loaded only when the user opens the mechanics
 *     toggle for the selected target.
 *
 * Sharded rather than one big file because:
 *   - Most users won't toggle mechanics for most targets.
 *   - Per-monster fetches stay tiny (< 5 KB).
 *   - Sharding lets us 404 implicitly for monsters with no passives —
 *     the index is the source of truth for "has mechanics".
 *
 * Source of unique IDs: `data/boss/*.json`. Mechanics are intrinsic to the
 * monster (not the stage), so we dedupe by resolved templet ID before
 * extracting — Skadi at Tower 60F and Tower 80F share the same passives.
 */

type Row = Record<string, string | undefined>

interface CuratedBoss {
  id?: string
}

async function collectUniqueMonsterIds(monsterIndex: Map<string, Row>): Promise<Set<string>> {
  const dir = join(process.cwd(), 'data', 'boss')
  const files = await readdir(dir)
  const out = new Set<string>()
  await Promise.all(
    files.filter(f => f.endsWith('.json') && f !== 'index.json').map(async f => {
      try {
        const raw = await readFile(join(dir, f), 'utf-8')
        const c = JSON.parse(raw) as CuratedBoss
        if (!c.id) return
        const atIdx = c.id.indexOf('@')
        const monsterId = atIdx >= 0 ? c.id.slice(0, atIdx) : c.id
        const resolved = resolveMonsterIdKey(monsterId, monsterIndex)
        if (resolved) out.add(resolved)
      } catch {
        // skip broken curated files
      }
    }),
  )
  return out
}

interface MechanicsFile {
  _v: string
  data: MonsterMechanics
}

interface MechanicsIndex {
  _v: string
  /** Resolved templet IDs for monsters with at least one passive entry. */
  monsterIds: string[]
}

export async function buildMechanics(): Promise<{ withMechanics: number; total: number }> {
  const [
    monsterRows,
    skillRows,
    skillLevelRows,
    buffRows,
    textSkillRows,
  ] = await Promise.all([
    loadJson2<Row[]>('MonsterTemplet.json'),
    loadJson2<Row[]>('MonsterSkillTemplet.json'),
    loadJson2<Row[]>('MonsterSkillLevelTemplet.json'),
    loadJson2<Row[]>('BuffTemplet.json'),
    loadJson2<Row[]>('TextSkill.json'),
  ])

  // Pre-build the monster index for resolver + extraction lookups.
  const monsterIndex = new Map<string, Row>()
  for (const r of monsterRows) {
    if (r.ID) monsterIndex.set(r.ID, r)
  }

  const uniqueIds = await collectUniqueMonsterIds(monsterIndex)

  const writes: Promise<void>[] = []
  const withMechanicsIds: string[] = []

  for (const monsterId of uniqueIds) {
    const result = extractMonsterPassives({
      monsterId,
      monsters: monsterRows,
      skills: skillRows,
      skillLevels: skillLevelRows,
      buffs: buffRows,
      textSkill: textSkillRows,
    })
    if (!result || result.passives.length === 0) continue   // no relevant passives — skip

    withMechanicsIds.push(monsterId)
    const file: MechanicsFile = { _v: SCHEMA_VERSION, data: result }
    writes.push(writeJsonMin(`mechanics/${monsterId}.json`, file))
  }

  withMechanicsIds.sort()
  const indexFile: MechanicsIndex = { _v: SCHEMA_VERSION, monsterIds: withMechanicsIds }
  writes.push(writeJsonMin('mechanics/_index.json', indexFile))

  await Promise.all(writes)
  return { withMechanics: withMechanicsIds.length, total: uniqueIds.size }
}
