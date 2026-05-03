import type { DamageCalcCharDetail, DamageCalcMonsterStats } from '@/lib/data/damage-calc'
import { makeDefaultExternalBuffsState, type ExternalBuffState } from '@/lib/damage/v2/external-buffs'
import type { BossMechanicState, BossOverride } from '@/lib/damage/v2/boss-overrides'

/**
 * ATK scaling breakdown — shape consumed by `recompute()`'s `replayStatWithBuff`.
 * Stored on the attacker so external ATK% buffs can stack ADDITIVELY into the
 * permanent %-layer (matching in-game) instead of multiplicatively on the
 * displayed ATK. Computed at auto-prefill time from `noGearStats`; cleared on
 * any manual ATK edit so the formula falls back to linear scaling.
 */
export interface StatScaling {
  baseMax: number
  flat: number
  pctBonus: number
  codexPct: number
  transcendPct: number
}

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

/** Stat keys the UI exposes as editable inputs. EFF/RES live at the end
 *  because they're flat (not %) like monster stats — see grid render
 *  ordering in `AttackerPanel`. */
export const STAT_KEYS = ['ATK', 'DEF', 'HP', 'SPD', 'CHC', 'CHD', 'PEN', 'DMG_INC', 'EFF', 'RES'] as const
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
  /**
   * Burst level 0..3 — `0` = no burst (cast S3 base), `1`/`2`/`3` = cast
   * the matching burst variant (replaces S3's DF + buff list). Only meaningful
   * when `skillSlot === 'S3'`; for S1/S2 the field stays at 0 in state but
   * the recompute pipeline ignores it. Gating: a level is selectable only
   * when the dealer's transcend tier exposes the corresponding `burst2` /
   * `burst3` unlock flag (Burst Lv 1 is always available when bursts exist
   * for the char, since the chain inherently starts at B1).
   */
  burstLevel: 0 | 1 | 2 | 3
  crit: boolean
  /** Current transcend tier — defaults to char's `BasicStar` at pick time. */
  transStar: number
  /** Picked equipment passives — feeds the future recompute pipeline. */
  equipment: EquipmentLoadout
  /** Conditional damage modifiers (target debuffs, lost HP %, kill stacks…). */
  conditional: ConditionalModifiers
  /**
   * ATK breakdown for additive external-buff stacking — set by the auto-prefill
   * effect alongside the resolved stats, cleared on manual ATK edit so the
   * formula falls back to linear `× (1 + buff/100)`.
   */
  atkScaling: StatScaling | null
}

/**
 * Per-skill conditional damage modifiers — values the user dials in before
 * a skill is cast that the formula's conditional buffs (`pool_cond`) read
 * to scale the damage pool. Each field maps to one (or more synonym)
 * `poolCond` key from the buff catalog:
 *
 *   - `targetDebuffs`      → `target_debuff`            (count of negative buffs on target)
 *   - `enemyTeamDeaths`    → `enemy_team_decrease`      (count of dead enemies on opposing team — Maxwell type 94)
 *   - `targetBuffs`        → `target_buff`              (count of positive buffs on target)
 *   - `teamBuffs`          → `team_buff`                (sum of positive buffs across caster's team)
 *   - `casterLostHpPct`    → `owner_lost_hp` + `caster_lost_hp` (caster's missing HP %)
 *   - `targetLostHpPct`    → `target_lost_hp`           (target's missing HP %)
 *   - `killStacks`         → `kill_count_stack`         (stacked kill counter)
 *
 * `tower_content` is auto-derived from the picked target so it has no UI.
 *
 * The picker UI surfaces only the inputs whose matching buff actually
 * exists on the picked char's active skill — irrelevant fields stay zero
 * in state and are simply hidden.
 */
export interface ConditionalModifiers {
  targetDebuffs: number
  /** Count of dead enemies on the opposing team (Maxwell type 94). NOT debuffs. */
  enemyTeamDeaths: number
  targetBuffs: number
  teamBuffs: number
  /** 0..100 — caster's missing HP as a percentage of max HP. */
  casterLostHpPct: number
  /** 0..100 — target's missing HP as a percentage of max HP. */
  targetLostHpPct: number
  killStacks: number
}

