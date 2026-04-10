import { loadTable, num, type Row } from './common'

// ── Types ───────────────────────────────────────────────────────────

export type StatRange = { min: number; max: number }

export type MonsterStats = {
  hp: StatRange
  atk: StatRange
  def: StatRange
  speed: StatRange
  weight: StatRange
  criticalRate: StatRange
  criticalDmgRate: StatRange
  buffChance: StatRange
  buffResist: StatRange
  dmgReduceRateMax: number | null
}

export type MonsterBase = {
  id: string
  type: string // CT_BOSS_MONSTER | CT_MONSTER | CT_AREA_BOSS_MONSTER | CT_NAMED_MONSTER | CT_SEASON_BOSS_MONSTER
  race: string | null // CRT_*
  class: string | null // CCT_*
  subClass: string | null
  element: string | null // CET_*
  basicStar: number
  modelId: string | null
  faceIconId: string | null
  nameId: string | null
  nickNameId: string | null
  /** Ordered list of the character's declared skills with their slot number. */
  skillIds: { slot: number; id: string }[]
  stats: MonsterStats
  aiType: string | null
  buffImmuneToolTip: string | null
  buffImmune: string // CSV like "BT_FREEZE,BT_STONE,..." (empty when none)
  statBuffImmune: string // CSV like "ST_SPEED" (empty when none)
}

// ── Loaders ─────────────────────────────────────────────────────────

let monsterIndex: Map<string, Row> | null = null

export function loadMonsterIndex(): Map<string, Row> {
  if (!monsterIndex) {
    monsterIndex = new Map()
    for (const r of loadTable('MonsterTemplet')) {
      if (r.ID) monsterIndex.set(r.ID, r)
    }
  }
  return monsterIndex
}

/** All monsters, optionally filtered by Type set. */
export function listMonsters(opts?: { types?: string[] }): Row[] {
  const rows = loadTable('MonsterTemplet')
  if (!opts?.types || opts.types.length === 0) return rows
  const set = new Set(opts.types)
  return rows.filter((r) => set.has(r.Type ?? ''))
}

// ── Extraction ──────────────────────────────────────────────────────

function collectSkillIds(row: Row): { slot: number; id: string }[] {
  const ids: { slot: number; id: string }[] = []
  for (let i = 1; i <= 18; i++) {
    const s = row[`Skill_${i}`]
    if (s) ids.push({ slot: i, id: s })
  }
  return ids
}

export function extractBase(id: string, index?: Map<string, Row>): MonsterBase | null {
  const map = index ?? loadMonsterIndex()
  const row = map.get(id)
  if (!row) return null

  return {
    id: row.ID,
    type: row.Type ?? '',
    race: row.Race ?? null,
    class: row.Class ?? null,
    subClass: row.SubClass && row.SubClass !== 'NONE' ? row.SubClass : null,
    element: row.Element ?? null,
    basicStar: num(row.BasicStar),
    modelId: row.ModelID ?? null,
    faceIconId: row.FaceIconID ?? null,
    nameId: row.NameID ?? null,
    nickNameId: row.NickNameID ?? null,
    skillIds: collectSkillIds(row),
    stats: {
      hp: { min: num(row.HP_Min), max: num(row.HP_Max) },
      atk: { min: num(row.Atk_Min), max: num(row.Atk_Max) },
      def: { min: num(row.Def_Min), max: num(row.Def_Max) },
      speed: { min: num(row.Speed_Min), max: num(row.Speed_Max) },
      weight: { min: num(row.WG_Min), max: num(row.WG_Max) },
      criticalRate: { min: num(row.CriticalRate_Min), max: num(row.CriticalRate_Max) },
      criticalDmgRate: { min: num(row.CriticalDMGRate_Min), max: num(row.CriticalDMGRate_Max) },
      buffChance: { min: num(row.BuffChance_Min), max: num(row.BuffChance_Max) },
      buffResist: { min: num(row.BuffResist_Min), max: num(row.BuffResist_Max) },
      dmgReduceRateMax: row.DMGReduceRate_Max ? num(row.DMGReduceRate_Max) : null,
    },
    aiType: row.AIType ?? null,
    buffImmuneToolTip: row.BuffImmuneToolTip ?? null,
    buffImmune: row.BuffImmune ?? '',
    statBuffImmune: row.StatBuffImmune ?? '',
  }
}
