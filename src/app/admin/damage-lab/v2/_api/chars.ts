/**
 * Client helper for `GET /api/admin/damage-lab/v2/chars`.
 */

export interface SkillData {
  /** index 0 = level 1, length 5. */
  damageFactors: (number | null)[]
  /** Conditional sub-attack ratio. Null when none. */
  additionalAttackRatio: number | null
}

export interface CharData {
  id: string
  name: string
  element: string
  class: string
  subclass: string
  portraitUrl: string
  skills: { S1: SkillData | null; S2: SkillData | null; S3: SkillData | null }
}

export async function fetchChars(): Promise<CharData[]> {
  const res = await fetch('/api/admin/damage-lab/v2/chars')
  if (!res.ok) throw new Error(`fetchChars: ${res.status}`)
  const data = (await res.json()) as { chars: CharData[] }
  return data.chars
}

/**
 * Per-stat scaling breakdown — lets the lab replay the API's `calcStat`
 * formula with an external buff added additively to `pctBonus`. Matches the
 * in-game stack model where a combat-time +ATK% buff stacks ADDITIVELY with
 * the permanent %-bonuses (class passive, gifts, etc.) rather than
 * multiplicatively on the displayed stat.
 */
export interface StatScaling {
  /** CharacterTemplet *_Max — lv 100 base value. */
  baseMax: number
  /** Cumulative flat bonus (evolution + gifts). */
  flat: number
  /** Additive %-bonus layer (class passive + Skill_8 + gifts). */
  pctBonus: number
  /** Codex %-multiplier (applies to baseMax only). */
  codexPct: number
  /** Transcend %-multiplier (compounds with `pctBonus`). */
  transcendPct: number
}

export interface CharStatsResponse {
  meta: {
    id: string
    class: string | null
    subclass: string | null
    element: string | null
    basicStar: number
    level: number
    /** Optional — present when the route is the "max everything" variant. */
    scaling?: { atk: StatScaling; def: StatScaling; hp: StatScaling }
  }
  final: {
    atk: number
    def: number
    hp: number
    spd: number
    chc: number
    chd: number
    chdReduce: number
    pen: number
    dmgInc: number
    dmgRed: number
    eff: number
    res: number
  }
}

export async function fetchCharStats(charId: string): Promise<CharStatsResponse> {
  const res = await fetch(`/api/admin/characters/${charId}/stats`)
  if (!res.ok) throw new Error(`fetchCharStats: ${res.status}`)
  return res.json()
}

/** Pull the DamageFactor at `level` for the given slot, falling back to 1000 (pass-through). */
export function getDamageFactor(char: CharData, slot: 'S1' | 'S2' | 'S3', level: number): number {
  const skill = char.skills[slot]
  if (!skill) return 1000
  const idx = Math.max(0, Math.min(4, level - 1))
  return skill.damageFactors[idx] ?? 1000
}

export function getAdditionalAttackRatio(char: CharData, slot: 'S1' | 'S2' | 'S3'): number | undefined {
  return char.skills[slot]?.additionalAttackRatio ?? undefined
}