export const INITIAL_CONDITIONAL: ConditionalModifiers = {
  targetDebuffs: 0,
  enemyTeamDeaths: 0,
  targetBuffs: 0,
  teamBuffs: 0,
  casterLostHpPct: 0,
  targetLostHpPct: 0,
  killStacks: 0,
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

/**
 * External buffs / debuffs the user dials in for the cast.
 *
 * Catalog-driven: the entries (id + side + direction + stat + canonical
 * default value) live in `src/lib/damage/v2/external-buffs.ts` and are
 * shared with the admin Damage Lab v2. The state is a flat
 * `Record<id, { active, value }>` keyed by catalog id — toggle activates
 * the buff, value is the editable percentage (defaults to the canonical
 * in-game value, e.g. ATK +30% / EFF +100%).
 *
 * `marked` is a separate boolean toggle for the Outerplane "Marked"
 * debuff (increases incoming damage). It has no editable value — pure
 * on/off — so it's tracked outside the catalog state.
 */
export interface BuffsState {
  toggles: Record<string, ExternalBuffState>
  marked: boolean
}

export const INITIAL_BUFFS: BuffsState = {
  toggles: makeDefaultExternalBuffsState(),
  marked: false,
}

/**
 * Ally team — three optional support slots that contribute to the damage
 * dealer's output through their talisman + class-specific signature gear:
 *
 *   - Defender    → "Exquisite Death" weapon (scales on the defender's DEF)
 *   - Ranger      → "Absolute Music" accessory
 *   - Striker / Mage / Healer → talisman only (no class-gated signature gear today)
 *
 * The `tier` field on each signature toggle is a 0..4 enchantment level —
 * the formula consumer reads it to scale the passive's contribution. The
 * `defenderDef` field captures the defender's flat DEF stat so the
 * Exquisite Death scaling can be replayed without fetching the defender's
 * full stat sheet.
 *
 * UI surfaces only the conditional fields whose owning class matches the
 * picked char — irrelevant fields stay zero / disabled in state.
 */
export const TEAM_SIZE = 3

/**
 * Main stat tokens an ally talisman can carry. Picker exposes these as a
 * dropdown — the actual talisman item is irrelevant for the damage calc;
 * only the magnitude (driven by `rarity` × `stat` × `level` lookup baked
 * into `equipment.json#talismanMainStats`) feeds the math.
 *
 * Game-side reality: talisman main stats are ALWAYS percentage-based
 * (no flat ATK / DEF / HP / SPD options). The set below mirrors the
 * baked OOPARTS catalog (`BID_ITEM_STAT_OOPARTS_*`), excluding the
 * defensive `DMG_REDUCE` (target-side, no impact on dealer's damage).
 *
 * Empty string means "no talisman equipped on this slot".
 */
export const TALISMAN_MAIN_STATS = ['ATK%', 'DEF%', 'HP%', 'CHC', 'CHD', 'EFF', 'RES', 'DMG UP%', 'DMG RED%'] as const
export type TalismanMainStat = (typeof TALISMAN_MAIN_STATS)[number]

export interface TalismanLoadout {
  /** 4 / 5 / 6 — drives the main-stat magnitude lookup. */
  rarity: 4 | 5 | 6
  /** Main stat token, or empty string when no talisman is equipped. */
  stat: TalismanMainStat | ''
  /** Enchantment level 0..10 — additional multiplier on the main-stat value. */
  level: number
}

export interface TeamMember {
  charId: string | null
  /** Current transcend tier — defaults to the picked char's max tier. */
  transStar: number
  /** Talisman config — only rarity + main stat matter for the damage calc. */
  talisman: TalismanLoadout
  /** Defender-only — Exquisite Death weapon usage + tier 0..4. */
  exquisiteDeath: { enabled: boolean; tier: number }
  /** Defender-only — flat DEF stat for the Exquisite Death scaling. */
  defenderDef: number
  /** Ranger-only — Absolute Music accessory usage + tier 0..4. */
  absoluteMusic: { enabled: boolean; tier: number }
}

export interface TeamState {
  /** Length === `TEAM_SIZE`. */
  members: TeamMember[]
}

export const INITIAL_TEAM_MEMBER: TeamMember = {
  charId: null,
  transStar: 0,
  talisman: { rarity: 6, stat: '', level: 10 },
  exquisiteDeath: { enabled: false, tier: 0 },
  defenderDef: 0,
  absoluteMusic: { enabled: false, tier: 0 },
}

export function makeInitialTeam(): TeamState {
  return {
    members: Array.from({ length: TEAM_SIZE }, () => ({
      ...INITIAL_TEAM_MEMBER,
      talisman: { ...INITIAL_TEAM_MEMBER.talisman },
      exquisiteDeath: { ...INITIAL_TEAM_MEMBER.exquisiteDeath },
      absoluteMusic: { ...INITIAL_TEAM_MEMBER.absoluteMusic },
    })),
  }
}

export interface CalcState {
  attacker: AttackerState
  target: TargetState
  settings: SettingsState
  buffs: BuffsState
  team: TeamState
  /**
   * Per-mechanic toggle states (active flag), keyed by passive `skillId`.
   * Survives monster swaps when the new monster shares any passive id; cleared
   * entries (no current monster, or monster with no passives) leave the panel
   * hidden.
   */
  bossMechanics: Record<string, BossMechanicState>
  /**
   * Currently-loaded boss override (definitions: skill → label / description /
   * raw buffs). Re-fetched from `/damage-calc/mechanics/{monsterId}.json`
   * whenever the monster changes. Null when the target has no damage-relevant
   * passive (panel stays hidden).
   */
  bossOverride: BossOverride | null
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
    burstLevel: 0,
    crit: false,
    transStar: 0,
    equipment: { ...INITIAL_LOADOUT, setSlots: [...INITIAL_LOADOUT.setSlots], ee: { ...INITIAL_LOADOUT.ee } },
    conditional: { ...INITIAL_CONDITIONAL },
    atkScaling: null,
  },
  target: { ...INITIAL_TARGET, manual: { ...INITIAL_MANUAL, stats: { ...INITIAL_MANUAL.stats } } },
  settings: { ...INITIAL_SETTINGS, quirks: { ...INITIAL_SETTINGS.quirks } },
  buffs: cloneInitialBuffs(),
  team: makeInitialTeam(),
  bossMechanics: {},
  bossOverride: null,
  statsDirty: false,
}

/** Fresh buffs defaults — `makeDefaultExternalBuffsState()` rebuilds the
 *  toggles record from the catalog so reducer updates never alias the
 *  module-level `INITIAL_BUFFS.toggles`. */
export function cloneInitialBuffs(): BuffsState {
  return { toggles: makeDefaultExternalBuffsState(), marked: false }
}
