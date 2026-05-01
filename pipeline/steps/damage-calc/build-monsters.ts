import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCHEMA_VERSION, writeJsonMin } from './shared'
import { loadJson2 } from './raw-loader'
import { resolveMonsterId } from './monster-resolver'
import { interpolate, interpolateRated } from '../../../src/lib/damage/v2/f32'

/**
 * Bake the target catalog for the public damage calculator.
 *
 *   public/damage-calc/monsters.json — single flat list of stage entries
 *
 * Source of truth is the curated `data/boss/*.json` files (already filtered
 * to the bosses surfaced on the rest of the site). Each curated entry is
 * augmented with stats computed at the spawn level via the same f32 chain
 * the lab uses (`interpolateRated` for ATK/DEF/HP — single floor at the
 * end, matching the binary's `get_*` getters bit-exact).
 *
 * Why one flat file rather than per-mode sharding: the picker's main UX is
 * search-by-name across all modes — a single fetch keeps that snappy. Total
 * size is bounded (~2300 entries, ~1MB raw / ~250KB gz).
 *
 * Mechanics (boss passives — BT_DMG_REDUCE, element_superiority…) are NOT
 * baked here. They'll come in a follow-up `build-mechanics.ts` so the
 * monsters file stays tight for the picker.
 */

type Row = Record<string, string | undefined>

interface MonsterTempletRow extends Row {
  ID?: string
  FaceIconID?: string
  Element?: string
  Class?: string
  SubClass?: string
  Type?: string
  BasicStar?: string
  HP_Min?: string; HP_Max?: string
  Atk_Min?: string; Atk_Max?: string
  Def_Min?: string; Def_Max?: string
  DMGReduceRate_Max?: string
  BuffResist_Min?: string; BuffResist_Max?: string
}

interface DungeonTempletRow extends Row {
  ID?: string
  SpawnAdvantageRate_Atk?: string
  SpawnAdvantageRate_Def?: string
  SpawnAdvantageRate_HP?: string
}

interface LangMap {
  en?: string
  jp?: string
  kr?: string
  zh?: string
}

interface CuratedBoss {
  id: string
  Name: LangMap
  Surname?: LangMap
  IncludeSurname?: boolean
  class: string
  element: string
  level: number
  icons?: string
  BuffImmune?: string
  StatBuffImmune?: string
  location?: {
    dungeon?: LangMap
    mode?: LangMap
  }
}

const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

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

const num = (v: string | undefined) => parseInt(v ?? '0', 10) || 0

interface MonsterEntry {
  /** Composite id `{monsterId}@{dungeonId}` — same key the boss pages use. */
  id: string
  monsterId: string
  dungeonId: string
  name: LangMap
  /** Stage / dungeon name (e.g. "Skyward Tower 5F"). */
  stage: LangMap
  /** Mode / category bucket (e.g. "Skyward Tower", "World Boss"). */
  mode: LangMap
  level: number
  isBoss: boolean
  element: string
  class: string
  /** FaceIconID — drives the portrait at `/images/bosses/portrait/MT_{icons}.webp`. */
  icons: string
  /** Computed at the spawn level via the f32 chain (matches in-game `get_*` getters). */
  stats: {
    def: number
    hp: number
    atk: number
    /** % (already converted from the per-mille DMGReduceRate_Max). */
    drPct: number
    /** Per-mille (raw — same encoding as ST_BUFF_RESIST). */
    buffResist: number
  }
}

interface MonstersFile {
  _v: string
  /** Sorted alphabetically by primary `name.en`, ties broken by mode then level desc. */
  stages: MonsterEntry[]
}

async function loadCuratedBosses(): Promise<CuratedBoss[]> {
  const dir = join(process.cwd(), 'data', 'boss')
  const files = await readdir(dir)
  const out: CuratedBoss[] = []
  await Promise.all(
    files.filter(f => f.endsWith('.json') && f !== 'index.json').map(async f => {
      try {
        const raw = await readFile(join(dir, f), 'utf-8')
        out.push(JSON.parse(raw) as CuratedBoss)
      } catch {
        // skip broken files — pipeline doesn't fail because of one bad row
      }
    }),
  )
  return out
}

