import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCHEMA_VERSION, INPUTS, writeJsonMin } from './shared'
import { loadJson2, loadGenerated } from './raw-loader'
import { extractCharSkillBuffs, type BuffRow } from '../../../src/lib/damage/v2/extract-buffs'
import type { ApplicableBuff } from '../../../src/lib/damage/v2/buffs'
import { buildNoGearStats, buildCodexTable, type NoGearStats, type CodexEntry } from './_no-gear-stats'

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

interface CharacterTempletRow extends Record<string, string | undefined> {
  ID: string
  Skill_1?: string
  Skill_2?: string
  Skill_3?: string
  /** Skill_8 (transcendent passive) + Skill_22 (class passive) — needed for noGearStats. */
  Skill_8?: string
  Skill_22?: string
  /** Determines which generic transcend chain (and ATK/DEF lv-100 patch) applies. */
  BasicStar?: string
}

interface TranscendentRowSlim {
  CharacterID?: string
  BasicStar?: string
  TransStar?: string
  SkillLevel?: string
  NextStar?: string
  RewardAtkRate?: string
  RewardDefRate?: string
  RewardHPRate?: string
}

interface FusionRowSlim {
  CharacterID?: string
  ChangeCharID?: string
}

interface SkillLevelRow {
  ID?: string
  SkillID: string
  SkillLevel: string
  DamageFactor?: string
  /** CSV of BuffIDs applied at this skill level — needed by `extractCharSkillBuffs`. */
  BuffID?: string
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
  /**
   * Level-keyed descriptions in 4 langs:
   *   `{ '1': en, '1_jp': jp, '1_kr': kr, '1_zh': zh, '2': en, '2_jp': jp, ... }`
   * Baked verbatim into the calc detail so the UI can display the
   * description that matches the slider's current level.
   */
  true_desc_levels?: Record<string, string>
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
  /**
   * Level-keyed localized descriptions (lifted from curated `true_desc_levels`).
   * Shape: `{ '1': en, '1_jp': jp, '1_kr', '1_zh', '2': en, ... }`. Optional —
   * skills without curated text simply don't render a description block.
   */
  descLevels?: Record<string, string>
}

interface CharScalings {
  /**
   * Stat the damage formula uses for the main multiplier. `'ATK'` for the
   * vast majority of chars; HP/DEF for swap-stat chars (Drakhan,
   * base Veronica, etc.) where a `BT_SWAP_STAT_ATTACK` buff replaces
   * ATK with another stat.
   */
  main: StatKey
  /**
   * Additional stats the char's skills scale on (Demiurge Stella's HP-based
   * sub-attack, Noa's `BT_DMG_TARGET_STAT` reading owner-side, etc.).
   * Excludes whatever's already in `main`. Empty for pure-ATK chars.
   */
  secondaries: StatKey[]
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
  /**
   * Pre-derived from char-skill buffs (`scaling_swap` → main, `scaling_add_*`
   * → secondaries). Lets the UI highlight the relevant stat inputs without
   * loading the full buff catalog first.
   */
  scalings: CharScalings
  /**
   * Per-source no-gear stat contributors (base / evolution / classPassive /
   * skill8 / quirks). Recomposed client-side via `computeFinalStats` once
   * the user picks a codex level + quirk toggles + transcend tier.
   */
  noGearStats: NoGearStats
}

/** Stat keys exposed by the calc UI — must match `StatKey` in `_state/types.ts`. */
type StatKey = 'ATK' | 'DEF' | 'HP' | 'SPD' | 'CHC' | 'CHD' | 'EFF' | 'RES' | 'PEN' | 'DMG_INC'

/**
 * Map binary `ST_*` stat refs (emitted by `extract-buffs.ts`) to the calc
 * UI's flat stat keys. Returns `null` when the ref doesn't map to a stat
 * input the panel exposes (e.g. ST_DMG_BOOST is folded into DMG_INC, but
 * ST_LIFESTEAL_RATE has no input → ignored).
 */
