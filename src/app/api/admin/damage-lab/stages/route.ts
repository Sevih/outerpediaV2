import { NextRequest, NextResponse } from 'next/server'
import { loadTable, indexBy, num, type Row } from '@/app/api/admin/extractor-v3/monster/lib/common'
import { loadLocationTables, resolveModeLabel, SUPPORTED_DUNGEON_MODES } from '@/app/api/admin/extractor-v3/monster/lib/location'

// ── Types ─────────────────────────────────────────────────────────────

interface MonsterEntry {
  monsterId: string
  name: string            // English, falls back to ID
  type: string            // CT_BOSS_MONSTER / CT_MONSTER / ...
  isBoss: boolean         // derived from Type
  class: string           // human-friendly (Attacker/Ranger/...)
  element: string         // Fire/Water/Earth/Light/Dark
  subClass: string
  level: number           // level at which this monster spawns in this stage
  // Raw scaling bounds (from MonsterTemplet.json)
  defMin: number
  defMax: number
  drMax: number           // raw DMGReduceRate_Max (treat as per mille, /10 for %)
  atkMin: number
  atkMax: number
  // Computed stats at `level` (linear interpolation on lvl 1..100)
  defAtLevel: number
  drPctAtLevel: number
  atkAtLevel: number
  // Spawn metadata
  position: number        // 0..2
  slot: number            // 0..3
}

interface StageEntry {
  id: string
  name: string            // resolved from NameID
  recommendLevel: number
  monsters: MonsterEntry[]
}

interface ModeEntry {
  mode: string
  label: string
  stages: StageEntry[]
}

// ── Constants ─────────────────────────────────────────────────────────

const CLASS_LABEL: Record<string, string> = {
  CCT_ATTACKER: 'Attacker',
  CCT_MAGE: 'Mage',
  CCT_RANGER: 'Ranger',
  CCT_DEFENDER: 'Defender',
  CCT_PRIEST: 'Priest',
  CCT_HEALER: 'Healer',
}

const ELEMENT_LABEL: Record<string, string> = {
  CET_FIRE: 'Fire',
  CET_WATER: 'Water',
  CET_EARTH: 'Earth',
  CET_LIGHT: 'Light',
  CET_DARK: 'Dark',
}

const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
  'CT_NAMED_MONSTER',
])

// Empirical scaling: stat(lvl) = Min + (Max - Min) * (lvl - 1) / 99
// Validated on 2 points (Sentry Archer lvl 1 = 44, lvl 30 = 382).
function interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  if (level >= 100) return max
  return min + (max - min) * (level - 1) / 99
}

// ── Builder ───────────────────────────────────────────────────────────

// Build the mode → stages → monsters index on first call, then cache.
let indexCache: ModeEntry[] | null = null

function buildIndex(): ModeEntry[] {
  if (indexCache) return indexCache

  const loc = loadLocationTables()
  const dungeons = loadTable('DungeonTemplet')
  const spawns = loadTable('DungeonSpawnTemplet')
  const monsters = loadTable('MonsterTemplet')
  const textChar = indexBy(loadTable('TextCharacter'))

  const monsterIndex = indexBy(monsters)

  // Pre-group spawn rows by GroupID for fast lookup.
  const spawnRowsByGroup = new Map<string, Row[]>()
  for (const s of spawns) {
    const gid = s.GroupID
    if (!gid) continue
    const arr = spawnRowsByGroup.get(gid) ?? []
    arr.push(s)
    spawnRowsByGroup.set(gid, arr)
  }

  // Stages grouped by mode label.
  const byMode = new Map<string, { mode: string; label: string; stages: StageEntry[] }>()

  for (const d of dungeons) {
    const mode = d.DungeonMode ?? ''
    if (!SUPPORTED_DUNGEON_MODES.includes(mode)) continue

    const areaRow = d.AreaID ? loc.areaIndex.get(d.AreaID) : undefined
    const label = resolveModeLabel(mode, areaRow?.AreaGroupType ?? null, d.NameID ?? null, loc.textSystemIndex)
    if (!label) continue

    // Collect monsters from this dungeon's 3 spawn positions.
    const monsterEntries: MonsterEntry[] = []
    const seen = new Set<string>()  // dedupe same (monsterId, level) inside one stage

    for (let position = 0; position < 3; position++) {
      const raw = d[`SpawnID_Pos${position}`]
      if (!raw) continue
      for (const gid of raw.split(',').map(x => x.trim()).filter(Boolean)) {
        const rows = spawnRowsByGroup.get(gid)
        if (!rows) continue
        for (const row of rows) {
          for (let slot = 0; slot < 4; slot++) {
            const mid = row[`ID${slot}`]
            if (!mid || mid === '0') continue
            const level = num(row[`Level${slot}`])
            const dedupe = `${mid}@${level}`
            if (seen.has(dedupe)) continue
            seen.add(dedupe)

            const tmpl = monsterIndex.get(mid)
            if (!tmpl) continue

            const type = tmpl.Type ?? ''
            const nameId = tmpl.NameID ?? `${mid}_Name`
            const name = textChar.get(nameId)?.English ?? mid
            const classKey = tmpl.Class ?? ''
            const elementKey = tmpl.Element ?? ''
            const defMin = num(tmpl.Def_Min)
            const defMax = num(tmpl.Def_Max)
            const drMax = num(tmpl.DMGReduceRate_Max)
            const atkMin = num(tmpl.Atk_Min)
            const atkMax = num(tmpl.Atk_Max)

            monsterEntries.push({
              monsterId: mid,
              name,
              type,
              isBoss: BOSS_TYPES.has(type),
              class: CLASS_LABEL[classKey] ?? classKey,
              element: ELEMENT_LABEL[elementKey] ?? elementKey,
              subClass: tmpl.SubClass ?? '',
              level,
              defMin,
              defMax,
              drMax,
              atkMin,
              atkMax,
              defAtLevel: interpolate(defMin, defMax, level),
              drPctAtLevel: interpolate(0, drMax, level) / 10,
              atkAtLevel: interpolate(atkMin, atkMax, level),
              position,
              slot,
            })
          }
        }
      }
    }

    if (monsterEntries.length === 0) continue

    // Sort: bosses first, then by level desc.
    monsterEntries.sort((a, b) => {
      if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
      if (a.level !== b.level) return b.level - a.level
      return a.name.localeCompare(b.name)
    })

    const stageName = d.NameID ? loc.textSystemIndex.get(d.NameID)?.English ?? d.ID : d.ID

    const bucket = byMode.get(label) ?? { mode, label, stages: [] }
    bucket.stages.push({
      id: d.ID,
      name: stageName,
      recommendLevel: num(d.RecommandLevel),
      monsters: monsterEntries,
    })
    byMode.set(label, bucket)
  }

  // Sort stages within each mode (by recommended level, then name), modes alphabetically.
  const result: ModeEntry[] = Array.from(byMode.values())
    .map(m => ({
      ...m,
      stages: m.stages.sort((a, b) => {
        if (a.recommendLevel !== b.recommendLevel) return a.recommendLevel - b.recommendLevel
        return a.name.localeCompare(b.name)
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  indexCache = result
  return result
}

// ── Handler ───────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const modes = buildIndex()
  return NextResponse.json({ modes })
}