export async function buildMonsters(): Promise<{ stages: number; skipped: number }> {
  const [bosses, monsterRows, dungeonRows] = await Promise.all([
    loadCuratedBosses(),
    loadJson2<MonsterTempletRow[]>('MonsterTemplet.json'),
    loadJson2<DungeonTempletRow[]>('DungeonTemplet.json'),
  ])

  // Index raw templets for O(1) lookup. Monsters: ~thousands of rows;
  // dungeons: similar. Building the indexes once is much cheaper than
  // a linear scan per curated boss (~2300).
  const monsterIndex = new Map<string, MonsterTempletRow>()
  for (const r of monsterRows) {
    if (r.ID) monsterIndex.set(r.ID, r)
  }
  const dungeonIndex = new Map<string, DungeonTempletRow>()
  for (const r of dungeonRows) {
    if (r.ID) dungeonIndex.set(r.ID, r)
  }

  const stages: MonsterEntry[] = []
  let skipped = 0

  for (const b of bosses) {
    if (!b.id) { skipped++; continue }

    // Curated boss IDs come in two forms:
    //   `{monsterId}@{dungeonId}` — stage-bound entries (towers, story).
    //   `{monsterId}`             — dungeon-less entries (world boss, guild
    //                                raid, special requests). The boss IS
    //                                the encounter; no dungeon spawn rate.
    const atIdx = b.id.indexOf('@')
    const monsterId = atIdx >= 0 ? b.id.slice(0, atIdx) : b.id
    const dungeonId = atIdx >= 0 ? b.id.slice(atIdx + 1) : ''

    const tmpl = resolveMonsterId(monsterId, monsterIndex)
    if (!tmpl) { skipped++; continue }   // unresolvable synthetic id — drop

    // Spawn rates default to 0 when there's no dungeon (dungeon-less boss)
    // or when the dungeon isn't in the templet (retired stage). Keeps the
    // bake resilient — we still emit the entry, just without rate boost.
    const dungeon = dungeonId ? dungeonIndex.get(dungeonId) : undefined
    const advAtk = num(dungeon?.SpawnAdvantageRate_Atk)
    const advDef = num(dungeon?.SpawnAdvantageRate_Def)
    const advHp  = num(dungeon?.SpawnAdvantageRate_HP)

    const level = b.level || 1
    const defMin = num(tmpl.Def_Min)
    const defMax = num(tmpl.Def_Max)
    const atkMin = num(tmpl.Atk_Min)
    const atkMax = num(tmpl.Atk_Max)
    const hpMin  = num(tmpl.HP_Min)
    const hpMax  = num(tmpl.HP_Max)
    const drMax  = num(tmpl.DMGReduceRate_Max)
    const brMin  = num(tmpl.BuffResist_Min)
    const brMax  = num(tmpl.BuffResist_Max)

    const isBoss = BOSS_TYPES.has(tmpl.Type ?? '')
    const elementKey = tmpl.Element ?? ''
    const classKey = tmpl.Class ?? ''

    stages.push({
      id: b.id,
      monsterId,
      dungeonId,
      name: b.Name,
      stage: b.location?.dungeon ?? {},
      mode: b.location?.mode ?? {},
      level,
      isBoss,
      element: ELEMENT_LABEL[elementKey] ?? b.element ?? elementKey,
      class: CLASS_LABEL[classKey] ?? b.class ?? classKey,
      icons: b.icons ?? tmpl.FaceIconID ?? monsterId,
      stats: {
        def: interpolateRated(defMin, defMax, level, advDef),
        hp:  interpolateRated(hpMin, hpMax, level, advHp),
        atk: interpolateRated(atkMin, atkMax, level, advAtk),
        drPct: interpolate(0, drMax, level) / 10,
        buffResist: interpolate(brMin, brMax, level),
      },
    })
  }

  // Stable sort: name asc, then mode (consistency across modes for the same
  // boss), then level desc (latest stages first within a mode).
  stages.sort((a, b) => {
    const na = a.name.en ?? ''
    const nb = b.name.en ?? ''
    if (na !== nb) return na.localeCompare(nb)
    const ma = a.mode.en ?? ''
    const mb = b.mode.en ?? ''
    if (ma !== mb) return ma.localeCompare(mb)
    return b.level - a.level
  })

  const file: MonstersFile = { _v: SCHEMA_VERSION, stages }
  await writeJsonMin('monsters.json', file)

  return { stages: stages.length, skipped }
}
