/**
 * Client helpers for the v2 stages + monster stats endpoints.
 */

export interface MonsterEntry {
  monsterId: string
  faceIconId: string
  name: string
  type: string
  isBoss: boolean
  class: string
  element: string
  subClass: string
  basicStar: number
  level: number
  defMin: number
  defMax: number
  drMax: number
  atkMin: number
  atkMax: number
  hpMin: number
  hpMax: number
  defAtLevel: number
  drPctAtLevel: number
  atkAtLevel: number
  hpAtLevel: number
  position: number
  slot: number
}

export interface WaveEntry {
  position: number
  monsters: MonsterEntry[]
}

export interface StageEntry {
  id: string
  name: string
  chapter: string | null
  season: number | null
  episodeNum: number | null
  stageNum: number | null
  recommendLevel: number
  waves: WaveEntry[]
}

export interface ModeEntry {
  mode: string
  label: string
  stages: StageEntry[]
}

export async function fetchStages(): Promise<ModeEntry[]> {
  const res = await fetch('/api/admin/damage-lab/v2/stages')
  if (!res.ok) throw new Error(`fetchStages: ${res.status}`)
  const data = (await res.json()) as { modes: ModeEntry[] }
  return data.modes
}

export interface MonsterStatsResponse {
  meta: {
    id: string
    type: string | null
    class: string | null
    subclass: string | null
    element: string | null
    isBoss: boolean
    level: number
    levelClamped: boolean
    dungeonId: string | null
    advantageRate: { atk: number; def: number; hp: number; spd: number }
    casterDebuff: { eff: number; res: number }
  }
  final: {
    atk: number
    def: number
    hp: number
    spd: number
    chc: number
    chd: number
    pen: number
    dmgInc: number
    dmgRed: number
    eff: number
    res: number
  }
}

export async function fetchMonsterStats(
  monsterId: string,
  opts: { level: number; dungeonId?: string; effDebuff?: number; resDebuff?: number },
): Promise<MonsterStatsResponse> {
  const params = new URLSearchParams({ level: String(opts.level) })
  if (opts.dungeonId) params.set('dungeonId', opts.dungeonId)
  if (opts.effDebuff != null && opts.effDebuff !== 0) params.set('effDebuff', String(opts.effDebuff))
  if (opts.resDebuff != null && opts.resDebuff !== 0) params.set('resDebuff', String(opts.resDebuff))
  const res = await fetch(`/api/admin/damage-lab/v2/monsters/${monsterId}/stats?${params.toString()}`)
  if (!res.ok) throw new Error(`fetchMonsterStats: ${res.status}`)
  return res.json()
}