function statRefToKey(ref: string | undefined): StatKey | null {
  switch (ref) {
    case 'ST_ATK':              return 'ATK'
    case 'ST_HP':               return 'HP'
    case 'ST_DEF':
    case 'ST_DEFENCE':          return 'DEF'
    case 'ST_SPEED':            return 'SPD'
    case 'ST_CRITICAL_RATE':    return 'CHC'
    case 'ST_CRITICAL_DMG_RATE':return 'CHD'
    case 'ST_BUFF_CHANCE':      return 'EFF'
    case 'ST_BUFF_RESIST':      return 'RES'
    case 'ST_PIERCE_POWER_RATE':return 'PEN'
    case 'ST_DMG_BOOST':        return 'DMG_INC'
    default:                    return null
  }
}

/**
 * Walk char-skill buffs for a char and pick out the main scaling stat (from
 * `scaling_swap`) plus any add-* secondaries (`scaling_add_pct`,
 * `scaling_add_flat`). Defaults to `'ATK'` main when no swap is present.
 */
function deriveScalings(buffs: ApplicableBuff[], charId: string): CharScalings {
  let main: StatKey = 'ATK'
  const secondaries = new Set<StatKey>()

  for (const b of buffs) {
    if (b.source.kind !== 'char_skill' || b.source.charId !== charId) continue
    const ref = statRefToKey(b.effect.statRef)
    if (!ref) continue
    if (b.effect.target === 'scaling_swap') {
      main = ref
    } else if (b.effect.target === 'scaling_add_pct' || b.effect.target === 'scaling_add_flat') {
      secondaries.add(ref)
    }
  }
  secondaries.delete(main)
  return { main, secondaries: Array.from(secondaries) }
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
  if (curatedSkill?.true_desc_levels) {
    detail.descLevels = curatedSkill.true_desc_levels
  }
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

type Row = Record<string, string | undefined>

const num = (v: string | undefined) => (v ? parseInt(v, 10) || 0 : 0)

export async function buildChars(): Promise<{ chars: number; details: number }> {
  const [
    charTemplet,
    skillLevels,
    dmgRows,
    buffRows,
    evoRows,
    archiveRows,
    transcendentRows,
    awakNodes,
    awakLevels,
    fusionRows,
    curatedById,
    slugToId,
    statsById,
  ] = await Promise.all([
    loadJson2<CharacterTempletRow[]>('CharacterTemplet.json'),
    loadJson2<SkillLevelRow[]>('CharacterSkillLevelTemplet.json'),
    loadJson2<DamageRow[]>('CharacterDamageTemplet.json'),
    loadJson2<Row[]>('BuffTemplet.json'),
    loadJson2<Row[]>('CharacterEvolutionStatTemplet.json'),
    loadJson2<Row[]>('CharacterArchiveStatTemplet.json'),
    loadJson2<TranscendentRowSlim[]>('CharacterTranscendentTemplet.json'),
    loadJson2<Row[]>('CharacterAwakeningNodeTemplet.json'),
    loadJson2<Row[]>('CharacterAwakeningLevelTemplet.json'),
    loadJson2<FusionRowSlim[]>('CharacterFusionTemplet.json'),
    loadCuratedChars(),
    loadGenerated<Record<string, string>>('characters-slug-to-id.json'),
    loadGenerated<Record<string, CharStatsEntry>>('character-stats.json'),
  ])

  // Codex table — char-agnostic, baked once into the manifest so the picker
  // page doesn't need a second fetch to surface the Settings codex slider.
  const codexTable: CodexEntry[] = buildCodexTable(archiveRows)

  // Index transcend rows two ways:
  //  - genericByStar: BasicStar → reachable tier rows (CharacterID === '0')
  //  - overrideByChar: CharacterID → per-char override rows
  // Then, per char, build the (transStar → skillLevel) list that drives
  // Skill_8 contribution selection in `buildNoGearStats`.
  const isReachable = (r: TranscendentRowSlim) => num(r.NextStar) !== 0
    || num(r.RewardAtkRate) + num(r.RewardDefRate) + num(r.RewardHPRate) > 0
  const transcendGenericByStar = new Map<number, TranscendentRowSlim[]>()
  const transcendOverrideByChar = new Map<string, TranscendentRowSlim[]>()
  for (const r of transcendentRows) {
    if (r.CharacterID === '0') {
      const star = num(r.BasicStar)
      const arr = transcendGenericByStar.get(star) ?? []
      arr.push(r)
      transcendGenericByStar.set(star, arr)
    } else if (r.CharacterID) {
      const arr = transcendOverrideByChar.get(r.CharacterID) ?? []
      arr.push(r)
      transcendOverrideByChar.set(r.CharacterID, arr)
    }
  }
  // Resolve transStar → skillLevel for one char by stitching override
  // (per-char) on top of generic (per-BasicStar) — same precedence as the
  // admin route. Drops dead-end placeholder rows (NextStar=0 + zero rewards).
  const transcendChainFor = (charId: string, basicStar: number): Array<{ transStar: number; skillLevel: number }> => {
    const generic = transcendGenericByStar.get(basicStar) ?? []
    const override = transcendOverrideByChar.get(charId) ?? []
    const byStar = new Map<number, TranscendentRowSlim>()
    for (const r of generic) byStar.set(num(r.TransStar), r)
    for (const r of override) byStar.set(num(r.TransStar), r)
    return Array.from(byStar.values())
      .filter(isReachable)
      .map(r => ({ transStar: num(r.TransStar), skillLevel: num(r.SkillLevel) }))
      .sort((a, b) => a.transStar - b.transStar)
  }

  // Index fusion rows: ChangeCharID (CF variant) → CharacterID (base) — the
  // CF variant inherits the base's evolution rewards.
  const cfToBaseEvoChar = new Map<string, string>()
  for (const f of fusionRows) {
    if (f.ChangeCharID && f.CharacterID) cfToBaseEvoChar.set(f.ChangeCharID, f.CharacterID)
  }

  // Run the char-skill extractor once globally so we can derive scaling
  // metadata per char (main / secondary scaling stats). The buffs builder
  // runs the same extraction in parallel — `loadJson2` dedupes the heavy
  // reads, so this is pure-CPU duplication (~50ms) for clear ownership of
  // the scaling derivation in the chars file.
  const allCharSkillBuffs = extractCharSkillBuffs({
    characters: charTemplet.filter(r => r.ID).map(r => r as { ID: string } & Row),
    skillLevels: skillLevels.filter(r => r.SkillID).map(r => ({
      SkillID: r.SkillID!,
      SkillLevel: r.SkillLevel ?? '0',
      BuffID: r.BuffID,
    })),
    buffs: buffRows.map(b => ({
      ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type,
      StatType: b.StatType, ApplyingType: b.ApplyingType, Value: b.Value,
      BuffConditionType: b.BuffConditionType, BuffConditionValue: b.BuffConditionValue,
      TargetType: b.TargetType, TargetSkillType: b.TargetSkillType,
      CallerSkillType: b.CallerSkillType, BuffCreateType: b.BuffCreateType,
    } satisfies BuffRow)),
  })

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

    // CF variants share evolution rewards with the base char (same as the
    // admin route). Awakening / class passive / skill8 lookups are unaffected.
    const evoCharId = cfToBaseEvoChar.get(row.ID) ?? row.ID
    const basicStar = num(row.BasicStar)
    const transcendChain = transcendChainFor(row.ID, basicStar)
    const noGearStats: NoGearStats = buildNoGearStats({
      charId: row.ID,
      evoCharId,
      charRow: row,
      evoStats: evoRows,
      skillLevels: skillLevels as unknown as Row[],
      buffs: buffRows,
      awakNodes,
      awakLevels,
      transcendSkillLevels: transcendChain,
    })

    // Per-char detail (parallel write — independent files).
    const detail: CharDetail = {
      _v: SCHEMA_VERSION,
      id: row.ID,
      skills,
      baseStats: statsById[row.ID]?.steps ?? null,
      scalings: deriveScalings(allCharSkillBuffs, row.ID),
      noGearStats,
    }
    detailWrites.push(writeJsonMin(`chars/${row.ID}.json`, detail))
  }

  manifest.sort((a, b) => a.name.localeCompare(b.name))

  await Promise.all([
    writeJsonMin('manifest.json', {
      _v: SCHEMA_VERSION,
      chars: manifest,
      codexTable,
    }),
    ...detailWrites,
  ])

  return { chars: manifest.length, details: detailWrites.length }
}
