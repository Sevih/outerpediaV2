import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCHEMA_VERSION, INPUTS, writeJsonMin } from './shared'
import { loadJson2, loadGenerated } from './raw-loader'

/**
 * Bake the character roster needed by the public damage calculator:
 *
 *   public/damage-calc/manifest.json     — slim picker index (~50-100KB)
 *   public/damage-calc/chars/{id}.json   — per-char detail (~3-5KB each)
 *
 * Manifest is loaded once at page boot. Per-char detail is fetched lazily
 * when the user picks an attacker — keeps initial payload small while
 * caching aggressively at the browser level (immutable per pipeline run).
 *
 * The split intentionally matches the UX: picker shows a flat sortable
 * list (manifest), the right-hand panel needs detailed stats/skills only
 * for the selected char (detail).
 */

interface CharacterTempletRow {
  ID: string
  Skill_1?: string
  Skill_2?: string
  Skill_3?: string
}

interface SkillLevelRow {
  ID?: string
  SkillID: string
  SkillLevel: string
  DamageFactor?: string
}

interface DamageRow {
  ID?: string
  DamageFactor?: string
}

interface CuratedSkill {
  IconName?: string
  name?: string
  name_jp?: string
  name_kr?: string
  name_zh?: string
}

interface CuratedCharacter {
  ID: string | number
  Fullname: string
  Fullname_jp?: string
  Fullname_kr?: string
  Fullname_zh?: string
  Element?: string
  Class?: string
  SubClass?: string
  Rarity?: number
  rank?: string
  role?: string
  coreFusionId?: string
  skills?: Partial<Record<'SKT_FIRST' | 'SKT_SECOND' | 'SKT_ULTIMATE', CuratedSkill>>
}

interface CharStatsStep {
  ATK: number; DEF: number; HP: number; SPD: number
  EFF: number; RES: number; CHC: number; CHD: number
  DMG_RED: number; DMG_INC: number
}
interface CharStatsEntry {
  info?: { id: string }
  steps?: Record<string, CharStatsStep>
}

interface ManifestEntry {
  id: string
  slug: string
  name: string
  name_jp?: string
  name_kr?: string
  name_zh?: string
  element: string
  class: string
  subclass: string
  rarity: number
  role?: string
  rank?: string
  iconUrl: string
  /** CF chars only: id of the base char they originate from. */
  baseCharId?: string
  /** Base chars only: id of their CF variant if one exists. */
  coreFusionId?: string
}

interface SkillDetail {
  name: string
  name_jp?: string
  name_kr?: string
  name_zh?: string
  iconName: string
  /** Index 0 = level 1, length 5. */
  damageFactors: (number | null)[]
  /** Conditional sub-attack ratio (additional / main). Null when not applicable. */
  additionalAttackRatio: number | null
}

interface CharDetail {
  _v: string
  id: string
  skills: {
    S1: SkillDetail | null
    S2: SkillDetail | null
    S3: SkillDetail | null
  }
  /** All 6 evolution steps. Calculator UI defaults to `lv60_ev3` (6★). */
  baseStats: Record<string, CharStatsStep> | null
}

const SLOT_TOKEN: Record<number, 'First' | 'Second' | 'Ultimate'> = {
  1: 'First', 2: 'Second', 3: 'Ultimate',
}
const SLOT_KEY: Record<number, 'SKT_FIRST' | 'SKT_SECOND' | 'SKT_ULTIMATE'> = {
  1: 'SKT_FIRST', 2: 'SKT_SECOND', 3: 'SKT_ULTIMATE',
}

/**
 * Walk `CharacterDamageTemplet` for `(charId, slot)` and split rows into
 * main vs sub-attack. Pattern (validated against ARM64 disasm + lab obs):
 *   {charId}_Skill_{slot}_{N}        → main hit (numeric only)
 *   {charId}_Skill_{slot}_{N}_{M}    → conditional sub-attack
 *   {charId}_Skill_{slot}_{N}_{LET}  → animation variant (ignored)
 */
