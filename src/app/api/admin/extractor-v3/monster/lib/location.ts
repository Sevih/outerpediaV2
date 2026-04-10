import { loadTable, indexBy, num, langDict, getLangTexts, type Row, type LangDict } from './common'
import { LANGS } from '@/lib/i18n/config'

// ── Mode label resolution ────────────────────────────────────────────
//
// Labels come from TextSystem, never from hardcoded strings. Two
// strategies are used:
//
// 1. Tower modes (DM_TOWER, DM_TOWER_HARD, DM_TOWER_VERY_HARD,
//    DM_TOWER_ELEMENT) — every floor is its own dungeon with a NameID
//    like `SYS_INFINITE_DUNGEON_*` that resolves to "X NF". Strip the
//    floor suffix to get the section title. This handles elemental
//    decomposition automatically (Fire Tower / Water Tower / ...).
//
// 2. Story (DM_NORMAL) — split by AreaTemplet.AreaGroupType (NORMAL/HARD).
//
// 3. Everything else — a small map of mode → canonical TextSystem key.

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

function lookup(textIndex: Map<string, Row>, key: string): string | null {
  return textIndex.get(key)?.English ?? null
}

export function resolveModeLabel(
  mode: string,
  areaGroupType: string | null,
  dungeonNameId: string | null,
  textIndex: Map<string, Row>
): string | null {
  if (mode === 'DM_NORMAL') {
    if (areaGroupType === 'AGT_HARD') return lookup(textIndex, STORY_HARD_KEY)
    if (areaGroupType === 'AGT_NORMAL') return lookup(textIndex, STORY_NORMAL_KEY)
    return null
  }
  if (TOWER_MODES.has(mode)) {
    if (!dungeonNameId) return null
    const floorName = lookup(textIndex, dungeonNameId)
    if (!floorName) return null
    return floorName.replace(FLOOR_SUFFIX_RE, '').trim()
  }
  const key = MODE_TEXT_KEYS[mode]
  return key ? lookup(textIndex, key) : null
}

// ── Multi-language label resolution (wiki dict format) ───────────────
//
// Strip a trailing "floor token" from a localized dungeon name. Per language:
//   EN: "Skyward Tower: Very Hard 3F"   → drop ` 3F`
//   JP: "飛天の塔【ベリーハード】3階"     → drop `3階` (no space)
//   KR: "비천의 탑 [베리 하드] 3층"      → drop ` 3층`
//   ZH: "飞天之塔【极难】第3层"          → drop `第3层` (no space, with prefix 第)
//
// The regex matches an optional separator (space or 第), then digits, then
// any of the floor markers (F / 階 / 층 / 层 / 楼 / 樓), at end of string.
function stripFloorSuffix(s: string): string {
  return s.replace(FLOOR_SUFFIX_RE, '').trim()
}

function lookupDict(textIndex: Map<string, Row>, key: string): LangDict {
  return langDict(getLangTexts(textIndex.get(key)))
}

/**
 * Resolve a mode label as a `{ en, jp, kr, zh }` dict.
 * For tower modes, derives the section title from the dungeon's
 * per-floor NameID by stripping the floor suffix in each language.
 */
