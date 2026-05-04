import { readDamageCalcJson } from './_cache'

/**
 * Server-side reader for the baked target catalog.
 * Source: `public/damage-calc/monsters.json`.
 *
 * Shape mirrors the admin Damage Lab v2 stages endpoint — Mode → Stage →
 * Wave → Monster cascade. Built directly from json2 templets so the picker
 * gets the same selection schema users know from the lab.
 */

export interface DamageCalcLangDict {
  en: string
  jp: string
  kr: string
  zh: string
}

/**
 * Full target stat block at the spawn level — output of `resolveDungeonStats`
 * from the audited f32 chain (single source of truth shared with the admin
 * lab and bit-exact with the binary's `get_*` getters). Joint Challenge /
 * Pursuit Operation bosses get their HP overridden by the per-stage hardcoded
 * value from `EventBossDungeonTemplet` / `IrregularChaseTemplet`.
 *
 * Mirrors `StatBlock` in `src/lib/damage/v2/stats.ts`.
 */
export interface DamageCalcMonsterStats {
  /** Flat int — matches `get_Atk` / `get_Def` / `get_MaxHP` / `get_Speed`. */
  atk: number
  def: number
  hp: number
  spd: number
  /** Critical Chance — % (per-mille ÷ 10). */
  chc: number
  /** Critical Damage — % (per-mille ÷ 10). */
  chd: number
  /** Penetration — % (per-mille ÷ 10). */
  pen: number
  /** Damage Increase — % (per-mille ÷ 10). */
  dmgInc: number
  /** Damage Reduction — % (per-mille ÷ 10). */
  dmgRed: number
  /** Effectiveness — flat int (raw `BuffChance`, in-game displayed value). */
  eff: number
  /** Resilience — flat int (raw `BuffResist`, in-game displayed value). */
  res: number
}

export interface DamageCalcMonsterEntry {
  monsterId: string
  /** FaceIconID — drives the portrait at `/images/characters/boss/portrait/MT_{faceIconId}.webp`. */
  faceIconId: string
  name: DamageCalcLangDict
  /** `CT_BOSS_MONSTER` / `CT_MONSTER` / `CT_NAMED_MONSTER` / … — drives slot color. */
  type: string
  isBoss: boolean
  /** In-game class label (Attacker/Defender/Mage/Ranger/Priest/Healer). */
  class: string
  /** Fire/Water/Earth/Light/Dark. */
  element: string
  subClass: string
  /** Star count — 1/2/3 — drives the star overlay on the portrait. */
  basicStar: number
  /** Spawn level for this monster in this stage. AL Mission stages bake one
   *  StageEntry per AL Level — the level here matches the stage's tier. */
  level: number
  stats: DamageCalcMonsterStats
  /** Wave index within the stage (`SpawnID_Pos{position}`). */
  position: number
  /** Slot within the spawn group (0..3). */
  slot: number
}

export interface DamageCalcWaveEntry {
  position: number
  monsters: DamageCalcMonsterEntry[]
}

export interface DamageCalcStageEntry {
  /** Stable identifier — `DungeonTemplet.ID` for plain stages,
   *  `${dungeonId}@al${alLevel}` for the per-AL-Level expansion. */
  id: string
  /** Stage display name (LangDict). For story this is the storyline title. */
  name: DamageCalcLangDict
  /** Story chapter / area name (LangDict). null for non-story modes. */
  chapter: DamageCalcLangDict | null
  /** Story season (1+). null for non-story. */
  season: number | null
  /** Story episode number. null for non-story. */
  episodeNum: number | null
  /** Story per-episode stage number (e.g. 12 for "1-12"). null for non-story. */
  stageNum: number | null
  /** Recommended level — `DungeonTemplet.RecommandLevel` for plain stages,
   *  the per-tier `monsterLevel` for AL stages (so the picker sorts by
   *  difficulty within an AL dungeon). */
  recommendLevel: number
  waves: DamageCalcWaveEntry[]
  /**
   * Adventure License level (1..10) when this stage is the per-tier
   * expansion of a DM_ADVENTURE_MISSION / DM_ADVENTURE_CHALLENGE dungeon.
   * Undefined for plain stages. The UI suffixes the picker label with
   * "AL Lv {alLevel}" so users can pick the difficulty inline.
   */
  alLevel?: number
}

export interface DamageCalcModeEntry {
  /** Raw `DungeonMode` token (DM_TOWER_HARD, DM_NORMAL, …) — drives the cascade taxonomy. */
  mode: string
  /** Localized mode label (LangDict). */
  label: DamageCalcLangDict
  stages: DamageCalcStageEntry[]
}

export interface DamageCalcMonstersFile {
  _v: string
  modes: DamageCalcModeEntry[]
}

export function getDamageCalcMonsters(): Promise<DamageCalcMonstersFile> {
  return readDamageCalcJson<DamageCalcMonstersFile>('monsters.json')
}