function computeAdditionalRatio(charId: string, slot: number, dmgRows: DamageRow[]): number | null {
  const prefix = `${charId}_Skill_${slot}_`
  const mainRe = new RegExp(`^${charId}_Skill_${slot}_\\d+$`)
  const subRe = new RegExp(`^${charId}_Skill_${slot}_\\d+_\\d+$`)
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

function buildSkillDetail(
  skillId: string | undefined,
  slot: number,
  charId: string,
  levelsBySkill: Map<string, SkillLevelRow[]>,
  dmgRows: DamageRow[],
  curated: CuratedCharacter | undefined,
): SkillDetail | null {
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

  const curatedSkill = curated?.skills?.[SLOT_KEY[slot]]
  const iconName = curatedSkill?.IconName || `Skill_${SLOT_TOKEN[slot]}_${charId}`
  const detail: SkillDetail = {
    name: curatedSkill?.name ?? `Skill ${slot}`,
    iconName,
    damageFactors: factors,
    additionalAttackRatio: computeAdditionalRatio(charId, slot, dmgRows),
  }
  if (curatedSkill?.name_jp) detail.name_jp = curatedSkill.name_jp
  if (curatedSkill?.name_kr) detail.name_kr = curatedSkill.name_kr
  if (curatedSkill?.name_zh) detail.name_zh = curatedSkill.name_zh
  return detail
}

async function loadCuratedChars(): Promise<Map<string, CuratedCharacter>> {
  const files = await readdir(INPUTS.characters)
  const out = new Map<string, CuratedCharacter>()
  await Promise.all(
    files.filter(f => f.endsWith('.json')).map(async f => {
      try {
        const raw = await readFile(join(INPUTS.characters, f), 'utf-8')
        const c = JSON.parse(raw) as CuratedCharacter
        out.set(String(c.ID), c)
      } catch {
        // skip broken curated files — pipeline doesn't fail because of one bad row
      }
    }),
  )
  return out
}

export async function buildChars(): Promise<{ chars: number; details: number }> {
  const [
    charTemplet,
    skillLevels,
    dmgRows,
    curatedById,
    slugToId,
    statsById,
  ] = await Promise.all([
    loadJson2<CharacterTempletRow[]>('CharacterTemplet.json'),
    loadJson2<SkillLevelRow[]>('CharacterSkillLevelTemplet.json'),
    loadJson2<DamageRow[]>('CharacterDamageTemplet.json'),
    loadCuratedChars(),
    loadGenerated<Record<string, string>>('characters-slug-to-id.json'),
    loadGenerated<Record<string, CharStatsEntry>>('character-stats.json'),
  ])

  // Reverse slug map for O(1) lookup by char ID.
  const idToSlug = new Map<string, string>()
  for (const [slug, id] of Object.entries(slugToId)) idToSlug.set(id, slug)

  // Index skill levels once — used for both manifest filter (has-any-DF) + detail build.
  const levelsBySkill = new Map<string, SkillLevelRow[]>()
  for (const row of skillLevels) {
    const arr = levelsBySkill.get(row.SkillID) ?? []
    arr.push(row)
    levelsBySkill.set(row.SkillID, arr)
  }

  // Inverse CF map: CF char id → base char id (built from base entries' coreFusionId).
  const cfToBase = new Map<string, string>()
  for (const c of curatedById.values()) {
    if (c.coreFusionId) cfToBase.set(String(c.coreFusionId), String(c.ID))
  }

  const manifest: ManifestEntry[] = []
  const detailWrites: Promise<void>[] = []

  for (const row of charTemplet) {
    const curated = curatedById.get(row.ID)
    if (!curated) continue   // skip NPCs / non-playable

    const slug = idToSlug.get(row.ID)
    if (!slug) continue   // not in the curated public roster — skip

    const skills = {
      S1: buildSkillDetail(row.Skill_1, 1, row.ID, levelsBySkill, dmgRows, curated),
      S2: buildSkillDetail(row.Skill_2, 2, row.ID, levelsBySkill, dmgRows, curated),
      S3: buildSkillDetail(row.Skill_3, 3, row.ID, levelsBySkill, dmgRows, curated),
    }
    const hasAny = [skills.S1, skills.S2, skills.S3].some(s => s?.damageFactors.some(v => v != null))
    if (!hasAny) continue   // chars without any DamageFactor row aren't usable in the calc

    const entry: ManifestEntry = {
      id: row.ID,
      slug,
      name: curated.Fullname,
      element: curated.Element ?? '',
      class: curated.Class ?? '',
      subclass: curated.SubClass ?? '',
      rarity: curated.Rarity ?? 0,
      iconUrl: `/images/characters/atb/IG_Turn_${row.ID}.webp`,
    }
    if (curated.Fullname_jp) entry.name_jp = curated.Fullname_jp
    if (curated.Fullname_kr) entry.name_kr = curated.Fullname_kr
    if (curated.Fullname_zh) entry.name_zh = curated.Fullname_zh
    if (curated.role) entry.role = curated.role
    if (curated.rank) entry.rank = curated.rank
    const baseCharId = cfToBase.get(row.ID)
    if (baseCharId) entry.baseCharId = baseCharId
    if (curated.coreFusionId) entry.coreFusionId = String(curated.coreFusionId)

    manifest.push(entry)

    // Per-char detail (parallel write — independent files).
    const detail: CharDetail = {
      _v: SCHEMA_VERSION,
      id: row.ID,
      skills,
      baseStats: statsById[row.ID]?.steps ?? null,
    }
    detailWrites.push(writeJsonMin(`chars/${row.ID}.json`, detail))
  }

  manifest.sort((a, b) => a.name.localeCompare(b.name))

  await Promise.all([
    writeJsonMin('manifest.json', {
      _v: SCHEMA_VERSION,
      chars: manifest,
    }),
    ...detailWrites,
  ])

  return { chars: manifest.length, details: detailWrites.length }
}
