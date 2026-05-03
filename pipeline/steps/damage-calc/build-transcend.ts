import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCHEMA_VERSION, INPUTS, writeJsonMin } from './shared'
import { loadJson2, loadGenerated } from './raw-loader'

/**
 * Bake per-char transcend data for the public damage calculator.
 *
 *   public/damage-calc/transcend.json — single file keyed by charId:
 *     - tiers[]   : stat boosts (HP/ATK/DEF rate) + Burst level unlocks
 *     - teamBonuses : stat keys this char grants to allies via transcend
 *                     (extracted upstream in `characters-index` from curated text)
 *
 * The templet has 80 rows total: most chars share GENERIC rows
 * (`CharacterID=0`) keyed by `BasicStar` (the char's starting rarity).
 * A handful of chars (currently 8) have per-id overrides — when present,
 * they take precedence row-by-row.
 *
 * Variant paths (T4_1 / T4_2 / T5_1 / T5_2 / T5_3 in the curated text)
 * are NOT modeled here — the calc UI lets the user enter their actual
 * stats directly, so the per-tier base values are sufficient for the
 * Burst level gate + an informational tier picker. Variant modeling
 * belongs to the future "build optimizer" feature, not the calc.
 *
 * Rates are stored verbatim from the templet (permille — 100 = +10%).
 * The reducer divides by 1000 when applying.
 */

interface TranscendRow {
  ID?: string
  CharacterID?: string
  BasicStar?: string
  TransStar?: string
  RewardHPRate?: string
  RewardAtkRate?: string
  RewardDefRate?: string
  Burst2?: string
  Burst3?: string
  /** Skill_8 level unlocked at this TransStar — drives the team-bonus
   *  resolution (buff catalog lookup against the char's Skill_8 ID). */
  SkillLevel?: string
}

interface CharacterTempletRow {
  ID?: string
  /** Transcendent skill ID — its level rows in `CharacterSkillLevelTemplet`
   *  contain the team-bonus buff IDs. */
  Skill_8?: string
}

interface SkillLevelRow {
  SkillID?: string
  SkillLevel?: string
  /** CSV of `BuffTemplet.BuffID` strings active at this skill level. */
  BuffID?: string
}

interface BuffRow {
  BuffID?: string
  Level?: string
  Type?: string
  StatType?: string
  ApplyingType?: string
  Value?: string
  TargetType?: string
  BuffConditionType?: string
}

interface CharacterListEntry {
  ID: string
  teamBonuses?: string[]
}

interface CuratedCharacter {
  ID: string | number
  Rarity?: number
  /**
   * For CF chars: id of the base char they originate from. Used to fall back
   * to the base char's BasicStar when CF chars don't carry their own
   * `Rarity` (they always do today, but this keeps the resolver robust).
   */
  baseCharId?: string
}

interface TranscendTier {
  transStar: number
  /** Per-mille — divide by 1000 to get the multiplier delta. */
  hpRate: number
  atkRate: number
  defRate: number
  burst2: boolean
  burst3: boolean
}

/** Internal-only — extends `TranscendTier` with the templet's `SkillLevel`
 *  field (Skill_8 level unlocked at this tier). Not emitted in the public
 *  bake (the team-bonus buffs it gates are pre-resolved into
 *  `teamBonusesByTier` so the runtime doesn't need the catalog). */
interface InternalTranscendTier extends TranscendTier {
  skillLevel: number
}

interface TranscendCharEntry {
  basicStar: number
  tiers: TranscendTier[]
  /**
   * Stat keys this char's transcend description names as ally-team bonuses
   * (parsed by `characters-index` from English text). Empty / absent for
   * chars with no team bonuses. Values are stat keys per `data/stats.json`.
   */
  teamBonuses?: string[]
  /**
   * Tier-gated team bonuses — list of buff "unlocks" from the char's
   * Skill_8 transcend skill. Each entry records:
   *   - `fromTransStar`: TransStar at which this version of the buff
   *     activates (or upgrades from a previous tier's value).
   *   - `stat`: stat key per `data/stats.json`.
   *   - `value`: in display units (per-mille → percentage points after ÷10
   *     for OAT_RATE on absolute stats; flat for OAT_ADD).
   *   - `apply`: `'rate'` (multiplicative on dealer's base for ATK/DEF/HP,
   *     additive points for percent stats) or `'add'` (flat additive).
   *
   * Multiple entries per stat are possible when transcend tiers UPGRADE the
   * buff (e.g. ATK +5% at T4 → +10% at T6 → +20% at T9). Runtime resolves
   * the active value per stat by picking the entry with highest
   * `fromTransStar` ≤ current TransStar.
   *
   * Sorted by `fromTransStar` ascending then `stat` for deterministic diff.
   */
  teamBonusesByTier?: Array<{
    stat: string
    value: number
    apply: 'rate' | 'add'
    fromTransStar: number
  }>
}

