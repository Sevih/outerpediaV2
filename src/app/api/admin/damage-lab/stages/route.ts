import { NextRequest, NextResponse } from 'next/server'
import { loadTable, indexBy, num, type Row } from '@/app/api/admin/extractor-v3/monster/lib/common'
import { loadLocationTables, resolveModeLabel, SUPPORTED_DUNGEON_MODES } from '@/app/api/admin/extractor-v3/monster/lib/location'

// ── Types ─────────────────────────────────────────────────────────────

interface MonsterEntry {
  monsterId: string
  faceIconId: string      // FaceIconID from MonsterTemplet — keys the portrait file MT_{faceIconId}.webp
  name: string            // English, falls back to ID
  type: string            // CT_BOSS_MONSTER / CT_MONSTER / ...
  isBoss: boolean         // derived from Type
  class: string           // human-friendly (Attacker/Ranger/...)
  element: string         // Fire/Water/Earth/Light/Dark
  subClass: string
  basicStar: number       // 1/2/3 — drives star overlay on the monster portrait
  level: number           // level at which this monster spawns in this stage
  // Raw scaling bounds (from MonsterTemplet.json)
  defMin: number
  defMax: number
  drMax: number           // raw DMGReduceRate_Max (treat as per mille, /10 for %)
  atkMin: number
  atkMax: number
  hpMin: number
  hpMax: number
  // Computed stats at `level`. As of the dual-fix (int CalcStat + SpawnAdvantageRate
  // application), these are now the EXACT runtime values returned by the binary's
  // get_MaxHP / get_Def / get_Atk / get_DMGReduceRate at the time of damage
  // calculation — single source of truth between manual-mode picker and
  // /api/admin/monsters/:id/stats?level=N&dungeonId=X. Previously hpAtLevel was
  // pre-spawnRate (raw lv-N value) and drifted from the lab's auto-mode value;
  // now both paths produce identical numbers (= what BT_DMG_TARGET_STAT,
  // mit denominator, etc. read from CharacterData).
  defAtLevel: number
  drPctAtLevel: number
  atkAtLevel: number
  hpAtLevel: number
  // Spawn metadata
  position: number        // 0..2
  slot: number            // 0..3
}

interface WaveEntry {
  // SpawnID_Pos{position} index — each stage has up to 3 separate combat waves
  // (Pos0/1/2). The in-game UI sequences them as fight 1 → fight 2 → fight 3.
  position: number
  monsters: MonsterEntry[]
}

interface StageEntry {
  id: string
  name: string            // resolved from NameID
  // Chapter / area name for DM_NORMAL (from AreaTemplet) — null for other modes
  // where the dungeon grouping is parsed client-side from the stage name suffix
  // (e.g. "Skyward Tower 1F" → dungeon "Skyward Tower" + stage "1F").
  chapter: string | null
  // Story-only metadata. `season` and `episodeNum` come straight from
  // AreaTemplet; `stageNum` is computed by sorting stages within (season,
  // episodeNum) by id ascending and assigning 1..N. This lets the UI render
  // labels like "EP 1: Outer City" + stage "1-3".
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

// CT_NAMED_MONSTER is intentionally excluded — the in-game slot color flags it
// as Magic (blue) rather than Rare (red), so it's a tougher named mob and not
// the stage boss. Boss-related quirks (BT_DMG_TO_BOSS, Awakening_Boss_*) only
// fire on the proper boss types.
const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

// Empirical scaling: stat(lvl) = Min + (Max - Min) * (lvl - 1) / 99
// Confirmed by binary disasm of CFormula.CalcStat (VA 0x2b52d24): the game
// uses f32 arithmetic with the EXACT order `(max-min)/99 × (level-1) + min`
// then `fcvtms` (= floor toward −∞) to produce an int32. Our prior float64
// implementation drifted by up to 0.3 per-mille on DR (e.g. drMax=100, lv 30:
// our float = 29.2929%, game's int = 29 = 2.9%). The int return matches
// game runtime exactly — Noa S1 obs Δ = −1 → 0 with this fix.
function interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  if (level >= 100) return max
  // Mirror CalcStat's f32 chain: (max-min)/99 × (level-1) + min, then floor.
  const diff = Math.fround(max - min)
  const div = Math.fround(diff / Math.fround(99))
  const mul = Math.fround(div * Math.fround(level - 1))
  const sum = Math.fround(mul + Math.fround(min))
  return Math.floor(sum)
}

// Apply per-mille SpawnAdvantageRate to a stat — mirrors get_MaxHP's binary path:
//   maxHP = floor(HPRate × CalcStat)  where HPRate is f32(1 + sr/1000)
// For DEF/ATK/SPD with their own rate fields, same pattern. Returns the
// runtime-faithful int (= the value the game's get_* getters return).
function applyAdvantageRate(baseStat: number, ratePermille: number): number {
  if (ratePermille === 0) return baseStat
  const rate = Math.fround(Math.fround(1) + Math.fround(ratePermille) * Math.fround(0.001))
  return Math.floor(Math.fround(rate * baseStat))
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

    // Per-mille SpawnAdvantageRate from the dungeon row. Applied to ATK/DEF/HP/SPD
    // via the binary's f32 chain (= what get_MaxHP / get_Def / get_Atk return at
    // runtime). Empirical match: Amadeus St2 lv 30 with HP rate −574 →
    //   floor(0.426 × 52707) = 22453, exactly what BT_DMG_TARGET_STAT reads.
    const advAtk = num(d.SpawnAdvantageRate_Atk)
    const advDef = num(d.SpawnAdvantageRate_Def)
    const advHp  = num(d.SpawnAdvantageRate_HP)

    // Collect monsters from this dungeon's 3 spawn positions, keeping each wave
    // as its own group so the UI can show "Fight 1 / 2 / 3" separately. Dedupe
    // is per-wave (a wave with two identical mobs collapses to one entry, since
    // their stats are identical and the formula doesn't care about count).
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
              // Stats interpolated to monster's spawn level THEN multiplied by
              // dungeon's SpawnAdvantageRate via f32 chain — matches binary
              // get_MaxHP / get_Def / get_Atk / get_DMGReduceRate exactly.
              // No rate column for DR (game's get_DMGReduceRate path doesn't
              // apply spawnRate), so we don't multiply.
              defAtLevel:   applyAdvantageRate(interpolate(defMin, defMax, level), advDef),
              drPctAtLevel: interpolate(0, drMax, level) / 10,
              atkAtLevel:   applyAdvantageRate(interpolate(atkMin, atkMax, level), advAtk),
              hpAtLevel:    applyAdvantageRate(interpolate(hpMin, hpMax, level), advHp),
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

    // Chapter (area) name — used by the UI to group story stages by chapter.
    // Tower / raid / irregular modes use the stage NAME suffix instead and
    // don't need chapter info.
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
  // the trailing 2-digit suffix of the dungeon ID (e.g. 100912 → 9-12), even
  // when intermediate stages have been filtered out for being monsterless
  // (intros, cutscenes). Sequential indexing would shift visible stages and
  // misalign with the in-game labels — so we parse the suffix directly.
  // Falls back to the position-in-group index for IDs that don't match (rare).
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

export async function GET(_req: NextRequest) {
  const modes = buildIndex()
  return NextResponse.json({ modes })
}
