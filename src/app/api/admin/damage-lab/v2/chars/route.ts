import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/admin/damage-lab/v2/chars
 *
 * Slim character roster for the v2 lab — what the picker + recompute pipeline
 * need to operate without touching the v1 endpoint:
 *   - identity (id / name / element / class / subclass)
 *   - portraitUrl (ATB convention: /images/characters/atb/IG_Turn_{id}.webp)
 *   - per-slot DamageFactor table (lvl 1..5) + additionalAttackRatio
 *
 * Restricted to development.
 */

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')
const CHARACTER_DIR = path.join(process.cwd(), 'data', 'character')

interface SkillLevelRow { ID: string; SkillID: string; SkillLevel: string; DamageFactor?: string }
interface CharacterTempletRow {
  ID: string
  Skill_1?: string; Skill_2?: string; Skill_3?: string
}
interface CharacterCurated {
  ID: number | string
  Fullname?: string
  Element?: string
  Class?: string
  SubClass?: string
}

interface SkillData {
  /** index 0 = level 1, length 5. */
  damageFactors: (number | null)[]
  /** Conditional sub-attack ratio derived from CharacterDamageTemplet rows. Null when none. */
  additionalAttackRatio: number | null
}

interface CharEntryV2 {
  id: string
  name: string
  element: string
  class: string
  subclass: string
  portraitUrl: string
  skills: { S1: SkillData | null; S2: SkillData | null; S3: SkillData | null }
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

/**
 * Walk `CharacterDamageTemplet` for `(charId, slot)` and split rows into main vs
 * sub-attack weights. Naming:
 *   {charId}_Skill_{slot}_{N}     → main attack hit (numeric only)
 *   {charId}_Skill_{slot}_{N}_{M} → conditional sub-attack
 *   {charId}_Skill_{slot}_{N}_{LET} → animation variant (ignored)
 */
function computeAdditionalRatio(
  charId: string, slot: number,
  dmgRows: { ID?: string; DamageFactor?: string }[],
): number | null {
  const prefix = `${charId}_Skill_${slot}_`
  const mainRe = new RegExp(`^${charId}_Skill_${slot}_\\d+$`)
  const subRe  = new RegExp(`^${charId}_Skill_${slot}_\\d+_\\d+$`)
  let mainSum = 0
  let subSum = 0
  for (const r of dmgRows) {
    const id = r.ID ?? ''
    if (!id.startsWith(prefix)) continue
    const df = parseInt(r.DamageFactor ?? '0', 10) || 0
    if (df === 0) continue
    if (mainRe.test(id)) mainSum += df
    else if (subRe.test(id)) subSum += df
  }
  if (mainSum === 0 || subSum === 0) return null
  return subSum / mainSum
}

function buildSkillData(
  skillId: string | undefined, slot: number, charId: string,
  levelsBySkill: Map<string, SkillLevelRow[]>,
  dmgRows: { ID?: string; DamageFactor?: string }[],
): SkillData | null {
  if (!skillId) return null
  const rows = levelsBySkill.get(skillId)
  if (!rows || rows.length === 0) return null
  const factors: (number | null)[] = [null, null, null, null, null]
  for (const row of rows) {
    const lvl = parseInt(row.SkillLevel, 10)
    if (lvl >= 1 && lvl <= 5 && row.DamageFactor != null) {
      factors[lvl - 1] = parseInt(row.DamageFactor, 10)
    }
  }
  return {
    damageFactors: factors,
    additionalAttackRatio: computeAdditionalRatio(charId, slot, dmgRows),
  }
}

export function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const charTemplet = loadJson<CharacterTempletRow[]>(path.join(JSON2_DIR, 'CharacterTemplet.json'))
  const skillLevels = loadJson<SkillLevelRow[]>(path.join(JSON2_DIR, 'CharacterSkillLevelTemplet.json'))
  const dmgRows = loadJson<{ ID?: string; DamageFactor?: string }[]>(path.join(JSON2_DIR, 'CharacterDamageTemplet.json'))

  const levelsBySkill = new Map<string, SkillLevelRow[]>()
  for (const row of skillLevels) {
    const arr = levelsBySkill.get(row.SkillID) ?? []
    arr.push(row)
    levelsBySkill.set(row.SkillID, arr)
  }

  // Curated metadata (Fullname, Element, Class, SubClass) — playable chars only.
  const curatedById = new Map<string, CharacterCurated>()
  for (const f of fs.readdirSync(CHARACTER_DIR)) {
    if (!f.endsWith('.json')) continue
    try {
      const c = loadJson<CharacterCurated>(path.join(CHARACTER_DIR, f))
      curatedById.set(String(c.ID), c)
    } catch {
      // skip broken files
    }
  }

  const out: CharEntryV2[] = []
  for (const row of charTemplet) {
    const curated = curatedById.get(row.ID)
    if (!curated) continue   // skip NPCs/monsters not curated as playable
    const entry: CharEntryV2 = {
      id: row.ID,
      name: curated.Fullname ?? row.ID,
      element: curated.Element ?? '',
      class: curated.Class ?? '',
      subclass: curated.SubClass ?? '',
      portraitUrl: `/images/characters/atb/IG_Turn_${row.ID}.webp`,
      skills: {
        S1: buildSkillData(row.Skill_1, 1, row.ID, levelsBySkill, dmgRows),
        S2: buildSkillData(row.Skill_2, 2, row.ID, levelsBySkill, dmgRows),
        S3: buildSkillData(row.Skill_3, 3, row.ID, levelsBySkill, dmgRows),
      },
    }
    // Keep only chars with at least one slot exposing a DamageFactor.
    const hasAny = [entry.skills.S1, entry.skills.S2, entry.skills.S3]
      .some(s => s?.damageFactors.some(v => v != null))
    if (hasAny) out.push(entry)
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ chars: out })
}
