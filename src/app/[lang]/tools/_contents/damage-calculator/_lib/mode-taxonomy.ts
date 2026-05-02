import type { DamageCalcStageEntry } from '@/lib/data/damage-calc'
import type { TranslationKey } from '@/i18n'

/**
 * Mode taxonomy for the public damage calculator's target picker.
 *
 * Calque the admin Damage Lab v2 — `MODE_GROUPS` defines the Category →
 * Mode tree, and `classifyMode` resolves a raw `DungeonMode` token to its
 * (categoryKey, subKey) pair. The bake (`monsters.json`) ships the raw
 * token via `ModeEntry.mode` so the same classifier works on both sides
 * without relying on localized strings.
 *
 * Some `DungeonMode` values (DM_TOWER_ELEMENT, DM_NORMAL) cover multiple
 * visible groups — `labelMatch` disambiguates by matching the resolved EN
 * mode label (Fire/Water/… for elements, Normal/Hard for story).
 *
 * Display fields hold i18n keys (typed as `TranslationKey`) that the
 * picker resolves via `t()` at render time. We reuse existing keys where
 * possible (`guides.category.*` for shared mode names, `sys.element.*`
 * for elemental tower sub-labels) and only define new keys under
 * `tools.damage-calculator.cat.*` / `.sub.*` for taxonomy-only labels.
 */

export interface SubMode {
  /** Raw `DungeonMode` token from `DungeonTemplet.DungeonMode`. */
  rawMode: string
  /** Optional regex on the localized EN mode label for groups that share a token. */
  labelMatch?: RegExp
  /** Translation key for the sub-mode display label (resolved via `t()`). */
  displayKey: TranslationKey
}

export interface ModeCategory {
  /** Translation key for the category label (resolved via `t()`). */
  categoryKey: TranslationKey
  modes: SubMode[]
}

export const MODE_GROUPS: ModeCategory[] = [
  {
    categoryKey: 'guides.category.special-request',
    modes: [
      { rawMode: 'DM_RAID_1', displayKey: 'tools.damage-calculator.sub.ecology_study' },
      { rawMode: 'DM_RAID_2', displayKey: 'tools.damage-calculator.sub.identification' },
    ],
  },
  {
    categoryKey: 'guides.category.adventure-license',
    modes: [
      { rawMode: 'DM_ADVENTURE_MISSION',   displayKey: 'tools.damage-calculator.sub.weekly_conquest' },
      { rawMode: 'DM_ADVENTURE_CHALLENGE', displayKey: 'tools.damage-calculator.sub.promotion' },
    ],
  },
  {
    categoryKey: 'tools.damage-calculator.cat.story',
    modes: [
      { rawMode: 'DM_NORMAL', labelMatch: /normal/i, displayKey: 'tools.damage-calculator.sub.normal' },
      { rawMode: 'DM_NORMAL', labelMatch: /hard/i,   displayKey: 'tools.damage-calculator.sub.hard' },
    ],
  },
  {
    categoryKey: 'tools.damage-calculator.cat.skyward_towers',
    modes: [
      { rawMode: 'DM_TOWER',           displayKey: 'tools.damage-calculator.sub.normal' },
      { rawMode: 'DM_TOWER_HARD',      displayKey: 'tools.damage-calculator.sub.hard' },
      { rawMode: 'DM_TOWER_VERY_HARD', displayKey: 'tools.damage-calculator.sub.very_hard' },
    ],
  },
  {
    categoryKey: 'tools.damage-calculator.cat.elemental_towers',
    modes: [
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /earth/i, displayKey: 'sys.element.earth' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /water/i, displayKey: 'sys.element.water' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /fire/i,  displayKey: 'sys.element.fire' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /light/i, displayKey: 'sys.element.light' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /dark/i,  displayKey: 'sys.element.dark' },
    ],
  },
  {
    categoryKey: 'guides.category.irregular-extermination',
    modes: [
      { rawMode: 'DM_IRREGULAR_CHASE',      displayKey: 'tools.damage-calculator.sub.pursuit' },
      { rawMode: 'DM_IRREGULAR_INFILTRATE', displayKey: 'tools.damage-calculator.sub.infiltration' },
    ],
  },
  {
    categoryKey: 'tools.damage-calculator.cat.temporary_modes',
    modes: [
      { rawMode: 'DM_GUILD_RAID_MAIN_BOSS', displayKey: 'guides.category.guild-raid' },
      { rawMode: 'DM_GUILD_RAID_SUB_BOSS',  displayKey: 'guides.category.guild-raid' },
      { rawMode: 'DM_WORLD_BOSS',           displayKey: 'guides.category.world-boss' },
      { rawMode: 'DM_EVENT_BOSS',           displayKey: 'guides.category.joint-challenge' },
    ],
  },
]

/**
 * Resolve a `(rawMode, labelEn)` pair → (categoryKey, subKey). Returns
 * null when the raw mode isn't in any group (e.g. a new mode the table
 * doesn't cover yet) — the picker surfaces those under no category.
 */
export function classifyMode(rawMode: string, labelEn?: string): { categoryKey: TranslationKey; subKey: TranslationKey } | null {
  for (const group of MODE_GROUPS) {
    for (const m of group.modes) {
      if (m.rawMode !== rawMode) continue
      if (m.labelMatch && (!labelEn || !m.labelMatch.test(labelEn))) continue
      return { categoryKey: group.categoryKey, subKey: m.displayKey }
    }
  }
  return null
}

/**
 * Parse a stage entry into `{ dungeonName, stagePart }`. Order of resolution:
 *   1. season + episodeNum present (story) → dungeonName = "EP {n}: {chapter}"
 *      and stagePart = "{episodeNum}-{stageNum}" (e.g. "1-3")
 *   2. "<base> (Stage N)"            → e.g. "Unidentified Chimera (Stage 1)"
 *   3. "<base> NF"                   → tower floors
 *   4. "<base> (Difficulty)"         → e.g. "Devanga (Hard)"
 *   5. fallback: the stage name itself becomes its own dungeon (no split)
 *
 * Operates on the EN field of the LangDict — picker labels are EN by
 * convention (mirrors the admin), display localization happens elsewhere
 * via `lRec(stage.name, lang)`.
 */
export function parseDungeonStage(stage: DamageCalcStageEntry): { dungeonName: string; stagePart: string } {
  if (stage.season != null && stage.episodeNum != null) {
    const dungeonName = stage.chapter?.en
      ? `EP ${stage.episodeNum}: ${stage.chapter.en}`
      : `EP ${stage.episodeNum}`
    const stagePart = stage.stageNum != null
      ? `${stage.episodeNum}-${stage.stageNum}`
      : (stage.name.en || stage.id)
    return { dungeonName, stagePart }
  }
  const n = stage.name.en || stage.id
  let m: RegExpMatchArray | null
  if ((m = n.match(/^(.+?)\s+\(Stage\s*(\d+)\)\s*$/)))            return { dungeonName: m[1], stagePart: `Stage ${m[2]}` }
  if ((m = n.match(/^(.+?)\s+(\d+)F\s*$/)))                       return { dungeonName: m[1], stagePart: `${m[2]}F` }
  if ((m = n.match(/^(.+?)\s+\((Normal|Hard|Very Hard)\)\s*$/i))) return { dungeonName: m[1], stagePart: m[2] }
  return { dungeonName: n, stagePart: n }
}
