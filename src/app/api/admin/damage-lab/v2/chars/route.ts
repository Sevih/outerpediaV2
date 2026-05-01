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
  /**
   * Set on the BASE entry: the CF version's char ID (e.g. base Veronica
   * `2000037` carries `coreFusionId: "2700037"`). We invert this map to
   * surface `baseCharId` on the CF entry so the lab can offer "equip base
   * EE" alongside the default "equip own EE" — CF chars in-game can wear
   * either Exclusive Equipment.
   */
  coreFusionId?: string
  /**
   * Per-slot skill metadata. Notably `IconName` may not match the
   * `Skill_{Slot}_{charId}` convention for core-fusion chars (e.g.
   * Veronica core fusion 2700037 inherits S1/S2 icons from base 2000037
   * but ships its own S3 icon). We read this map verbatim instead of
   * reconstructing the URL.
   */
  skills?: Partial<Record<
    'SKT_FIRST' | 'SKT_SECOND' | 'SKT_ULTIMATE',
    { IconName?: string }
  >>
}

interface SkillData {
  /** index 0 = level 1, length 5. */
  damageFactors: (number | null)[]
  /** Conditional sub-attack ratio derived from CharacterDamageTemplet rows. Null when none. */
  additionalAttackRatio: number | null
  /**
   * Skill icon filename (without extension), e.g. `Skill_First_2000037`.
   * Pulled from `data/character/{id}.json` so core-fusion chars whose
   * skill icons reference their base char id resolve correctly.
   * Falls back to `Skill_{Slot}_{charId}` for chars without curated data.
   */
  iconName: string
}

interface CharEntryV2 {
  id: string
  name: string
  element: string
  class: string
  subclass: string
  portraitUrl: string
  skills: { S1: SkillData | null; S2: SkillData | null; S3: SkillData | null }
  /**
   * For Core Fusion chars: the base char ID (the non-CF original). Drives
   * the lab's "equip base EE" option so the operator can swap between the
   * CF's own EE and the base char's EE on a CF entry.
   */
  baseCharId?: string
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

const SLOT_TOKEN: Record<number, 'First' | 'Second' | 'Ultimate'> = {
  1: 'First', 2: 'Second', 3: 'Ultimate',
}
const SLOT_KEY: Record<number, 'SKT_FIRST' | 'SKT_SECOND' | 'SKT_ULTIMATE'> = {
  1: 'SKT_FIRST', 2: 'SKT_SECOND', 3: 'SKT_ULTIMATE',
}

function buildSkillData(
  skillId: string | undefined, slot: number, charId: string,
  levelsBySkill: Map<string, SkillLevelRow[]>,
  dmgRows: { ID?: string; DamageFactor?: string }[],
  curated: CharacterCurated | undefined,
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
  // Prefer curated IconName (handles core-fusion mixed icon ownership);
  // fall back to the conventional `Skill_{Slot}_{charId}` form.
  const curatedIcon = curated?.skills?.[SLOT_KEY[slot]]?.IconName
  const iconName = curatedIcon || `Skill_${SLOT_TOKEN[slot]}_${charId}`
  return {
    damageFactors: factors,
    additionalAttackRatio: computeAdditionalRatio(charId, slot, dmgRows),
    iconName,
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

  // CF → base inverse map (built from each base entry's `coreFusionId`).
  const cfToBase = new Map<string, string>()
  for (const c of curatedById.values()) {
    if (c.coreFusionId) cfToBase.set(String(c.coreFusionId), String(c.ID))
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
        S1: buildSkillData(row.Skill_1, 1, row.ID, levelsBySkill, dmgRows, curated),
        S2: buildSkillData(row.Skill_2, 2, row.ID, levelsBySkill, dmgRows, curated),
        S3: buildSkillData(row.Skill_3, 3, row.ID, levelsBySkill, dmgRows, curated),
      },
      baseCharId: cfToBase.get(row.ID),
    }
    // Keep only chars with at least one slot exposing a DamageFactor.
    const hasAny = [entry.skills.S1, entry.skills.S2, entry.skills.S3]
      .some(s => s?.damageFactors.some(v => v != null))
    if (hasAny) out.push(entry)
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ chars: out })
}
