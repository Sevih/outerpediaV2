// Shared types for the effects classifier (characters + monsters).

export type BuffRow = Record<string, string>

export type TooltipEntry = {
  name: string
  isDebuff: boolean
}

/** Minimal set of tables the classifier needs. Callers build & pass these. */
export type EffectTables = {
  /** BuffID → all BuffTemplet rows (all levels). */
  buffsByID: Map<string, BuffRow[]>
  /** TooltipID → { name (UPPERCASE_UNDERSCORES), isDebuff }. */
  tooltipMap: Map<string, TooltipEntry>
}

export type EffectContext = {
  /** charID or monsterID — used for forced overrides lookup. */
  ownerId: string
  /**
   * Optional human-readable scope. When set, the classifier looks up
   * forced-overrides under these keys (most-specific first) before
   * falling back to `ownerId`:
   *   1. `${ownerName}|${dungeonName}` — exact dungeon variant
   *   2. `${ownerName}|${modeName}`    — entire mode (e.g. all floors
   *      of "Special Request: Ecology Study" share the rule)
   * This lets wiki authors curate overrides with real game names.
   */
  ownerName?: string
  dungeonName?: string
  modeName?: string
  /** SKT_FIRST / SKT_SECOND / SKT_ULTIMATE / SKT_CHAIN_PASSIVE / SKT_MONSTER_1 / ... */
  skillType: string
  tables: EffectTables
  /**
   * Tooltip IDs parsed from `SkillLevelTemplet.BuffToolTip` — appended as
   * discovered buffs/debuffs via the tooltip map (non-blacklisted only).
   */
  tooltipIds?: string[]
  /**
   * Resolved English skill description. When set, the classifier runs
   * `description-patterns.json` regexes against it to add buffs/debuffs
   * that can't be modeled from BuffTemplet alone.
   */
  description?: string
  /**
   * Labels unconditionally added to the result (before forced overrides).
   * Typically used by the character extractor for description-derived
   * effects (e.g. BT_WG_REVERSE_HEAL from `SE_DESC_DMG_WG_V`).
   */
  extraBuffs?: string[]
  extraDebuffs?: string[]
  /**
   * Optional predicate for caller-specific row filtering, applied on top
   * of the classifier's own generic filters.
   * Return true to KEEP the row, false to drop it.
   */
  rowFilter?: (row: BuffRow) => boolean
  /**
   * How to apply forced overrides from `forced-overrides.json`:
   *   - 'full' (default): add buff/debuff AND remove
   *   - 'remove-only': only apply removeBuff/removeDebuff
   *   - 'none': skip entirely
   * `remove-only` is used by chain passive DUAL attack which inherits the
   * main chain forced removes but not the additions.
   */
  forcedOverridesMode?: 'full' | 'remove-only' | 'none'
}

export type EffectResult = {
  buffs: string[]
  debuffs: string[]
  removeBuff: string[]
  removeDebuff: string[]
}
