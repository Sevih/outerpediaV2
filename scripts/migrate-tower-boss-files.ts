// One-off migration: for every boss file in data/boss/, look at its
// `location.dungeon.en` value (the per-floor dungeon name the wiki
// recorded) and find the matching dungeon ID in DungeonTemplet. Then:
//   - rename the file from `<id>.json` to `<id>@<dungeonId>.json`
//   - patch the `id` field inside
//
// Usage:
//   npx tsx scripts/migrate-tower-boss-files.ts            # dry-run
//   npx tsx scripts/migrate-tower-boss-files.ts --write    # apply
//
// Skips files that already have an `@` in their name, are archived
// (`-N` suffix), or are summons (`S` suffix). Files with no dungeon
// match or multiple ambiguous matches are reported and left alone.

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

// Build an English-name → dungeonIds map.
function buildDungeonNameIndex(): Map<string, string[]> {
  const textSystem = new Map<string, string>()
  for (const r of loadTable('TextSystem')) {
    if (r.ID && r.English !== undefined) textSystem.set(r.ID, r.English)
  }
  const map = new Map<string, string[]>()
  for (const d of loadTable('DungeonTemplet')) {
    if (!d.ID || !d.NameID) continue
    const name = textSystem.get(d.NameID)
    if (!name) continue
    let arr = map.get(name)
    if (!arr) {
      arr = []
      map.set(name, arr)
    }
    arr.push(d.ID)
  }
  return map
}

type BossFile = {
  id?: string
  location?: {
    dungeon?: { en?: string }
    mode?: { en?: string }
  }
}

// English mode labels that identify tower files. Anything else is left
// alone — this migration only renames tower bosses.
const TOWER_MODES = new Set([
  'Skyward Tower',
  'Skyward Tower - Hard',
  'Elemental Tower',
])

function main() {
  const nameIndex = buildDungeonNameIndex()
  const files = readdirSync(BOSS_DIR).filter((f: string) => f.endsWith('.json'))

  let renamed = 0
  let skippedSuffix = 0
  let noLocation = 0
  let noMatch = 0
  let ambiguous = 0
  const noMatchList: string[] = []
  const ambiguousList: string[] = []

  for (const f of files) {
    const base = f.replace(/\.json$/, '')
    // Skip already-migrated variants, archives, summons, misc.
    if (base.includes('@') || base.includes('-') || base.includes('S') || base === 'index' || base === 'temp') {
      skippedSuffix++
      continue
    }
    const full = join(BOSS_DIR, f)
    const raw = readFileSync(full, 'utf-8')
    const json = JSON.parse(raw) as BossFile
    const modeEn = json.location?.mode?.en?.trim() ?? ''
    if (!TOWER_MODES.has(modeEn)) {
      skippedSuffix++
      continue
    }
    const en = json.location?.dungeon?.en?.trim() ?? ''
    if (!en) {
      noLocation++
      continue
    }
    const hits = nameIndex.get(en)
    if (!hits || hits.length === 0) {
      noMatch++
      noMatchList.push(`${base} → "${en}"`)
      continue
    }
    if (hits.length > 1) {
      ambiguous++
      ambiguousList.push(`${base} → "${en}" (${hits.join(', ')})`)
      continue
    }
    const dungeonId = hits[0]
    const newBase = `${base}@${dungeonId}`
    const newPath = join(BOSS_DIR, `${newBase}.json`)
    if (existsSync(newPath)) {
      // Destination exists — leave both alone and report.
      ambiguous++
      ambiguousList.push(`${base} → "${en}" (target ${newBase}.json already exists)`)
      continue
    }
    // Patch id field.
    ;(json as Record<string, unknown>).id = newBase
    const out = JSON.stringify(json, null, 2) + '\n'
    if (WRITE) {
      writeFileSync(full, out)
      renameSync(full, newPath)
    }
    renamed++
  }

  console.log(`[migrate] scanned ${files.length} files`)
  console.log(`  ${WRITE ? 'renamed' : 'would rename'}: ${renamed}`)
  console.log(`  skipped (suffix/archive/summon): ${skippedSuffix}`)
  console.log(`  no location.dungeon.en: ${noLocation}`)
  console.log(`  no dungeon match: ${noMatch}`)
  console.log(`  ambiguous / target exists: ${ambiguous}`)
  if (noMatchList.length > 0) {
    console.log('\n[no match]')
    for (const l of noMatchList.slice(0, 30)) console.log('  ' + l)
    if (noMatchList.length > 30) console.log(`  ... and ${noMatchList.length - 30} more`)
  }
  if (ambiguousList.length > 0) {
    console.log('\n[ambiguous / target exists]')
    for (const l of ambiguousList.slice(0, 30)) console.log('  ' + l)
    if (ambiguousList.length > 30) console.log(`  ... and ${ambiguousList.length - 30} more`)
  }
  if (!WRITE) console.log('\n[migrate] dry-run: re-run with --write to apply')
}

main()
