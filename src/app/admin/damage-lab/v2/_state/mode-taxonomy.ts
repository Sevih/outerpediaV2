/**
 * Damage Lab v2 — mode taxonomy + stage parser.
 *
 * Ported from `src/app/admin/damage-lab/page.tsx` (v1) verbatim so the v2
 * picker exposes the same Category → Mode → [Season] → Dungeon → Stage cascade
 * users are familiar with. Kept as its own module (rather than re-exporting
 * from v1) to honour the v2 compartmentalization rule.
 */

import type { ModeEntry, StageEntry } from '../_api/monsters'

/**
 * `rawMode` matches DungeonTemplet.DungeonMode. `labelMatch` is an optional
 * regex run against the resolved English label to disambiguate modes that
 * share a DungeonMode but render as several visible groups (towers' element
 * variants, story Normal/Hard). `display` is the label shown in the sub-mode
 * dropdown.
 */
export interface SubMode { rawMode: string; labelMatch?: RegExp; display: string }
export interface ModeCategory { category: string; modes: SubMode[] }

export const MODE_GROUPS: ModeCategory[] = [
  {
    category: 'Special Request',
    modes: [
      { rawMode: 'DM_RAID_1', display: 'Ecology Study (Armor)' },
      { rawMode: 'DM_RAID_2', display: 'Identification (Weapon)' },
    ],
  },
  {
    category: 'Adventure License',
    modes: [
      { rawMode: 'DM_ADVENTURE_MISSION',   display: 'Weekly Conquest' },
      { rawMode: 'DM_ADVENTURE_CHALLENGE', display: 'Promotion' },
    ],
  },
  {
    category: 'Story',
    modes: [
      { rawMode: 'DM_NORMAL', labelMatch: /normal/i, display: 'Normal' },
      { rawMode: 'DM_NORMAL', labelMatch: /hard/i,   display: 'Hard' },
    ],
  },
  {
    category: 'Skyward Towers',
    modes: [
      { rawMode: 'DM_TOWER',           display: 'Normal' },
      { rawMode: 'DM_TOWER_HARD',      display: 'Hard' },
      { rawMode: 'DM_TOWER_VERY_HARD', display: 'Very Hard' },
    ],
  },
  {
    category: 'Elemental Towers',
    modes: [
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /earth/i, display: 'Earth' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /water/i, display: 'Water' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /fire/i,  display: 'Fire' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /light/i, display: 'Light' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /dark/i,  display: 'Dark' },
    ],
  },
  {
    category: 'Irregular Extermination',
    modes: [
      { rawMode: 'DM_IRREGULAR_CHASE',      display: 'Pursuit' },
      { rawMode: 'DM_IRREGULAR_INFILTRATE', display: 'Infiltration' },
    ],
  },
  {
    category: 'Temporary Mode',
    modes: [
      { rawMode: 'DM_GUILD_RAID_MAIN_BOSS', display: 'Guild Raid' },
      { rawMode: 'DM_GUILD_RAID_SUB_BOSS',  display: 'Guild Raid' },
      { rawMode: 'DM_WORLD_BOSS',           display: 'World Boss' },
      { rawMode: 'DM_EVENT_BOSS',           display: 'Joint Challenge' },
    ],
  },
]

/**
 * Resolve a ModeEntry → (category, subDisplay). Returns null when the mode
 * doesn't fit any defined group (e.g. unmapped DungeonMode).
 */
export function classifyMode(entry: ModeEntry): { category: string; sub: string } | null {
  for (const group of MODE_GROUPS) {
    for (const m of group.modes) {
      if (m.rawMode !== entry.mode) continue
      if (m.labelMatch && !m.labelMatch.test(entry.label)) continue
      return { category: group.category, sub: m.display }
    }
  }
  return null
}

/**
 * Parse a stage entry into { dungeonName, stagePart }. Order of resolution:
 *   1. season+episodeNum present (story)  → dungeonName = "EP {n}: {chapter}"
 *      and stagePart = "{episodeNum}-{stageNum}" (e.g. "1-3")
 *   2. "<base> (Stage N)"            → e.g. "Unidentified Chimera (Stage 1)"
 *   3. "<base> NF"                   → tower floors
 *   4. "<base> (Difficulty)"         → e.g. "Devanga (Hard)"
 *   5. fallback: the stage name itself becomes its own dungeon (no split).
 */
export function parseDungeonStage(stage: StageEntry): { dungeonName: string; stagePart: string } {
  if (stage.season != null && stage.episodeNum != null) {
    const dungeonName = stage.chapter
      ? `EP ${stage.episodeNum}: ${stage.chapter}`
      : `EP ${stage.episodeNum}`
    const stagePart = stage.stageNum != null
      ? `${stage.episodeNum}-${stage.stageNum}`
      : stage.name
    return { dungeonName, stagePart }
  }
  const n = stage.name
  let m: RegExpMatchArray | null
  if ((m = n.match(/^(.+?)\s+\(Stage\s*(\d+)\)\s*$/)))     return { dungeonName: m[1], stagePart: `Stage ${m[2]}` }
  if ((m = n.match(/^(.+?)\s+(\d+)F\s*$/)))                return { dungeonName: m[1], stagePart: `${m[2]}F` }
  if ((m = n.match(/^(.+?)\s+\((Normal|Hard|Very Hard)\)\s*$/i))) return { dungeonName: m[1], stagePart: m[2] }
  return { dungeonName: n, stagePart: n }
}
