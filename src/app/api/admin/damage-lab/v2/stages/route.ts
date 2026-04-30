import { NextResponse } from 'next/server'
import { loadTable, indexBy, num, type Row } from '@/app/api/admin/extractor-v3/monster/lib/common'
import { loadLocationTables, resolveModeLabel, SUPPORTED_DUNGEON_MODES } from '@/app/api/admin/extractor-v3/monster/lib/location'
import { interpolate, interpolateRated } from '@/lib/damage/v2/f32'

/**
 * GET /api/admin/damage-lab/v2/stages
 *
 * Modes → stages → monsters cascade for the lab v2 target picker.
 *
 * Forked from v1 so the f32 chain (`interpolate` + `applyAdvantageRate`) flows
 * through the audited primitives in `src/lib/damage/v2/f32.ts` — no upper cap
 * on `interpolate` (Joint Challenge content spawns at lv 120+; v2 lets it
 * extrapolate per the binary instead of clamping at lv 100 like v1).
 *
 * Restricted to development.
 */

// ── Types ─────────────────────────────────────────────────────────────

interface MonsterEntry {
  monsterId: string
  /** `FaceIconID` from `MonsterTemplet` — keys the portrait file `MT_{faceIconId}.webp`. */
  faceIconId: string
  /** English, falls back to ID. */
  name: string
  /** `CT_BOSS_MONSTER` / `CT_MONSTER` / … */
  type: string
  /** Derived from `Type`. */
  isBoss: boolean
  /** Human-friendly (Attacker/Ranger/…). */
  class: string
  /** Fire/Water/Earth/Light/Dark. */
  element: string
  subClass: string
  /** 1/2/3 — drives the star overlay on the portrait. */
  basicStar: number
  /** Spawn level for this monster in this stage. */
  level: number
  // Raw scaling bounds (from MonsterTemplet)
  defMin: number
  defMax: number
  /** raw `DMGReduceRate_Max` (treat as per-mille, /10 for %). */
  drMax: number
  atkMin: number
  atkMax: number
  hpMin: number
  hpMax: number
  // Computed stats at `level` — runtime ints matching the binary's `get_*`
  // getters at the time of damage calculation. Single source of truth between
  // the manual-mode picker and `/api/admin/damage-lab/v2/monsters/[id]/stats`.
  defAtLevel: number
  drPctAtLevel: number
  atkAtLevel: number
  hpAtLevel: number
  // Spawn metadata
  position: number
  slot: number
}

interface WaveEntry {
  /** `SpawnID_Pos{position}` index — each stage has up to 3 separate waves. */
  position: number
  monsters: MonsterEntry[]
}

interface StageEntry {
  id: string
  /** Resolved from `NameID`. */
  name: string
  /** Chapter / area name for `DM_NORMAL` (from `AreaTemplet`); null otherwise. */
  chapter: string | null
  // Story-only metadata. `season` and `episodeNum` come from `AreaTemplet`;
  // `stageNum` is parsed from the trailing 2-digit suffix of the dungeon ID
  // (e.g. 100912 → 9-12) so visible stages align with in-game labels even
  // when intermediate monsterless stages have been filtered.
  season: number | null
  episodeNum: number | null
  stageNum: number | null
  recommendLevel: number
  waves: WaveEntry[]
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

// `CT_NAMED_MONSTER` is intentionally excluded — the in-game slot color flags
// it as Magic (blue) rather than Rare (red), so it's a tougher named mob and
// not the stage boss. Boss-only quirks (`BT_DMG_TO_BOSS`, `Awakening_Boss_*`)
// only fire on the proper boss types.
const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

// ── Builder ───────────────────────────────────────────────────────────

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

  const byMode = new Map<string, { mode: string; label: string; stages: StageEntry[] }>()

