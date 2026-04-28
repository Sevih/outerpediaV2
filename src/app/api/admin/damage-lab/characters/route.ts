import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')
const CHARACTER_DIR = path.join(process.cwd(), 'data', 'character')

// Slim damage-lab character roster — the page consumes:
//   - identity (id / name / element / class / subclass / originalCharacter)
//   - basicStar (drives the transcend slider in the UI)
//   - L100 base stats (atkMax / chdMax / critRateMax — for the read-only badge)
//   - per-skill DamageFactor table + additionalAttackRatio
//   - heroCodex levels (global roster bonus levels for the codex picker)
//
// Everything else (full stat resolution, awakening / class-passive / evolution
// / transcend bonuses) lives in the per-character stats endpoint
// `/api/admin/characters/:id/stats`. Buff applicability lives in
// `/api/admin/damage-lab/buffs`. Scaling info (SWAP / ADD) is derived
// client-side from the buffs list filtered to the char's char_skill source.

interface SkillLevel { ID: string; SkillID: string; SkillLevel: string; DamageFactor?: string }
interface CharacterTempletRow {
  ID: string
  Skill_1?: string; Skill_2?: string; Skill_3?: string
  Atk_Max?: string
  CriticalDMGRate_Max?: string       // encoded ×10, e.g. 1500 = 150%
  CriticalRate_Max?: string          // encoded as int %
  BasicStar?: string                 // 1/2/3 — drives transcend progression
}

interface ArchiveStatRow {
  ID: string
  Atk_Rate: string
  Def_Rate: string
  HP_Rate: string
}

interface CharacterCurated {
  ID: number | string
  Fullname?: string
  Element?: string
  Class?: string
  SubClass?: string
  // Set on core-fusion derivatives (ID 2700xxx). Their S1/S2 icons live under
  // the *original* character's ID — only S3 (Ultimate) uses the fusion's own ID.
  originalCharacter?: string
}

interface SkillData {
  damageFactors: (number | null)[]   // index 0 = level 1, length 5
  // Conditional sub-attack ratio derived from CharacterDamageTemplet rows.
  // null when the skill has no `_Skill_N_M_K` sub-attack rows.
  additionalAttackRatio: number | null
}

interface CharacterEntry {
  id: string
  name: string
  element: string
  class: string
  subClass: string
  originalCharacter?: string
  basicStar: number
  atkMax: number
  chdMax: number
  critRateMax: number
  skills: {
    first: SkillData | null
    second: SkillData | null
    ultimate: SkillData | null
  }
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

// Walk CharacterDamageTemplet rows for a given (charId, skillSlot) and split
// them into main vs sub-attack weights. Naming conventions:
//   {charId}_Skill_{slot}_{N}     → main attack hit (numeric suffix only)
//   {charId}_Skill_{slot}_{N}_{M} → conditional sub-attack
//   {charId}_Skill_{slot}_{N}_{LET} → animation variant (ignored)
function computeAdditionalRatio(charId: string, slot: number, dmgRows: { ID?: string; DamageFactor?: string }[]): number | null {
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

function buildSkillData(skillId: string | undefined, slot: number, charId: string,
                       levelsBySkill: Map<string, SkillLevel[]>,
                       dmgRows: { ID?: string; DamageFactor?: string }[]): SkillData | null {
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

export async function GET() {
  const charTemplet = loadJson<CharacterTempletRow[]>(path.join(JSON2_DIR, 'CharacterTemplet.json'))
  const skillLevels = loadJson<SkillLevel[]>(path.join(JSON2_DIR, 'CharacterSkillLevelTemplet.json'))
  const dmgRows = loadJson<{ ID?: string; DamageFactor?: string }[]>(path.join(JSON2_DIR, 'CharacterDamageTemplet.json'))

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
      subClass: curated.SubClass ?? '',
      originalCharacter: curated.originalCharacter,
      basicStar: parseInt(row.BasicStar ?? '0', 10) || 0,
      atkMax: parseInt(row.Atk_Max ?? '0', 10) || 0,
      chdMax: (parseInt(row.CriticalDMGRate_Max ?? '0', 10) || 0) / 10,
      critRateMax: (parseInt(row.CriticalRate_Max ?? '0', 10) || 0) / 10,
      skills: {
        first:    buildSkillData(row.Skill_1, 1, row.ID, levelsBySkill, dmgRows),
        second:   buildSkillData(row.Skill_2, 2, row.ID, levelsBySkill, dmgRows),
        ultimate: buildSkillData(row.Skill_3, 3, row.ID, levelsBySkill, dmgRows),
      },
    }
    // Only keep characters that have at least one active skill with a DamageFactor.
    const hasAny = [entry.skills.first, entry.skills.second, entry.skills.ultimate]
      .some(s => s?.damageFactors.some(v => v != null))
    if (hasAny) entries.push(entry)
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))

  // Hero Codex global bonuses (applies to every character in the roster).
  const archiveRows = loadJson<ArchiveStatRow[]>(path.join(JSON2_DIR, 'CharacterArchiveStatTemplet.json'))
  const heroCodexLevels = archiveRows.map(r => ({
    level: parseInt(r.ID, 10) || 0,
    atkPct: (parseInt(r.Atk_Rate, 10) || 0) / 10,
    defPct: (parseInt(r.Def_Rate, 10) || 0) / 10,
    hpPct:  (parseInt(r.HP_Rate,  10) || 0) / 10,
  })).sort((a, b) => a.level - b.level)

  return NextResponse.json({ characters: entries, heroCodexLevels })
}
