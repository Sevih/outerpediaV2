import { loadJson2 } from './raw-loader'
import { LANGS, type Lang } from '../../../src/lib/i18n/config'

/**
 * Pipeline-local copy of the dungeon location resolvers used by the damage
 * calc bake. Originally lived in
 * `src/app/api/admin/extractor-v3/monster/lib/location.ts`, but the admin
 * tree is excluded from prod builds — importing across that boundary breaks
 * `npm run pipeline` on the deploy host. This file ships only the bits
 * `build-monsters.ts` actually consumes (text + area indexes, mode-label
 * resolution) and reads json2 through the pipeline's own `loadJson2`
 * (async, dedup-cached) instead of the admin module's sync `loadTable`.
 *
 * Keep in sync with the admin copy when label conventions change — both
 * resolvers should produce identical strings since the public picker
 * mirrors the admin Damage Lab v2 cascade.
 */

export type LangDict = { en: string; jp: string; kr: string; zh: string }

type Row = Record<string, string | undefined>

const LANG_COLUMNS: Record<Lang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
}

// ── Mode label resolution ────────────────────────────────────────────
//
// Labels come from TextSystem, never from hardcoded strings. Strategies:
//   1. Tower modes (DM_TOWER, DM_TOWER_HARD, DM_TOWER_VERY_HARD,
//      DM_TOWER_ELEMENT) — every floor is its own dungeon with a NameID
//      like `SYS_INFINITE_DUNGEON_*` that resolves to "X NF". Strip the
//      floor suffix to get the section title.
//   2. Story (DM_NORMAL) — split by AreaTemplet.AreaGroupType (NORMAL/HARD).
//   3. Everything else — small map of mode → canonical TextSystem key.

const MODE_TEXT_KEYS: Record<string, string> = {
  DM_ADVENTURE_MISSION: 'SYS_ADVENTURE_LICENSE',
  DM_ADVENTURE_CHALLENGE: 'SYS_ADVENTURE_CHALLENGE',
  DM_RAID_1: 'SYS_PVE_RAID_A',
  DM_RAID_2: 'SYS_PVE_RAID_B',
  DM_EVENT_BOSS: 'SYS_EVENT_BOSS_TITLE',
  DM_GUILD_RAID_MAIN_BOSS: 'SYS_GUILD_RAID_TITLE',
  DM_GUILD_RAID_SUB_BOSS: 'SYS_GUILD_RAID_TITLE',
  DM_IRREGULAR_INFILTRATE: 'SYS_IRR_INFILTREATE_NAME_01',
  DM_IRREGULAR_CHASE: 'SYS_IRR_CHASE_NAME_01',
  DM_WORLD_BOSS: 'SYS_WORLD_BOSS',
}

const TOWER_MODES = new Set([
  'DM_TOWER',
  'DM_TOWER_HARD',
  'DM_TOWER_VERY_HARD',
  'DM_TOWER_ELEMENT',
])

const FLOOR_SUFFIX_RE = /\s*第?\s*\d+\s*(?:F|階|층|层|楼|樓)\s*$/

const STORY_NORMAL_KEY = 'SYS_ADVENTURE_NORMAL'
const STORY_HARD_KEY = 'SYS_ADVENTURE_HARD'

function langDict(entry: Row | undefined): LangDict {
  const out: LangDict = { en: '', jp: '', kr: '', zh: '' }
  if (!entry) return out
  for (const lang of LANGS) {
    const raw = entry[LANG_COLUMNS[lang]] ?? ''
    out[lang] = raw.trim().replace(/[‘’]/g, "'")
  }
  return out
}

function lookupDict(textIndex: Map<string, Row>, key: string): LangDict {
  return langDict(textIndex.get(key))
}

function stripFloorSuffix(s: string): string {
  return s.replace(FLOOR_SUFFIX_RE, '').trim()
}

/**
 * Resolve a mode label as a `{ en, jp, kr, zh }` dict. For tower modes,
 * derives the section title from the dungeon's per-floor NameID by
 * stripping the floor suffix in each language.
 */
export function resolveModeLabelDict(
  mode: string,
  areaGroupType: string | null,
  dungeonNameId: string | null,
  textIndex: Map<string, Row>,
): LangDict | null {
  if (mode === 'DM_NORMAL') {
    if (areaGroupType === 'AGT_HARD') return lookupDict(textIndex, STORY_HARD_KEY)
    if (areaGroupType === 'AGT_NORMAL') return lookupDict(textIndex, STORY_NORMAL_KEY)
    return null
  }
  if (TOWER_MODES.has(mode)) {
    if (!dungeonNameId) return null
    const floor = lookupDict(textIndex, dungeonNameId)
    const out: LangDict = { en: '', jp: '', kr: '', zh: '' }
    for (const lang of LANGS) out[lang] = stripFloorSuffix(floor[lang])
    return out.en ? out : null
  }
  const key = MODE_TEXT_KEYS[mode]
  return key ? lookupDict(textIndex, key) : null
}

/** Resolve a TextSystem key into a LangDict (helper for callers). */
export function resolveTextDict(key: string | null, textIndex: Map<string, Row>): LangDict {
  if (!key) return { en: '', jp: '', kr: '', zh: '' }
  return lookupDict(textIndex, key)
}

/** All raw DungeonMode values currently supported by the picker. */
export const SUPPORTED_DUNGEON_MODES: string[] = [
  'DM_NORMAL',
  'DM_ADVENTURE_MISSION',
  'DM_ADVENTURE_CHALLENGE',
  'DM_RAID_1',
  'DM_RAID_2',
  'DM_EVENT_BOSS',
  'DM_TOWER',
  'DM_TOWER_HARD',
  'DM_TOWER_VERY_HARD',
  'DM_TOWER_ELEMENT',
  'DM_GUILD_RAID_MAIN_BOSS',
  'DM_GUILD_RAID_SUB_BOSS',
  'DM_IRREGULAR_INFILTRATE',
  'DM_IRREGULAR_CHASE',
  'DM_WORLD_BOSS',
]

// ── Indexes ──────────────────────────────────────────────────────────

export type LocationTables = {
  textSystemIndex: Map<string, Row>
  areaIndex: Map<string, Row>
}

let cached: LocationTables | null = null

/**
 * Load and index TextSystem + AreaTemplet — the only two tables the bake
 * actually consumes. Memoized for the rest of the pipeline run.
 */
export async function loadLocationTables(): Promise<LocationTables> {
  if (cached) return cached
  const [textRows, areaRows] = await Promise.all([
    loadJson2<Row[]>('TextSystem.json'),
    loadJson2<Row[]>('AreaTemplet.json'),
  ])
  const textSystemIndex = new Map<string, Row>()
  for (const r of textRows) if (r.ID) textSystemIndex.set(r.ID, r)
  const areaIndex = new Map<string, Row>()
  for (const r of areaRows) if (r.ID) areaIndex.set(r.ID, r)
  cached = { textSystemIndex, areaIndex }
  return cached
}
