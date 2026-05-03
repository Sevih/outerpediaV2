import type { WithLocalizedFields } from '@/types/common'
import { readDamageCalcJson } from './_cache'

/**
 * Server-side reader for the baked character roster.
 * Source: `public/damage-calc/manifest.json` + `public/damage-calc/chars/{id}.json`.
 * Browser fetches the same files directly — no API hop.
 *
 * The `name`/`slug` fields use `WithLocalizedFields` (same convention as
 * `CharacterListEntry` and friends) so the i18n `l()` helper works
 * directly without casts.
 */

export type DamageCalcCharSummary = WithLocalizedFields<{
  id: string
  slug: string
  name: string
  element: string
  class: string
  subclass: string
  rarity: number
  role?: string
  rank?: string
  iconUrl: string
  /** CF chars: id of the base char they originate from. */
  baseCharId?: string
  /** Base chars: id of their CF variant if one exists. */
  coreFusionId?: string
}, 'name'>;

export interface DamageCalcCodexEntry {
  /** 0 = no codex; 1..11 = ingame Lv 1..Lv 11. */
  level: number
  /** %-bonus on base ATK (already converted from per-mille). */
  atkPct: number
  defPct: number
  hpPct: number
}

export interface DamageCalcCharManifest {
  _v: string
  chars: DamageCalcCharSummary[]
  /** Account-wide codex table (12 rows: Lv 0 → Lv 11). Char-agnostic. */
  codexTable: DamageCalcCodexEntry[]
}

/**
 * Sparse stat contributor — only nonzero fields are emitted. The keys mirror
 * the bake's `StatContribution` type (atk/def/hp/spd flat, chc/chd/pen/dmgInc/
 * dmgRed % points, eff/res flat, atkPct/defPct/hpPct % bonus on base).
 */
export interface DamageCalcStatContribution {
  atk?: number
  def?: number
  hp?: number
  spd?: number
  chc?: number
  chd?: number
  pen?: number
  dmgInc?: number
  dmgRed?: number
  eff?: number
  res?: number
  atkPct?: number
  defPct?: number
  hpPct?: number
}

export interface DamageCalcNoGearStats {
  base: DamageCalcStatContribution
  evolution: DamageCalcStatContribution
  classPassive: DamageCalcStatContribution
  /** Keyed by transStar (string). Empty entries (no skill8 unlock) are omitted. */
  skill8ByTransStar: Record<string, DamageCalcStatContribution>
  /**
   * Quirk groups exposed to settings — mirror in-game gift menu categories.
   *   - `element`           : AAT_ELEMENTAL (always-on for the char's element)
   *   - `job`               : AAT_CLASS + AAT_SUBCLASS (always-on, both under
   *                            the in-game "Class" tab)
   *   - `adventureLicense`  : AwakeningType=ADVENTURE_LICENSE sub-nodes
   *                            (mode-gated — applied only when the picked
   *                            target sits in DM_ADVENTURE_MISSION /
   *                            DM_ADVENTURE_CHALLENGE; the +100% boss DMG
   *                            main node lives in the awakening buffs catalog)
   *
   * UTILITY / PVE awakening sub-nodes are not surfaced here — they're either
   * no-stat (UTILITY) or runtime-only BT_DMG modifiers (PVE Counteract).
   */
  quirks: {
    element: DamageCalcStatContribution
    job: DamageCalcStatContribution
    adventureLicense: DamageCalcStatContribution
  }
}

export type DamageCalcSkillDetail = WithLocalizedFields<{
  name: string
  iconName: string
  /** Index 0 = level 1, length 5. Null entries = no DamageFactor at that level. */
  damageFactors: (number | null)[]
  additionalAttackRatio: number | null
  /**
   * Level-keyed localized descriptions: `'1'/'1_jp'/'1_kr'/'1_zh'/'2'/...`.
   * Lifted verbatim from curated `true_desc_levels`. Use `getSkillDescription`
   * (or the SkillCard pattern) to read with English fallback.
   */
  descLevels?: Record<string, string>
}, 'name'>;

export interface DamageCalcStatsStep {
  ATK: number; DEF: number; HP: number; SPD: number
  EFF: number; RES: number; CHC: number; CHD: number
  DMG_RED: number; DMG_INC: number
}

/** Stat keys exposed by the calc UI (mirrors `StatKey` in the panel state). */
export type DamageCalcStatKey =
  | 'ATK' | 'DEF' | 'HP' | 'SPD'
  | 'CHC' | 'CHD' | 'EFF' | 'RES'
  | 'PEN' | 'DMG_INC'

export interface DamageCalcCharScalings {
  /**
   * Stat the damage formula uses for the main multiplier. `'ATK'` for the
   * vast majority of chars; `'HP'` / `'DEF'` for swap-stat chars (Drakhan,
   * base Veronica, etc.) where a `BT_SWAP_STAT_ATTACK` buff replaces ATK.
   */
  main: DamageCalcStatKey
  /**
   * Additional stats the char's skills scale on (Demiurge Stella's
   * HP-based sub-attack and similar). Excludes whatever's already in
   * `main`. Empty for pure-ATK chars.
   */
  secondaries: DamageCalcStatKey[]
}

export interface DamageCalcCharDetail {
  _v: string
  id: string
  skills: {
    S1: DamageCalcSkillDetail | null
    S2: DamageCalcSkillDetail | null
    S3: DamageCalcSkillDetail | null
    /** Burst Lv 1 / 2 / 3 — replace S3's DamageFactor + buff list when the
     *  user casts under Burst. Gated by the dealer's transcend (see the tier
     *  templet's `burst2` / `burst3` flags). Null when the char has no
     *  burst variant (Skill_19/20/21 absent in the templet). */
    B1: DamageCalcSkillDetail | null
    B2: DamageCalcSkillDetail | null
    B3: DamageCalcSkillDetail | null
  }
  /** Six evolution steps (`lv1_ev0` … `lv100_ev5`). Null when no curated stats exist. */
  baseStats: Record<string, DamageCalcStatsStep> | null
  /**
   * Pre-derived scaling stats (main + secondaries) so the UI can highlight
   * the relevant stat inputs without loading the buff catalog. Computed at
   * bake time from char-skill buffs (`scaling_swap` + `scaling_add_*`).
   */
  scalings: DamageCalcCharScalings
  /**
   * No-gear stat contributors — recomposed client-side via `computeFinalStats`
   * with user settings (codex / quirks) + the chosen transcend tier (gates
   * skill8). Lets the panel auto-prefill realistic in-game stats when the
   * user picks a char, without baking every (codex × quirks × transcend)
   * permutation.
   */
  noGearStats: DamageCalcNoGearStats
}

export function getDamageCalcCharManifest(): Promise<DamageCalcCharManifest> {
  return readDamageCalcJson<DamageCalcCharManifest>('manifest.json')
}

export function getDamageCalcCharDetail(charId: string): Promise<DamageCalcCharDetail> {
  return readDamageCalcJson<DamageCalcCharDetail>(`chars/${charId}.json`)
}