interface TranscendFile {
  _v: string
  byChar: Record<string, TranscendCharEntry>
}

const num = (v: string | undefined) => parseInt(v ?? '0', 10) || 0
const bool = (v: string | undefined) => v === 'True'

function rowToTier(r: TranscendRow): InternalTranscendTier {
  return {
    transStar:  num(r.TransStar),
    hpRate:     num(r.RewardHPRate),
    atkRate:    num(r.RewardAtkRate),
    defRate:    num(r.RewardDefRate),
    burst2:     bool(r.Burst2),
    burst3:     bool(r.Burst3),
    skillLevel: num(r.SkillLevel),
  }
}

/** Strip the internal `skillLevel` field — emitted tiers should match the
 *  public-facing `TranscendTier` shape. */
function toPublicTier(t: InternalTranscendTier): TranscendTier {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { skillLevel, ...pub } = t
  return pub
}

async function loadCuratedRarities(): Promise<Map<string, number>> {
  const files = await readdir(INPUTS.characters)
  const out = new Map<string, number>()
  await Promise.all(
    files.filter(f => f.endsWith('.json')).map(async f => {
      try {
        const raw = await readFile(join(INPUTS.characters, f), 'utf-8')
        const c = JSON.parse(raw) as CuratedCharacter
        if (c.Rarity != null) out.set(String(c.ID), c.Rarity)
      } catch {
        // skip broken curated files
      }
    }),
  )
  return out
}

/** Build a `BuffID → max-Level row` index. Multiple BuffTemplet rows share
 *  a BuffID (one per Level); the max-Level row carries the max-rank values. */
function indexBuffsByIdMaxLevel(rows: BuffRow[]): Map<string, BuffRow> {
  const out = new Map<string, BuffRow>()
  for (const r of rows) {
    if (!r.BuffID) continue
    const cur = out.get(r.BuffID)
    const lvl = parseInt(r.Level ?? '0', 10) || 0
    const curLvl = cur ? (parseInt(cur.Level ?? '0', 10) || 0) : -1
    if (lvl > curLvl) out.set(r.BuffID, r)
  }
  return out
}

function indexSkillLevels(rows: SkillLevelRow[]): Map<string, SkillLevelRow> {
  const out = new Map<string, SkillLevelRow>()
  for (const r of rows) {
    if (!r.SkillID || !r.SkillLevel) continue
    out.set(`${r.SkillID}#${parseInt(r.SkillLevel, 10) || 0}`, r)
  }
  return out
}

function indexCharTemplet(rows: CharacterTempletRow[]): Map<string, CharacterTempletRow> {
  const out = new Map<string, CharacterTempletRow>()
  for (const r of rows) {
    if (r.ID) out.set(r.ID, r)
  }
  return out
}

/**
 * Map BuffTemplet `StatType` to the public stat key per `data/stats.json`.
 * Returns null for stats we don't surface (e.g. accuracy / avoid — not in
 * the calc UI's stat grid).
 */
function statTypeToKey(statType: string | undefined): string | null {
  switch (statType) {
    case 'ST_ATK':              return 'ATK'
    case 'ST_DEF':              return 'DEF'
    case 'ST_HP':               return 'HP'
    case 'ST_SPEED':            return 'SPD'
    case 'ST_CRITICAL_RATE':    return 'CHC'
    case 'ST_CRITICAL_DMG_RATE':return 'CHD'
    case 'ST_PIERCE_POWER_RATE':return 'PEN'
    case 'ST_BUFF_CHANCE':      return 'EFF'
    case 'ST_BUFF_RESIST':      return 'RES'
    case 'ST_DMG_BOOST':        return 'DMG UP%'
    case 'ST_DMG_REDUCE_RATE':  return 'DMG RED%'
    default:                    return null
  }
}

/** Stats whose internal Value is per-mille (÷10 → percentage points)
 *  regardless of `ApplyingType`. Mirrors `PERMILLE_STATS` in
 *  `extract-monster.ts` and `extract-buffs.ts`. */
const PERMILLE_STATS = new Set([
  'ST_CRITICAL_RATE', 'ST_CRITICAL_DMG_RATE', 'ST_PIERCE_POWER_RATE',
  'ST_DMG_BOOST', 'ST_DMG_REDUCE_RATE',
  'ST_BUFF_CHANCE', 'ST_BUFF_RESIST',
])

