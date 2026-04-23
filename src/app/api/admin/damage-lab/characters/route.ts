import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')
const CHARACTER_DIR = path.join(process.cwd(), 'data', 'character')

interface SkillLevel { ID: string; SkillID: string; SkillLevel: string; DamageFactor?: string }
interface CharacterTempletRow { ID: string; Skill_1?: string; Skill_2?: string; Skill_3?: string }
interface CharacterCurated { ID: number | string; Fullname?: string; Element?: string; Class?: string }

interface SkillData {
  skillId: string
  damageFactors: (number | null)[]   // index 0 = level 1, length 5
}

interface CharacterEntry {
  id: string
  name: string
  element: string
  class: string
  skills: {
    first: SkillData | null
    second: SkillData | null
    ultimate: SkillData | null
  }
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function buildSkillData(skillId: string | undefined, levelsBySkill: Map<string, SkillLevel[]>): SkillData | null {
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
  return { skillId, damageFactors: factors }
}

export async function GET() {
  const charTemplet = loadJson<CharacterTempletRow[]>(path.join(JSON2_DIR, 'CharacterTemplet.json'))
  const skillLevels = loadJson<SkillLevel[]>(path.join(JSON2_DIR, 'CharacterSkillLevelTemplet.json'))

  const levelsBySkill = new Map<string, SkillLevel[]>()
  for (const row of skillLevels) {
    const arr = levelsBySkill.get(row.SkillID) ?? []
    arr.push(row)
    levelsBySkill.set(row.SkillID, arr)
  }

  const curatedById = new Map<string, CharacterCurated>()
  for (const f of fs.readdirSync(CHARACTER_DIR)) {
    if (!f.endsWith('.json')) continue
    try {
      const c = loadJson<CharacterCurated>(path.join(CHARACTER_DIR, f))
      curatedById.set(String(c.ID), c)
    } catch { /* skip broken files */ }
  }

  const entries: CharacterEntry[] = []
  for (const row of charTemplet) {
    const curated = curatedById.get(row.ID)
    if (!curated) continue  // skip NPCs / monsters not curated as playable
    const entry: CharacterEntry = {
      id: row.ID,
      name: curated.Fullname ?? row.ID,
      element: curated.Element ?? '',
      class: curated.Class ?? '',
      skills: {
        first: buildSkillData(row.Skill_1, levelsBySkill),
        second: buildSkillData(row.Skill_2, levelsBySkill),
        ultimate: buildSkillData(row.Skill_3, levelsBySkill),
      },
    }
    // Only keep characters that have at least one active skill with a DamageFactor
    const hasAny = [entry.skills.first, entry.skills.second, entry.skills.ultimate]
      .some(s => s?.damageFactors.some(v => v != null))
    if (hasAny) entries.push(entry)
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ characters: entries })
}