  for (const d of dungeons) {
    const mode = d.DungeonMode ?? ''
    if (!SUPPORTED_DUNGEON_MODES.includes(mode)) continue

    const areaRow = d.AreaID ? loc.areaIndex.get(d.AreaID) : undefined
    const label = resolveModeLabel(mode, areaRow?.AreaGroupType ?? null, d.NameID ?? null, loc.textSystemIndex)
    if (!label) continue

    // Per-mille `SpawnAdvantageRate_*` from the dungeon row. Applied to
    // ATK/DEF/HP via the f32 chain (= what the binary's getters return).
    const advAtk = num(d.SpawnAdvantageRate_Atk)
    const advDef = num(d.SpawnAdvantageRate_Def)
    const advHp  = num(d.SpawnAdvantageRate_HP)

    const waves: WaveEntry[] = []

    for (let position = 0; position < 3; position++) {
      const raw = d[`SpawnID_Pos${position}`]
      if (!raw) continue

      const monsterEntries: MonsterEntry[] = []
      const seen = new Set<string>()  // dedupe within this wave only

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
            const hpMin = num(tmpl.HP_Min)
            const hpMax = num(tmpl.HP_Max)

            monsterEntries.push({
              monsterId: mid,
              faceIconId: tmpl.FaceIconID ?? mid,
              name,
              type,
              isBoss: BOSS_TYPES.has(type),
              class: CLASS_LABEL[classKey] ?? classKey,
              element: ELEMENT_LABEL[elementKey] ?? elementKey,
              subClass: tmpl.SubClass ?? '',
              basicStar: num(tmpl.BasicStar),
              level,
              defMin,
              defMax,
              drMax,
              atkMin,
              atkMax,
              hpMin,
              hpMax,
              // Stats interpolated to the spawn level AND multiplied by the
              // dungeon's `SpawnAdvantageRate` in a single f32 chain (one
              // floor at the end) — matches the binary `get_MaxHP` /
              // `get_Def` / `get_Atk` exactly. The two-step
              // `applyAdvantageRate(interpolate(...))` floored twice and was
              // off by 1 on edge cases (Ars Nova St1 lv 25 HP: 14351 vs
              // in-game 14352). DR has no rate column, so spawnRate doesn't
              // apply to it.
              defAtLevel:   interpolateRated(defMin, defMax, level, advDef),
              drPctAtLevel: interpolate(0, drMax, level) / 10,
              atkAtLevel:   interpolateRated(atkMin, atkMax, level, advAtk),
              hpAtLevel:    interpolateRated(hpMin, hpMax, level, advHp),
              position,
              slot,
            })
          }
        }
      }

      if (monsterEntries.length === 0) continue

      // Sort within a wave: bosses first, then by level desc, then name.
      monsterEntries.sort((a, b) => {
        if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
        if (a.level !== b.level) return b.level - a.level
        return a.name.localeCompare(b.name)
      })

      waves.push({ position, monsters: monsterEntries })
    }

    if (waves.length === 0) continue

    const stageName = d.NameID ? loc.textSystemIndex.get(d.NameID)?.English ?? d.ID : d.ID

    let chapter: string | null = null
    let season: number | null = null
    let episodeNum: number | null = null
    if (mode === 'DM_NORMAL' && areaRow) {
      if (areaRow.NameID) chapter = loc.textSystemIndex.get(areaRow.NameID)?.English ?? null
      season     = num(areaRow.SeasonID)   || null
      episodeNum = num(areaRow.EpisodeNum) || null
    }

    const bucket = byMode.get(label) ?? { mode, label, stages: [] }
    bucket.stages.push({
      id: d.ID,
      name: stageName,
      chapter,
      season,
      episodeNum,
      stageNum: null,  // assigned in the post-pass below
      recommendLevel: num(d.RecommandLevel),
      waves,
    })
    byMode.set(label, bucket)
  }

  // Assign per-episode stageNum for story stages. The in-game numbering follows
  // the trailing 2-digit suffix of the dungeon ID (e.g. 100912 → 9-12) — even
  // when intermediate stages have been filtered for being monsterless. Falls
  // back to the position-in-group index for IDs that don't match.
  for (const bucket of byMode.values()) {
    if (bucket.mode !== 'DM_NORMAL') continue
    const groups = new Map<string, StageEntry[]>()
    for (const s of bucket.stages) {
      if (s.season == null || s.episodeNum == null) continue
      const key = `${s.season}/${s.episodeNum}`
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      list.forEach((s, i) => {
        const m = s.id.match(/(\d{2})$/)
        s.stageNum = m ? parseInt(m[1], 10) : i + 1
      })
    }
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

export function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const modes = buildIndex()
  return NextResponse.json({ modes })
}
