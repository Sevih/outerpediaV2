// One-off fix: tower boss files where the monster ID in the filename
// doesn't match what actually spawns in the dungeon. This happens when
// the wiki's file was frozen on an older monster ID that has since been
// replaced in game data.
//
// Usage:
//   npx tsx scripts/fix-tower-boss-ids.ts          # dry-run
//   npx tsx scripts/fix-tower-boss-ids.ts --write  # apply
//
// Scope: only files whose `location.mode.en` is a standard Skyward or
// Elemental tower — Skyward Hard and Very Hard are left alone (their
// spawn resolution isn't the same and we don't want to touch them).
//
// For each `<monsterId>@<dungeonId>.json`:
//   1. Find every monster ID that actually spawns in `dungeonId`
//      (via DungeonTemplet.SpawnID_Pos* → DungeonSpawnTemplet.ID0..3)
//   2. Pick the first CT_*_MONSTER that isn't a minion support type.
//      The rule: if the current `<monsterId>` is NOT in the spawn list
//      AND exactly one boss-typed monster is, rename to that boss.
//   3. Otherwise report and leave it alone.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  renameSync,
} from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const BOSS_DIR = join(ROOT, 'data', 'boss')
const JSON2 = join(ROOT, 'data', 'admin', 'json2')

const WRITE = process.argv.includes('--write')

type Row = Record<string, string>

function loadTable(name: string): Row[] {
  return JSON.parse(readFileSync(join(JSON2, `${name}.json`), 'utf-8'))
}

// Tower modes we want to touch. Deliberately excludes "Skyward Tower - Hard"
// (DM_TOWER_HARD) per user request.
const TOWER_MODES = new Set(['Skyward Tower', 'Elemental Tower'])

const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_NAMED_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

type BossFile = {
  id?: string
  level?: number
  location?: { mode?: { en?: string } }
}

type DungeonSpawnInfo = {
  /** All monster IDs that can appear in this dungeon. */
  ids: string[]
  /** monsterId → highest level at which it spawns here. */
  levelByMonster: Map<string, number>
}

function buildDungeonSpawnIndex(): Map<string, DungeonSpawnInfo> {
  const spawns = loadTable('DungeonSpawnTemplet')
  // groupId → [{ id, level }]
  const byGroup = new Map<string, Array<{ id: string; level: number }>>()
  for (const s of spawns) {
    const gid = s.GroupID
    if (!gid) continue
    const entries: Array<{ id: string; level: number }> = []
    for (let slot = 0; slot < 4; slot++) {
      const v = s[`ID${slot}`]
      if (!v || v === '0') continue
      const lvl = parseInt(s[`Level${slot}`] ?? '0', 10) || 0
      entries.push({ id: v, level: lvl })
    }
    if (entries.length === 0) continue
    const arr = byGroup.get(gid) ?? []
    arr.push(...entries)
    byGroup.set(gid, arr)
  }

  const byDungeon = new Map<string, DungeonSpawnInfo>()
  for (const d of loadTable('DungeonTemplet')) {
    if (!d.ID) continue
    const ids = new Set<string>()
    const levelByMonster = new Map<string, number>()
    for (const k of ['SpawnID_Pos0', 'SpawnID_Pos1', 'SpawnID_Pos2']) {
      const raw = d[k]
      if (!raw) continue
      for (const gid of raw.split(',').map((s: string) => s.trim()).filter(Boolean)) {
        for (const { id, level } of byGroup.get(gid) ?? []) {
          ids.add(id)
          const prev = levelByMonster.get(id) ?? 0
          if (level > prev) levelByMonster.set(id, level)
        }
      }
    }
    if (ids.size > 0) byDungeon.set(d.ID, { ids: [...ids], levelByMonster })
  }
  return byDungeon
}