interface ResolvedTeamBuff {
  stat: string
  value: number
  apply: 'rate' | 'add'
}

/**
 * Resolve the team-targeted, no-condition stat buffs at a given Skill_8
 * level for a char. Returns one entry per stat; the final value is in
 * display units (per-mille → percent for OAT_RATE on absolute stats and
 * for percent stats; flat for OAT_ADD on absolute stats / SPD).
 */
function resolveTeamBuffsAt(
  skill8Id: string,
  skillLevel: number,
  skillLevelsBySkillIdLevel: Map<string, SkillLevelRow>,
  buffsByIdMaxLevel: Map<string, BuffRow>,
): ResolvedTeamBuff[] {
  const slRow = skillLevelsBySkillIdLevel.get(`${skill8Id}#${skillLevel}`)
  if (!slRow) return []
  const buffIds = (slRow.BuffID ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const out: ResolvedTeamBuff[] = []
  for (const bid of buffIds) {
    const buff = buffsByIdMaxLevel.get(bid)
    if (!buff) continue
    // Filter: BT_STAT_PREMIUM (permanent stat passive), MY_TEAM target
    // (= bonus given to allies, NOT the caster's own self-buff), no
    // condition (= always active from cast).
    if (buff.Type !== 'BT_STAT_PREMIUM') continue
    if (buff.TargetType !== 'MY_TEAM') continue
    if ((buff.BuffConditionType ?? 'NONE') !== 'NONE') continue
    const stat = statTypeToKey(buff.StatType)
    if (!stat) continue
    const rawValue = num(buff.Value)
    const isRate   = buff.ApplyingType === 'OAT_RATE'
    const isPermilleStat = PERMILLE_STATS.has(buff.StatType ?? '')
    // Value normalization for the runtime:
    //   - OAT_RATE on ATK/DEF/HP: value/10 → multiplicative % bonus
    //   - OAT_RATE on percent stats (CHC/CHD/PEN/EFF/RES/DMG↑/DMG↓):
    //     value/10 → additive percentage points
    //   - OAT_ADD on percent stats: value/10 → additive percentage points
    //     (cri_team uses OAT_ADD with permille values — see admin route)
    //   - OAT_ADD on SPD/HP/etc.: flat
    const value = (isRate || isPermilleStat) ? rawValue / 10 : rawValue
    // For runtime apply: `'rate'` = multiplicative on dealer base
    // (ATK/DEF/HP only), `'add'` = additive (flat for SPD, percentage
    // points for percent stats).
    const apply: 'rate' | 'add' = isRate && !isPermilleStat ? 'rate' : 'add'
    out.push({ stat, value, apply })
  }
  return out
}

/**
 * Compute the chronological list of team-bonus unlocks across the char's
 * transcend chain. Walks tiers in TransStar order; emits one entry each
 * time a stat's resolved value CHANGES from the previous tier (initial
 * unlock or upgrade). Multiple entries per stat are normal for chars with
 * staged upgrades (e.g. `_team` → `_team_upgrade` → `_team_upgrade2`).
 */
function computeTeamBonusesByTier(
  charId: string,
  charTempletById: Map<string, CharacterTempletRow>,
  templetTiers: InternalTranscendTier[],
  skillLevelsBySkillIdLevel: Map<string, SkillLevelRow>,
  buffsByIdMaxLevel: Map<string, BuffRow>,
): Array<{ stat: string; value: number; apply: 'rate' | 'add'; fromTransStar: number }> {
  const charRow = charTempletById.get(charId)
  const skill8 = charRow?.Skill_8
  if (!skill8) return []

  // Walk tiers ascending; track the active version per stat. Emit a new
  // entry whenever (value, apply) changes vs. the previous active version.
  const sortedTiers = [...templetTiers].sort((a, b) => a.transStar - b.transStar)
  const lastEmittedByStat = new Map<string, { value: number; apply: 'rate' | 'add' }>()
  const out: Array<{ stat: string; value: number; apply: 'rate' | 'add'; fromTransStar: number }> = []

  for (const tier of sortedTiers) {
    if (tier.skillLevel <= 0) continue
    const active = resolveTeamBuffsAt(skill8, tier.skillLevel, skillLevelsBySkillIdLevel, buffsByIdMaxLevel)
    for (const buf of active) {
      const prev = lastEmittedByStat.get(buf.stat)
      if (!prev || prev.value !== buf.value || prev.apply !== buf.apply) {
        out.push({ stat: buf.stat, value: buf.value, apply: buf.apply, fromTransStar: tier.transStar })
        lastEmittedByStat.set(buf.stat, { value: buf.value, apply: buf.apply })
      }
    }
  }

  return out.sort((a, b) => a.fromTransStar - b.fromTransStar || a.stat.localeCompare(b.stat))
}

export async function buildTranscend(): Promise<{ chars: number; tiers: number }> {
  const [transcendRows, charList, raritiesById, charTempletRows, skillLevelRows, buffRows] = await Promise.all([
    loadJson2<TranscendRow[]>('CharacterTranscendentTemplet.json'),
    loadGenerated<CharacterListEntry[]>('characters-list.json'),
    loadCuratedRarities(),
    loadJson2<CharacterTempletRow[]>('CharacterTemplet.json'),
    loadJson2<SkillLevelRow[]>('CharacterSkillLevelTemplet.json'),
    loadJson2<BuffRow[]>('BuffTemplet.json'),
  ])

  const charTempletById       = indexCharTemplet(charTempletRows)
  const skillLevelsByKey      = indexSkillLevels(skillLevelRows)
  const buffsByIdMaxLevel     = indexBuffsByIdMaxLevel(buffRows)

  // Index 1: generic tiers per BasicStar (CharacterID === '0').
  const genericByStar = new Map<number, InternalTranscendTier[]>()
  for (const r of transcendRows) {
    if (r.CharacterID !== '0') continue
    const star = num(r.BasicStar)
    const arr = genericByStar.get(star) ?? []
    arr.push(rowToTier(r))
    genericByStar.set(star, arr)
  }

  // Index 2: per-char override tiers.
  const overrideByChar = new Map<string, InternalTranscendTier[]>()
  for (const r of transcendRows) {
    const cid = r.CharacterID
    if (!cid || cid === '0') continue
    const arr = overrideByChar.get(cid) ?? []
    arr.push(rowToTier(r))
    overrideByChar.set(cid, arr)
  }

  // Sort all tier arrays by transStar ascending — the UI iterates them in
  // tier order, and the merge step relies on ordered comparison.
  for (const arr of genericByStar.values()) {
    arr.sort((a, b) => a.transStar - b.transStar)
  }
  for (const arr of overrideByChar.values()) {
    arr.sort((a, b) => a.transStar - b.transStar)
  }

  // Index 3: teamBonuses per char from `characters-list.json`.
  const teamBonusesByChar = new Map<string, string[]>()
  for (const c of charList) {
    if (c.teamBonuses && c.teamBonuses.length > 0) {
      teamBonusesByChar.set(c.ID, c.teamBonuses)
    }
  }

  // Materialize per-char entries.
  // Iterate raritiesById so we cover every curated char (incl. CF variants
  // — they reuse their base star's generic tiers since they don't carry a
  // templet override of their own).
  const byChar: Record<string, TranscendCharEntry> = {}
  let tierCount = 0

  for (const [charId, basicStar] of raritiesById) {
    if (basicStar < 1) continue   // skip 0★ placeholders if any

    const override = overrideByChar.get(charId)
    const generic = genericByStar.get(basicStar) ?? []

    // When an override exists, replace generic rows tier-by-tier; missing
    // tiers fall through to generic. This handles partial overrides
    // gracefully (none observed today, but defensive).
    let internalTiers: InternalTranscendTier[]
    if (override && override.length > 0) {
      const byStar = new Map<number, InternalTranscendTier>()
      for (const t of generic) byStar.set(t.transStar, t)
      for (const t of override) byStar.set(t.transStar, t)
      internalTiers = Array.from(byStar.values()).sort((a, b) => a.transStar - b.transStar)
    } else {
      internalTiers = generic
    }

    if (internalTiers.length === 0) continue   // nothing to emit

    const entry: TranscendCharEntry = {
      basicStar,
      tiers: internalTiers.map(toPublicTier),
    }
    const teamBonuses = teamBonusesByChar.get(charId)
    if (teamBonuses) entry.teamBonuses = teamBonuses

    // Tier-gated bonuses — resolved directly from BuffTemplet via the
    // char's Skill_8 chain. Each entry carries the active value at its
    // unlock tier; runtime picks the latest entry per stat ≤ current tier.
    const byTier = computeTeamBonusesByTier(
      charId, charTempletById, internalTiers, skillLevelsByKey, buffsByIdMaxLevel,
    )
    if (byTier.length > 0) entry.teamBonusesByTier = byTier

    byChar[charId] = entry
    tierCount += internalTiers.length
  }

  const file: TranscendFile = { _v: SCHEMA_VERSION, byChar }
  await writeJsonMin('transcend.json', file)

  return { chars: Object.keys(byChar).length, tiers: tierCount }
}
