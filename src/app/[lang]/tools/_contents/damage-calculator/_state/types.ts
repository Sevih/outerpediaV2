import type { DamageCalcCharDetail, DamageCalcMonsterStats } from '@/lib/data/damage-calc'

/**
 * Equipped passives for the attacker. Slugs reference entries in the baked
 * `equipment.json` catalog. Sets are split across two slots — same slug in
 * both = 4-pc bonus active; different slugs = each is a 2-pc bonus only.
 *
 * Stays per-attacker (not in account Settings) because the equipped loadout
 * is char-specific. Persistence will live in the URL when share-link ships.
 */
export interface EquipmentLoadout {
  weaponSlug:    string | null
  accessorySlug: string | null
  /** Two set slots (each = 2 armor pieces). Same set in both = 4-pc tier. */
  setSlots:      [string | null, string | null]
  talismanSlug:  string | null
  /** EE state — has its own toggle/level/variant since the picker is richer. */
  ee: {
    enabled: boolean
    /** Slug of the EE actually equipped — usually `self` for plain chars; CF
     *  chars can equip either their own EE or the base char's EE. */
    slug: string | null
    /** Enchant level 0-10. The buff catalog scales with this. */
    level: number
    /** For CF chars: which variant is equipped. Ignored otherwise. */
    variant: 'self' | 'base'
  }
}

export const INITIAL_LOADOUT: EquipmentLoadout = {
  weaponSlug: null,
  accessorySlug: null,
  setSlots: [null, null],
  talismanSlug: null,
  ee: { enabled: false, slug: null, level: 10, variant: 'self' },
}

/**
 * Calculator state. v1 keeps it flat and explicit — no nested
 * persistence layer yet. URL/localStorage sync ships in a follow-up.
 */

export type SkillSlot = 'S1' | 'S2' | 'S3'

/** Stat keys the UI exposes as editable inputs. */
export const STAT_KEYS = ['ATK', 'DEF', 'HP', 'SPD', 'CHC', 'CHD', 'EFF', 'RES', 'PEN', 'DMG_INC'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type StatValues = Record<StatKey, number>

export interface AttackerState {
  charId: string | null
  /** Lazy-loaded `chars/{id}.json` payload. Null until fetch resolves. */
  detail: DamageCalcCharDetail | null
  /** Inflight fetch indicator — drives a spinner on the panel header. */
  loading: boolean
  /** Editable stat block. Prefilled from `detail.baseStats.lv60_ev3` on char pick. */
  stats: StatValues
  skillSlot: SkillSlot
  /** Skill level 1..5 (binary's SkillLevelTemplet maxes at 5). */
  skillLevel: 1 | 2 | 3 | 4 | 5
  crit: boolean
  /** Current transcend tier — defaults to char's `BasicStar` at pick time. */
  transStar: number
  /** Picked equipment passives — feeds the future recompute pipeline. */
  equipment: EquipmentLoadout
}

/**
 * Account-wide settings persisted to localStorage. Codex + Quirks are
 * shared across every char (the in-game systems are global account-level
 * progression, not per-character).
 *
 * `dirty` tracks whether the user has manually edited stats — when true,
 * the auto-prefill effect (settings/transcend change) skips the recompute
 * to preserve manual edits. Clearing the char (or hitting reset) drops
 * back to auto-prefill mode.
 */
export interface SettingsState {
  /** 0 (no codex) → 11 (max). */
  codexLevel: number
  /**
   * Quirk gift categories — mirror in-game Gift menu groupings:
   *   - element:          AAT_ELEMENTAL nodes for the char's element
   *   - job:              AAT_CLASS + AAT_SUBCLASS nodes (in-game "Class" tab)
   *   - pve:              AwakeningType=PVE (Counteract Strong Enemies)
   *   - adventureLicense: AwakeningType=ADVENTURE_LICENSE (mode-gated)
   *
   * Only `element` + `job` contribute stat-sheet values today. `pve` and
   * `adventureLicense` are pure BT_DMG runtime modifiers — persisted now
   * so they can drive the recompute pipeline once it ships, but they don't
   * change the prefilled stats grid until then.
   */
  quirks: {
    element: boolean
    job: boolean
    pve: boolean
    adventureLicense: boolean
  }
}

/**
 * Picked target for the damage formula.
 *
 * Two acquisition modes share the same panel:
 *   - `cascade` — pick a stage + monster from the baked catalog. Stat block
 *     is the bake's at-level resolution.
 *   - `manual`  — type stats directly. Useful for cases the bake doesn't
 *     cover yet, hypothetical bosses, or when the user wants to perturb
 *     a real monster's stat block ("what if HP were +20%?"). Manual state
 *     is kept independent of the cascade selection so toggling between
 *     the two modes is non-destructive.
 *
 * `stageId`   = `DungeonTemplet.ID`
 * `monsterId` = `MonsterTemplet.ID`
 */
export type TargetMode = 'cascade' | 'manual'

/**
 * Free-form target description. `element` drives element advantage, `isBoss`
 * gates PVE awakening triggers; everything else is the raw stat block the
 * damage formula will consume. Class / level intentionally absent — the UI
 * is stat-centric and these add noise without changing the math today.
 */
export interface ManualTargetState {
  isBoss: boolean
  /** Fire / Water / Earth / Light / Dark — must match the icon-file convention. */
  element: string
  stats: DamageCalcMonsterStats
}

export interface TargetState {
  mode: TargetMode
  stageId: string | null
  monsterId: string | null
  manual: ManualTargetState
}

export const INITIAL_MANUAL: ManualTargetState = {
  isBoss: true,
  element: 'Fire',
  stats: {
    hp: 1_000_000, atk: 8000, def: 2000, spd: 100,
    chc: 5, chd: 150, pen: 0, dmgInc: 0, dmgRed: 0,
    eff: 0, res: 0,
  },
}

export const INITIAL_TARGET: TargetState = {
  mode: 'cascade',
  stageId: null,
  monsterId: null,
  manual: { ...INITIAL_MANUAL, stats: { ...INITIAL_MANUAL.stats } },
}

export interface CalcState {
  attacker: AttackerState
  target: TargetState
  settings: SettingsState
  /**
   * `true` when the user has typed in the stats grid since the last
   * char-pick / reset. Auto-prefill (settings or transcend change) is
   * skipped while dirty so the user's edits survive.
   */
  statsDirty: boolean
}

export const INITIAL_STATS: StatValues = {
  ATK: 0, DEF: 0, HP: 0, SPD: 0,
  CHC: 5, CHD: 150,
  EFF: 0, RES: 0, PEN: 0, DMG_INC: 0,
}

export const INITIAL_SETTINGS: SettingsState = {
  // Default to fully-progressed account — most calc users want their realistic
  // ingame stats, and a fresh account user can dial it back via Settings.
  codexLevel: 11,
  quirks: { element: true, job: true, pve: true, adventureLicense: true },
}

export const INITIAL_STATE: CalcState = {
  attacker: {
    charId: null,
    detail: null,
    loading: false,
    stats: { ...INITIAL_STATS },
    skillSlot: 'S1',
    skillLevel: 5,
    crit: false,
    transStar: 0,
    equipment: { ...INITIAL_LOADOUT, setSlots: [...INITIAL_LOADOUT.setSlots], ee: { ...INITIAL_LOADOUT.ee } },
  },
  target: { ...INITIAL_TARGET, manual: { ...INITIAL_MANUAL, stats: { ...INITIAL_MANUAL.stats } } },
  settings: { ...INITIAL_SETTINGS, quirks: { ...INITIAL_SETTINGS.quirks } },
  statsDirty: false,
}