function main() {
  const monsterById = new Map<string, Row>()
  for (const r of loadTable('MonsterTemplet')) {
    if (r.ID) monsterById.set(r.ID, r)
  }
  const dungeonSpawns = buildDungeonSpawnIndex()

  const files = readdirSync(BOSS_DIR).filter((f: string) => f.endsWith('.json'))

  let fixed = 0
  let levelFixed = 0
  let alreadyCorrect = 0
  let notTower = 0
  let skippedArchive = 0
  let noSpawnInfo = 0
  const ambiguous: string[] = []
  const noBossInDungeon: string[] = []

  for (const f of files) {
    const base = f.replace(/\.json$/, '')
    if (base.includes('-') || base === 'index' || base === 'temp') {
      skippedArchive++
      continue
    }
    if (!base.includes('@')) {
      // Not a variant; outside tower scope anyway.
      notTower++
      continue
    }
    const [monsterId, dungeonId] = base.split('@')

    const full = join(BOSS_DIR, f)
    const json = JSON.parse(readFileSync(full, 'utf-8')) as BossFile
    const modeEn = json.location?.mode?.en?.trim() ?? ''
    if (!TOWER_MODES.has(modeEn)) {
      notTower++
      continue
    }

    const info = dungeonSpawns.get(dungeonId)
    if (!info || info.ids.length === 0) {
      noSpawnInfo++
      continue
    }

    if (info.ids.includes(monsterId)) {
      // ID is correct — verify level.
      const expected = info.levelByMonster.get(monsterId) ?? 0
      if (expected > 0 && json.level !== expected) {
        console.log(`  ${base} level ${json.level} → ${expected}`)
        ;(json as Record<string, unknown>).level = expected
        if (WRITE) {
          writeFileSync(full, JSON.stringify(json, null, 2) + '\n')
        }
        levelFixed++
      } else {
        alreadyCorrect++
      }
      continue
    }

    // Pick boss-typed spawns.
    const bosses = info.ids.filter((id) => {
      const m = monsterById.get(id)
      return m && BOSS_TYPES.has(m.Type ?? '')
    })

    if (bosses.length === 0) {
      noBossInDungeon.push(`${base} (spawns: ${spawnIds.join(', ')})`)
      continue
    }
    if (bosses.length > 1) {
      ambiguous.push(`${base} → candidates: ${bosses.join(', ')}`)
      continue
    }

    const newMonsterId = bosses[0]
    const newBase = `${newMonsterId}@${dungeonId}`
    const newPath = join(BOSS_DIR, `${newBase}.json`)
    if (existsSync(newPath)) {
      ambiguous.push(`${base} → target ${newBase}.json already exists`)
      continue
    }

    ;(json as Record<string, unknown>).id = newBase
    // Patch level to the correct spawn value if possible.
    const expectedLvl = info.levelByMonster.get(newMonsterId) ?? 0
    if (expectedLvl > 0) (json as Record<string, unknown>).level = expectedLvl
    const out = JSON.stringify(json, null, 2) + '\n'
    console.log(`  ${base} → ${newBase}${expectedLvl > 0 ? ` (lvl ${expectedLvl})` : ''}`)
    if (WRITE) {
      writeFileSync(full, out)
      renameSync(full, newPath)
    }
    fixed++
  }

  console.log(`\n[fix-tower-boss-ids] scanned ${files.length} files`)
  console.log(`  ${WRITE ? 'id-fixed' : 'would id-fix'}: ${fixed}`)
  console.log(`  ${WRITE ? 'level-fixed' : 'would level-fix'}: ${levelFixed}`)
  console.log(`  already correct: ${alreadyCorrect}`)
  console.log(`  not a tower file / not a variant: ${notTower}`)
  console.log(`  archive skipped: ${skippedArchive}`)
  console.log(`  dungeon has no spawn info: ${noSpawnInfo}`)
  console.log(`  no boss in dungeon: ${noBossInDungeon.length}`)
  console.log(`  ambiguous / target exists: ${ambiguous.length}`)
  if (noBossInDungeon.length > 0) {
    console.log('\n[no boss in dungeon]')
    for (const l of noBossInDungeon.slice(0, 30)) console.log('  ' + l)
    if (noBossInDungeon.length > 30) console.log(`  ... and ${noBossInDungeon.length - 30} more`)
  }
  if (ambiguous.length > 0) {
    console.log('\n[ambiguous]')
    for (const l of ambiguous.slice(0, 30)) console.log('  ' + l)
    if (ambiguous.length > 30) console.log(`  ... and ${ambiguous.length - 30} more`)
  }
  if (!WRITE) console.log('\n[fix-tower-boss-ids] dry-run: re-run with --write to apply')
}

main()