export function resolveModeLabelDict(
  mode: string,
  areaGroupType: string | null,
  dungeonNameId: string | null,
  textIndex: Map<string, Row>
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
    for (const lang of LANGS) {
      out[lang] = stripFloorSuffix(floor[lang])
    }
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

/** All raw DungeonMode values currently supported. */
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
//
// Important: DungeonTemplet.SpawnID_Pos0/1/2 references
// DungeonSpawnTemplet.**GroupID** (NOT .ID). A single GroupID can have
// multiple spawn rows (e.g. multi-stage bosses with several HP bars).

export type SpawnRef = {
  groupId: string
  slot: number // 0..3 — ID0/ID1/ID2/ID3 in DungeonSpawnTemplet
  level: number // Level0..Level3
  spawnRowId: string // DungeonSpawnTemplet.ID
  hpLineCount: number
}

export type DungeonRef = {
  dungeon: Row
  position: number // 0..2 — SpawnID_Pos0/1/2 in DungeonTemplet
}

export type LocationTables = {
  groupsByMonster: Map<string, SpawnRef[]>
  dungeonsByGroup: Map<string, DungeonRef[]>
  textSystemIndex: Map<string, Row>
  areaIndex: Map<string, Row>
  /** dungeonId → Grade (used to substitute `{0}` in Guild Raid dungeon names). */
  dungeonGradeMap: Map<string, string>
}

let cached: LocationTables | null = null

export function loadLocationTables(): LocationTables {
  if (cached) return cached

  const spawns = loadTable('DungeonSpawnTemplet')
  const dungeons = loadTable('DungeonTemplet')

  // monsterId → groups it appears in
  const groupsByMonster = new Map<string, SpawnRef[]>()
  for (const s of spawns) {
    const groupId = s.GroupID
    if (!groupId) continue
    for (let slot = 0; slot < 4; slot++) {
      const mid = s[`ID${slot}`]
      if (!mid || mid === '0') continue
      let arr = groupsByMonster.get(mid)
      if (!arr) {
        arr = []
        groupsByMonster.set(mid, arr)
      }
      arr.push({
        groupId,
        slot,
        level: num(s[`Level${slot}`]),
        spawnRowId: s.ID,
        hpLineCount: num(s.HPLineCount),
      })
    }
  }

  // groupId → dungeons referencing it via SpawnID_Pos0/1/2
  const dungeonsByGroup = new Map<string, DungeonRef[]>()
  for (const d of dungeons) {
    for (let position = 0; position < 3; position++) {
      const raw = d[`SpawnID_Pos${position}`]
      if (!raw) continue
      for (const gid of raw.split(',').map((x) => x.trim()).filter(Boolean)) {
        let arr = dungeonsByGroup.get(gid)
        if (!arr) {
          arr = []
          dungeonsByGroup.set(gid, arr)
        }
        arr.push({ dungeon: d, position })
      }
    }
  }

  // ── Bridges from auxiliary tables ─────────────────────────────────
  //
  // Some game modes don't link bosses to dungeons via DungeonSpawnTemplet.
  // Instead, dedicated tables expose `BossID + DungeonID` (or similar)
  // pairs. We synthesize fake group IDs to plug these into the same map.
  const dungeonIndex = indexBy(dungeons)

  function bridgeMonsterToDungeon(monsterId: string, dungeonId: string, sourceTag: string) {
    const dungeon = dungeonIndex.get(dungeonId)
    if (!dungeon) return
    const syntheticGroup = `__${sourceTag}_${dungeonId}`
    let mg = groupsByMonster.get(monsterId)
    if (!mg) {
      mg = []
      groupsByMonster.set(monsterId, mg)
    }
    mg.push({ groupId: syntheticGroup, slot: 0, level: 0, spawnRowId: '', hpLineCount: 0 })
    let dg = dungeonsByGroup.get(syntheticGroup)
    if (!dg) {
      dg = []
      dungeonsByGroup.set(syntheticGroup, dg)
    }
    dg.push({ dungeon, position: 0 })
  }

  // 1. World Boss League — every WBL row defines:
  //      - Level (1..4) which maps to a "New League" name in TextSystem
  //        (Normal / Hard / Very Hard / Extreme League). The wiki uses this
  //        label as the dungeon name, NOT the raw DungeonTemplet NameID.
  //      - BossID (the main boss for that league level)
  //      - ChangeSpawnGroupID (CSV) for the supplementary phase-2 spawn groups
  //
  //    We synthesize a fake dungeon row per WBL row carrying the league
  //    NameID, and bridge both the BossID and the ChangeSpawnGroupIDs to it.
  const wblFakeDungeons = new Map<string, Row>()
  for (const r of loadTable('WorldBossLeagueTemplet')) {
    const baseDungeonId = r.DungeonID
    const level = r.Level
    if (!baseDungeonId || !level) continue
    const baseDungeon = dungeonIndex.get(baseDungeonId)
    if (!baseDungeon) continue
    const fakeId = `__wbl_${baseDungeonId}_lv${level}`
    let fake = wblFakeDungeons.get(fakeId)
    if (!fake) {
      fake = {
        ...baseDungeon,
        ID: fakeId,
        // Override NameID with the league title (Normal/Hard/Very Hard/Extreme)
        NameID: `SYS_WORLD_BOSS_LEAGUE_NEW_${level}`,
      }
      wblFakeDungeons.set(fakeId, fake)
    }

    // The boss already has a real spawn pointing at the WBL DungeonID. Walk
    // its existing groups and rewrite any dungeon ref that matches the WBL
    // DungeonID to use the fake dungeon (so the league label wins over the
    // raw dungeon name).
    if (r.BossID) {
      const bossGroups = groupsByMonster.get(r.BossID) ?? []
      let patched = false
      for (const g of bossGroups) {
        const refs = dungeonsByGroup.get(g.groupId)
        if (!refs) continue
        for (let i = 0; i < refs.length; i++) {
          if (refs[i].dungeon.ID === baseDungeonId) {
            refs[i] = { dungeon: fake, position: refs[i].position }
            patched = true
          }
        }
      }
      // Fallback: if no real spawn matched, plug as a synthetic group so the
      // boss still gets the league label.
      if (!patched) {
        const syntheticGroup = `__wbl_boss_${r.ID}`
        let mg = groupsByMonster.get(r.BossID)
        if (!mg) {
          mg = []
          groupsByMonster.set(r.BossID, mg)
        }
        mg.push({ groupId: syntheticGroup, slot: 0, level: 0, spawnRowId: '', hpLineCount: 0 })
        let dg = dungeonsByGroup.get(syntheticGroup)
        if (!dg) {
          dg = []
          dungeonsByGroup.set(syntheticGroup, dg)
        }
        dg.push({ dungeon: fake, position: 0 })
      }
    }

    // Plug each phase-2 spawn group, similarly preferring the fake dungeon.
    if (r.ChangeSpawnGroupID) {
      for (const gid of r.ChangeSpawnGroupID.split(',').map((x) => x.trim()).filter(Boolean)) {
        const refs = dungeonsByGroup.get(gid)
        if (refs && refs.length > 0) {
          // Replace any ref pointing at the base dungeon with the fake one.
          for (let i = 0; i < refs.length; i++) {
            if (refs[i].dungeon.ID === baseDungeonId) {
              refs[i] = { dungeon: fake, position: refs[i].position }
            }
          }
        } else {
          dungeonsByGroup.set(gid, [{ dungeon: fake, position: 0 }])
        }
      }
    }
  }

  // 2. Pursuit Operation — IrregularChaseTemplet has BossID → DungeonID
  for (const r of loadTable('IrregularChaseTemplet')) {
    if (!r.BossID || !r.DungeonID) continue
    bridgeMonsterToDungeon(r.BossID, r.DungeonID, 'irrchase')
  }

  // 3. Joint Challenge — EventBossDungeonTemplet has BossID → DungeonID (CSV)
  for (const r of loadTable('EventBossDungeonTemplet')) {
    if (!r.BossID || !r.DungeonID) continue
    for (const did of r.DungeonID.split(',').map((x) => x.trim()).filter(Boolean)) {
      bridgeMonsterToDungeon(r.BossID, did, 'eventboss')
    }
  }

  // 4. Wave-2+ heuristic — secondary spawn groups (e.g. minion waves) are not
  //    referenced by any DungeonTemplet, but their "wave 1" sibling is. The
  //    convention is that group IDs share a prefix and only differ by the last
  //    digit (e.g. 706000001 = boss, 706000002/...3/...4 = follow-up waves).
  //    For each orphan group, try the `<prefix>1` form and reuse its dungeons.
  const allGroupIds = new Set<string>()
  for (const refs of groupsByMonster.values()) {
    for (const r of refs) allGroupIds.add(r.groupId)
  }
  for (const groupId of allGroupIds) {
    if (dungeonsByGroup.has(groupId)) continue
    if (groupId.length < 2) continue
    const lastDigit = groupId[groupId.length - 1]
    if (lastDigit === '1' || !/\d/.test(lastDigit)) continue
    const wave1 = groupId.slice(0, -1) + '1'
    const wave1Dungeons = dungeonsByGroup.get(wave1)
    if (!wave1Dungeons || wave1Dungeons.length === 0) continue
    dungeonsByGroup.set(groupId, [...wave1Dungeons])
  }

  // Guild Raid stage map — dungeon names like "Guardian of the Golden Land
  // (Stage {0})" are shared across grades; we substitute `{0}` with the grade
  // from GuildRaidGradeTemplet.
  const dungeonGradeMap = new Map<string, string>()
  for (const r of loadTable('GuildRaidGradeTemplet')) {
    if (r.BossDungeonID && r.Grade) dungeonGradeMap.set(r.BossDungeonID, r.Grade)
  }

  cached = {
    groupsByMonster,
    dungeonsByGroup,
    textSystemIndex: indexBy(loadTable('TextSystem')),
    areaIndex: indexBy(loadTable('AreaTemplet')),
    dungeonGradeMap,
  }
  return cached
}

// ── Output ───────────────────────────────────────────────────────────

export type MonsterLocation = {
  mode: string // raw DungeonMode
  modeLabel: string // UI label
  dungeonId: string
  dungeonNameId: string | null
  dungeonName: string | null // English
  areaId: string | null
  areaName: string | null // English
  position: number // 0..2
  slot: number // 0..3 (which IDx in the spawn formation)
  level: number
  groupId: string
  spawnRowId: string
  hpLineCount: number
}

/**
 * Find every (supported) location where the monster spawns.
 * Returns an empty array if the monster doesn't appear anywhere
 * supported (test dungeons, PvP, monad gate, side story… are filtered).
 */
export function findMonsterLocations(monsterId: string, t?: LocationTables): MonsterLocation[] {
  const tables = t ?? loadLocationTables()
  const groups = tables.groupsByMonster.get(monsterId)
  if (!groups || groups.length === 0) return []

  const out: MonsterLocation[] = []

  for (const g of groups) {
    const dungeonRefs = tables.dungeonsByGroup.get(g.groupId)
    if (!dungeonRefs) continue

    for (const { dungeon, position } of dungeonRefs) {
      const mode = dungeon.DungeonMode ?? ''
      const areaId = dungeon.AreaID ?? null
      const areaRow = areaId ? tables.areaIndex.get(areaId) : undefined
      const areaGroupType = areaRow?.AreaGroupType ?? null

      const dungeonNameId = dungeon.NameID ?? null
      const modeLabel = resolveModeLabel(mode, areaGroupType, dungeonNameId, tables.textSystemIndex)
      if (!modeLabel) continue

      const dungeonName = dungeonNameId
        ? tables.textSystemIndex.get(dungeonNameId)?.English ?? null
        : null

      const areaName = areaRow?.NameID
        ? tables.textSystemIndex.get(areaRow.NameID)?.English ?? null
        : null

      out.push({
        mode,
        modeLabel,
        dungeonId: dungeon.ID,
        dungeonNameId,
        dungeonName,
        areaId,
        areaName,
        position,
        slot: g.slot,
        level: g.level,
        groupId: g.groupId,
        spawnRowId: g.spawnRowId,
        hpLineCount: g.hpLineCount,
      })
    }
  }

  // For World Boss League entries, prefer the highest league level when a
  // boss appears in several leagues (e.g. boss2 variants like 4086018 spawn
  // in both Very Hard and Extreme phase-2 groups; the wiki tracks Extreme).
  out.sort((a, b) => wblLevel(b.dungeonNameId) - wblLevel(a.dungeonNameId))

  return out
}

// Extract the league level from a fake WBL dungeon NameID, or 0 otherwise.
function wblLevel(nameId: string | null): number {
  if (!nameId) return 0
  const m = nameId.match(/^SYS_WORLD_BOSS_LEAGUE_NEW_(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}
