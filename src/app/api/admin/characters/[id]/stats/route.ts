import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

/**
 * GET /api/admin/characters/:id/stats
 *
 * Computes the full no-gear stat block for a playable character at lv 100,
 * fully evolved (ev6), fully transcended (max TransStar for its BasicStar),
 * with max Hero Codex, and all applicable Gift / Awakening nodes unlocked
 * (element + class + subclass; ADVENTURE_LICENSE / AAT_NONE is skipped —
 * per the in-game character sheet it doesn't contribute to the base display).
 *
 * Restricted to development (returns 403 in prod).
 *
 * ── Query params (all optional — defaults reproduce the "max everything" behavior) ──
 *   transcendStar   — numeric TransStar (e.g. 1, 3, 5, 9). Overrides the max-reachable
 *                     pick. BasicStar 1/2 path: 1→2→3→4→6→9; BasicStar 3 path: 3→4→5→6→7→8→9.
 *   codexLevel      — 0..11, picks the CharacterArchiveStatTemplet row at that ID
 *                     (defaults to max = 11; 0 disables codex entirely).
 *   disabledNodeIds — comma-sep list of CharacterAwakeningNodeTemplet IDs to skip in
 *                     the gift contributors (lets the UI toggle individual nodes off).
 *   disableAllGifts — '1'/'true' to drop every element/class/subclass gift contribution
 *                     (shortcut for "disable all quirks", avoids sending a huge CSV).
 *
 * ── Data sources (all under `data/admin/json2/`) ──────────────────────────
 *   CharacterTemplet                 — per-char base stats, class/element, skill IDs
 *   CharacterEvolutionStatTemplet    — flat bonuses per evolution tier (ev1..ev6)
 *   CharacterArchiveStatTemplet      — global Hero Codex %-multipliers (11 levels)
 *   CharacterTranscendentTemplet     — per-BasicStar transcend chain + Skill_8 unlocks
 *   CharacterSkillLevelTemplet       — buff IDs attached to each skill level
 *   BuffTemplet                      — buff definitions (BT_STAT_PREMIUM, BT_DMG, etc.)
 *   CharacterAwakeningNodeTemplet    — gift tree nodes (element/class/subclass)
 *   CharacterAwakeningLevelTemplet   — per-node leveling rewards (flat or buff-backed)
 *
 * ── Final formula ─────────────────────────────────────────────────────────
 * For ATK / DEF / HP — `calcStat(base, evoFlat, giftFlat, pctBonuses, codex, transcend)`:
 *   compound = ((1 + transcend/100) × (1 + pctBonuses/100) − 1) × 100
 *   onBase   = codex + compound               (applied to *_Max base stat)
 *   onFlat   = compound                       (applied to evo + gift flats; codex skipped)
 *   final    = floor(base × (1 + onBase/100) + (evoFlat + giftFlat) × (1 + onFlat/100))
 *
 *   Key insight: transcend% and classPct% compound multiplicatively — NOT
 *   additively. The interaction term (transcend × classPct / 100) is what
 *   makes 2000001 DEF reach 1507 (not 1463) and 2000002 ATK reach 1842 (not 1789).
 *   `pctBonuses` = sum of all % bonuses on ATK/DEF/HP from class passive,
 *   class main gift, Skill_8, etc.
 *
 * For SPD / EFF / RES: base + evo + giftFlat + classPass + skill8  (no multiplier).
 * For CHC / CHD / PEN: base + evo + sum of all % additive contributions.
 * For DMG Red / DMG Inc: base + evo + sum of all % additive contributions.
 *
 * ── Value encoding rules (from BuffTemplet/EvolutionTemplet) ──────────────
 *   - Percent stats (CHC, CHD, PEN, DMG_REDUCE, DMG_BOOST): value is per-mille
 *     (÷10 → percentage points).
 *   - ATK / DEF / HP with OAT_RATE: per-mille → folded into atkPct/defPct/hpPct.
 *   - ATK / DEF / HP with OAT_ADD: flat integer.
 *   - SPD / EFF / RES with OAT_ADD: flat integer.
 *   - SPD / EFF / RES with OAT_RATE: `floor(base × value / 1000)` — flat premium
 *     computed on (base + evo). Example: 2000102 Skill_8 ST_BUFF_RESIST OAT_RATE 60
 *     → floor(160 × 60/1000) = +9 → total RES 169.
 *
 * ── Response shape ────────────────────────────────────────────────────────
 *   {
 *     meta: { id, class, subclass, element, basicStar, level, transcendStar,
 *             evolutionLevel, codexLevel },
 *     contributors: [
 *       { source: 'base'           , fields: StatBlock           },  // CharacterTemplet *_Max
 *       { source: 'evolution'      , fields: StatBlock           },  // cumulative ev1..ev6 rewards
 *       { source: 'codex'          , fields: { atkPct, defPct, hpPct } },
 *       { source: 'transcend'      , fields: { atkPct, defPct, hpPct } },
 *       { source: 'classPassive'   , fields: Partial<StatBlock>  },  // Skill_22 premium buffs
 *       { source: 'skill8Passive'  , fields: Partial<StatBlock>  },  // transcend-unlocked buffs
 *       { source: 'elementGifts'   , fields: StatBlock           },
 *       { source: 'classGifts'     , fields: StatBlock           },
 *       { source: 'subclassGifts'  , fields: StatBlock           },
 *     ],
 *     final: StatBlock,
 *   }
 */

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

type Row = Record<string, string>

interface StatBlock {
  atk: number
  def: number
  hp: number
  spd: number
  chc: number         // Critical Chance (%)
  chd: number         // Critical Damage (%)
  chdReduce: number   // Crit Damage Reduction (%)
  pen: number         // Penetration (%)
  dmgInc: number      // Damage Increase (%)
  dmgRed: number      // Damage Reduction (%)
  eff: number         // Effectiveness (raw, matches BuffChance_Max display)
  res: number         // Resilience   (raw, matches BuffResist_Max display)
  atkPct: number      // % bonus on base ATK — folded into atk multiplier
  defPct: number      // % bonus on base DEF — folded into def multiplier
  hpPct: number       // % bonus on base HP  — folded into hp multiplier
}

interface Contributor {
  source: string
  description: string
  fields: Partial<StatBlock>
}

// ── Enum mappings (mirrors src/app/api/admin/damage-lab/_shared/extract-buffs.ts) ──
// Empirically decoded from NodeName text in CharacterAwakeningNodeTemplet.
const ELEMENT_INDEX: Record<string, number> = {
  CET_EARTH: 0, CET_WATER: 1, CET_FIRE: 2, CET_LIGHT: 3, CET_DARK: 4,
}
const CLASS_INDEX: Record<string, number> = {
  CCT_DEFENDER: 1, CCT_ATTACKER: 2, CCT_RANGER: 3, CCT_MAGE: 4, CCT_PRIEST: 5,
}
const SUBCLASS_INDEX: Record<string, number> = {
  ATTACKER: 1, BRUISER: 2, WIZARD: 3, ENCHANTER: 4,
  VANGUARD: 5, TACTICIAN: 6, SWEEPER: 7, PHALANX: 8,
  RELIEVER: 9, SAGE: 10,
}

// ── Helpers ────────────────────────────────────────────────────────────

async function loadTable(name: string): Promise<Row[]> {
  const raw = await fs.readFile(path.join(JSON2_DIR, `${name}.json`), 'utf-8')
  return JSON.parse(raw)
}

function num(v: string | undefined): number {
  if (!v) return 0
  const p = parseInt(v, 10)
  return Number.isFinite(p) ? p : 0
}

function splitCsv(s: string | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

function zeroStats(): StatBlock {
  return {
    atk: 0, def: 0, hp: 0, spd: 0,
    chc: 0, chd: 0, chdReduce: 0, pen: 0,
    dmgInc: 0, dmgRed: 0,
    eff: 0, res: 0,
    atkPct: 0, defPct: 0, hpPct: 0,
  }
}

// Strip zero-valued keys for compact contributor payloads.
function omitZero(s: StatBlock): Partial<StatBlock> {
  const out: Partial<StatBlock> = {}
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number' && v !== 0) (out as Record<string, number>)[k] = v
  }
  return out
}

// Pick the CharacterSkillLevelTemplet row at the requested SkillLevel (or the
// highest available level if `level` is omitted). Returns undefined if the skill
// has no rows.
function pickSkillLevelRow(rows: Row[], skillId: string, level?: number): Row | undefined {
  let best: Row | undefined
  for (const r of rows) {
    if (r.SkillID !== skillId) continue
    if (level != null) {
      if (num(r.SkillLevel) === level) return r
      continue
    }
    if (!best || num(r.SkillLevel) > num(best.SkillLevel)) best = r
  }
  return best
}

// BuffTemplet rows share BuffID across multiple Levels — resolve the max.
function pickMaxBuff(rows: Row[], buffId: string): Row | undefined {
  let best: Row | undefined
  for (const r of rows) {
    if (r.BuffID !== buffId) continue
    if (!best || num(r.Level) > num(best.Level)) best = r
  }
  return best
}

// ── Stat contributors ─────────────────────────────────────────────────

// 1. Base stats at lv 100 (CharacterTemplet *_Max columns).
//    Crit rate / Crit dmg are per-mille (÷10 → %). BuffChance / BuffResist
//    are raw (Outerplane displays them as integers, not percentages).
//
//    Known quirk: the in-game lv 100 base ATK/DEF is sometimes < *_Max by 1
//    due to the engine's float32 interpolation rounding — runtime behavior we
//    can't fully replicate from json2 alone (the binary dump is string-accurate,
//    and neither direct nor iterative float32 emulation reproduces the pattern
//    universally). Empirically, the 25 3-star CCT_ATTACKER / ATTACKER-subclass
//    chars all share base 930/247/3481 and lose 1 on ATK and DEF at lv 100
//    (HP unaffected). `needsAttackerLv100Patch` targets this template exactly.
function needsAttackerLv100Patch(row: Row): boolean {
  return row.Class === 'CCT_ATTACKER'
    && row.SubClass === 'ATTACKER'
    && num(row.BasicStar) === 3
    && num(row.Atk_Max) === 930
    && num(row.Def_Max) === 247
}

function extractBase(row: Row): StatBlock {
  const patch = needsAttackerLv100Patch(row) ? 1 : 0
  return {
    atk: num(row.Atk_Max) - patch,
    def: num(row.Def_Max) - patch,
    hp:  num(row.HP_Max),
    spd: num(row.Speed_Max),
    chc: num(row.CriticalRate_Max) / 10,
    chd: num(row.CriticalDMGRate_Max) / 10,
    chdReduce: 0,
    pen: 0,
    dmgInc: 0,
    dmgRed: 0,
    eff: num(row.BuffChance_Max),
    res: num(row.BuffResist_Max),
    atkPct: 0, defPct: 0, hpPct: 0,
  }
}

// 2. Evolution (CharacterEvolutionStatTemplet) — flat cumulative bonus
//    from the lv 20 / 40 / 60 / 80 / 100 upgrade tiers.
//    ST_ATK / ST_DEF / ST_HP / ST_SPEED are flat integers.
//    ST_BUFF_CHANCE / ST_BUFF_RESIST are raw (matches in-game EFF/RES display).
//    ST_CRITICAL_RATE / ST_CRITICAL_DMG_RATE are per-mille (÷10 → %).
function extractEvolution(evoStats: Row[], charId: string): StatBlock {
  const out = zeroStats()
  for (const r of evoStats) {
    if (r.CharacterID !== charId) continue
    for (let i = 1; i <= 3; i++) {
      const t = r[`RewardStatType_${i}`]
      const v = num(r[`RewardValue_${i}`])
      if (t === 'ST_ATK')                    out.atk += v
      else if (t === 'ST_DEF')               out.def += v
      else if (t === 'ST_HP')                out.hp += v
      else if (t === 'ST_SPEED')             out.spd += v
      else if (t === 'ST_BUFF_CHANCE')       out.eff += v
      else if (t === 'ST_BUFF_RESIST')       out.res += v
      else if (t === 'ST_CRITICAL_RATE')     out.chc += v / 10
      else if (t === 'ST_CRITICAL_DMG_RATE') out.chd += v / 10
      else if (t === 'ST_DMG_BOOST')         out.dmgInc += v / 10
      else if (t === 'ST_DMG_REDUCE_RATE')   out.dmgRed += v / 10
      else if (t === 'ST_PIERCE_POWER_RATE') out.pen += v / 10
    }
  }
  return out
}

// 3. Hero Codex (CharacterArchiveStatTemplet) — picks the row matching `targetLevel`
//    (defaults to max = Lv 11). Atk_Rate / Def_Rate / HP_Rate are per-mille
//    (÷10 → %) multipliers applied to the base stat.
function extractCodex(archiveStats: Row[], targetLevel?: number): { atkPct: number; defPct: number; hpPct: number; level: number } {
  const row = targetLevel != null
    ? archiveStats.find(r => num(r.ID) === targetLevel)
    : archiveStats.reduce((best, r) => (num(r.ID) > num(best.ID) ? r : best), archiveStats[0])
  if (!row) return { atkPct: 0, defPct: 0, hpPct: 0, level: 0 }
  return {
    atkPct: num(row.Atk_Rate) / 10,
    defPct: num(row.Def_Rate) / 10,
    hpPct:  num(row.HP_Rate)  / 10,
    level:  num(row.ID),
  }
}

// 4. Transcendence (CharacterTranscendentTemplet) — picks the row at `targetStar`
//    (defaults to the highest reachable TransStar for this BasicStar), or a
//    char-specific override when the table has CharacterID != "0" rows.
//    The Reward*Rate columns are cumulative %-multipliers at that star,
//    stored per-mille (÷10 → %). `skillLevel` is the Skill_8 level unlocked
//    at that star (used by contributor #6).
function extractTranscend(transcendent: Row[], basicStar: number, charId: string, targetStar?: number) {
  // Char-specific rows override the default BasicStar rows.
  const charSpecific = transcendent.filter(r => r.CharacterID === charId)
  const pool = charSpecific.length > 0
    ? charSpecific
    : transcendent.filter(r => r.CharacterID === '0' && num(r.BasicStar) === basicStar)

  // Keep only reachable rows (rows with NextStar=0 AND zero rewards are dead-end
  // placeholders the game never stops at — e.g. TransStar 5/7/8 for BasicStar 2).
  const reachable = pool.filter(r =>
    num(r.NextStar) !== 0 ||
    num(r.RewardAtkRate) + num(r.RewardDefRate) + num(r.RewardHPRate) > 0
  )
  const row = targetStar != null
    ? reachable.find(r => num(r.TransStar) === targetStar)
    : reachable.reduce((best, r) => (num(r.TransStar) > num(best.TransStar) ? r : best), reachable[0])
  if (!row) return { atkPct: 0, defPct: 0, hpPct: 0, star: 0, skillLevel: 0 }
  return {
    atkPct: num(row.RewardAtkRate) / 10,
    defPct: num(row.RewardDefRate) / 10,
    hpPct:  num(row.RewardHPRate)  / 10,
    star:   num(row.TransStar),
    skillLevel: num(row.SkillLevel),
  }
}

// Parse a BT_STAT_PREMIUM / cond=NONE buff into a StatBlock delta. Used by both
// the Skill_22 class passive and Skill_8 transcendent-passive contributors.
// Returns true if the buff contributed something (so the caller can log the buffId).
// Rules:
//   - Percent stats (CHC / CHD / PEN / DMG_RED / DMG_INC) — value is per-mille
//     (÷10 → percentage points), regardless of rate/add.
//   - ATK / DEF / HP with OAT_RATE → atkPct/defPct/hpPct (applied in multiplier).
//   - ATK / DEF / HP / SPD / EFF / RES with OAT_ADD → added as flat.
//   - SPD / EFF / RES with OAT_RATE → computed as flat on (base + evo), matching
//     the pipeline's `computePremiumValue` logic (floor(baseStat × value / 1000)).
//     Example: 2000102 Skill_8 lv4 `trancendent_8_buff_resist_team_upgrade`
//     (ST_BUFF_RESIST OAT_RATE 60) → +6% of base RES 160 = +9 → total 169.
function applyPremiumBuff(dest: StatBlock, buff: Row, baseForRate: { spd: number; eff: number; res: number }): boolean {
  if (buff.Type !== 'BT_STAT_PREMIUM') return false
  if ((buff.BuffConditionType ?? 'NONE') !== 'NONE') return false
  const value = num(buff.Value)
  const rate  = buff.ApplyingType === 'OAT_RATE'
  const add   = buff.ApplyingType === 'OAT_ADD'
  if (!rate && !add) return false

  // Percent stats (pure % contributions, value is per-mille)
  if (buff.StatType === 'ST_CRITICAL_RATE')     { dest.chc    += value / 10; return true }
  if (buff.StatType === 'ST_CRITICAL_DMG_RATE') { dest.chd    += value / 10; return true }
  if (buff.StatType === 'ST_PIERCE_POWER_RATE') { dest.pen    += value / 10; return true }
  if (buff.StatType === 'ST_DMG_REDUCE_RATE')   { dest.dmgRed += value / 10; return true }
  if (buff.StatType === 'ST_DMG_BOOST')         { dest.dmgInc += value / 10; return true }

  // Absolute stats — OAT_RATE goes into the %-multiplier bucket, OAT_ADD is flat.
  if (buff.StatType === 'ST_ATK') {
    if (rate) dest.atkPct += value / 10
    else      dest.atk    += value
    return true
  }
  if (buff.StatType === 'ST_DEF') {
    if (rate) dest.defPct += value / 10
    else      dest.def    += value
    return true
  }
  if (buff.StatType === 'ST_HP') {
    if (rate) dest.hpPct += value / 10
    else      dest.hp    += value
    return true
  }
  // Flat-display stats: OAT_RATE is resolved into a flat premium on base+evo.
  if (buff.StatType === 'ST_SPEED') {
    if (rate) dest.spd += Math.floor(baseForRate.spd * value / 1000)
    else      dest.spd += value
    return true
  }
  if (buff.StatType === 'ST_BUFF_CHANCE') {
    if (rate) dest.eff += Math.floor(baseForRate.eff * value / 1000)
    else      dest.eff += value
    return true
  }
  if (buff.StatType === 'ST_BUFF_RESIST') {
    if (rate) dest.res += Math.floor(baseForRate.res * value / 1000)
    else      dest.res += value
    return true
  }
  return false
}

// 5. Class passive — Skill_22 holds the ID of the class's shared passive skill
//    (1=DEFENDER, 2=ATTACKER, ..., 5=PRIEST). The passive skill has level rows
//    in CharacterSkillLevelTemplet whose BuffID column CSV-lists BuffTemplet
//    entries. We keep only BT_STAT_PREMIUM / cond=NONE buffs (always-on stat
//    modifiers) and sum their %-rate adjustments.
//
//    For 2000001 (DEFENDER): Skill_22 = 1 → DEFENDER_PASSIVE_2 (+15% DEF).
//    For 2000002 (ATTACKER): Skill_22 = 2 → ATTACKER_PASSIVE_2 (+5% CHC).
function extractClassPassive(
  row: Row,
  skillLevels: Row[],
  buffs: Row[],
  baseForRate: { spd: number; eff: number; res: number },
): StatBlock & { breakdown: string[] } {
  const out = Object.assign(zeroStats(), { breakdown: [] as string[] })
  const skillId = row.Skill_22
  if (!skillId) return out
  const levelRow = pickSkillLevelRow(skillLevels, skillId)
  for (const bid of splitCsv(levelRow?.BuffID)) {
    const b = pickMaxBuff(buffs, bid)
    if (!b) continue
    if (applyPremiumBuff(out, b, baseForRate)) out.breakdown.push(bid)
  }
  return out
}

// 6. Skill_8 transcendent passive — unlocked progressively by TransStar.
//    At TransStar 9 (SkillLevel 4 for BasicStar 2), 2000001 gains
//    `trancendent_8_dmg_reduce_rate_upgrade` → +4.8% DMG Reduction, and
//    2000002 gains `trancendent_8_cri_dmg_upgrade` → +8% CHD.
function extractSkill8Passive(
  row: Row,
  skillLevels: Row[],
  buffs: Row[],
  skillLevel: number,
  baseForRate: { spd: number; eff: number; res: number },
): StatBlock & { breakdown: string[] } {
  const out = Object.assign(zeroStats(), { breakdown: [] as string[] })
  const skillId = row.Skill_8
  if (!skillId || skillLevel <= 0) return out
  const levelRow = pickSkillLevelRow(skillLevels, skillId, skillLevel)
  for (const bid of splitCsv(levelRow?.BuffID)) {
    const b = pickMaxBuff(buffs, bid)
    if (!b) continue
    if (applyPremiumBuff(out, b, baseForRate)) out.breakdown.push(bid)
  }
  return out
}

// 7-9. Gift / Awakening nodes — split into three scopes: element, class, subclass.
//    Walks CharacterAwakeningNodeTemplet, keeps groups whose ApplyType + value
//    matches the character's element / class / subclass index. For each kept
//    group, resolves the max-level row in CharacterAwakeningLevelTemplet:
//      - IOT_STAT rows store StatType / ApplyingType / OptionValue inline.
//      - IOT_BUFF rows resolve via BuffTemplet (max-Level row). Conditional
//        buffs (BuffConditionType != NONE) are skipped — they aren't part of
//        the permanent character sheet.
//
//    ADVENTURE_LICENSE (AAT_NONE / ADVENTURE_LICENSE) is intentionally NOT
//    consumed here; per the ingame character sheet it doesn't apply to the
//    no-gear base display.
function accumulateGiftBonus(dest: StatBlock, levelRow: Row, buffs: Row[]): void {
  let statType = levelRow.StatType ?? 'ST_NONE'
  let applying = levelRow.ApplyingType ?? 'OAT_NONE'
  let value    = num(levelRow.OptionValue)
  let condition = 'NONE'

  if (levelRow.OptionType === 'IOT_BUFF' && levelRow.BuffID) {
    const b = pickMaxBuff(buffs, levelRow.BuffID)
    if (!b) return
    // Only surface permanent stat buffs (BT_STAT_PREMIUM). BT_DMG / BT_DMG_REDUCE /
    // BT_STAT are combat-triggered and don't show up on the no-gear character sheet.
    // Example skipped: DEFENDER_PASSIVE_3_10 (BT_DMG_REDUCE), MAGE_PASSIVE_3_10 (BT_DMG),
    // Awakening_Element_Dmg_10 (BT_DMG).
    if (b.Type !== 'BT_STAT_PREMIUM') return
    statType = b.StatType
    applying = b.ApplyingType
    value    = num(b.Value)
    condition = b.BuffConditionType ?? 'NONE'
  }
  if (condition !== 'NONE') return  // conditional buffs are not display stats

  const rate = applying === 'OAT_RATE'
  const add  = applying === 'OAT_ADD'
  if (!rate && !add) return

  // Percent stats: value is per-mille (÷10 → percentage points), regardless of rate/add.
  if (statType === 'ST_CRITICAL_RATE')           { dest.chc    += value / 10; return }
  if (statType === 'ST_CRITICAL_DMG_RATE')       { dest.chd    += value / 10; return }
  if (statType === 'ST_PIERCE_POWER_RATE')       { dest.pen    += value / 10; return }
  if (statType === 'ST_DMG_REDUCE_RATE')         { dest.dmgRed += value / 10; return }
  if (statType === 'ST_DMG_BOOST')               { dest.dmgInc += value / 10; return }

  // Absolute stats — OAT_RATE goes into the %-multiplier bucket (e.g. ATTACKER
  // class main gift ATTACKER_PASSIVE_3_10: +15% ATK); OAT_ADD is flat.
  if (statType === 'ST_ATK') {
    if (rate) dest.atkPct += value / 10
    else      dest.atk    += value
    return
  }
  if (statType === 'ST_DEF') {
    if (rate) dest.defPct += value / 10
    else      dest.def    += value
    return
  }
  if (statType === 'ST_HP') {
    if (rate) dest.hpPct += value / 10
    else      dest.hp    += value
    return
  }
  if (add) {
    if (statType === 'ST_SPEED')       dest.spd += value
    else if (statType === 'ST_BUFF_CHANCE') dest.eff += value
    else if (statType === 'ST_BUFF_RESIST') dest.res += value
  }
}

function extractGifts(
  row: Row,
  awakNodes: Row[],
  awakLevels: Row[],
  buffs: Row[],
  disabledNodeIds: Set<string>,
): { element: StatBlock; klass: StatBlock; subclass: StatBlock } {
  const elemIdx  = ELEMENT_INDEX[row.Element ?? '']   ?? -1
  const classIdx = CLASS_INDEX[row.Class ?? '']       ?? -1
  const subIdx   = SUBCLASS_INDEX[row.SubClass ?? ''] ?? -1

  // Index awakening levels by group → max-AwakeningLevel row.
  const levelByGroup = new Map<string, Row>()
  for (const r of awakLevels) {
    const gid = r.AwakeningLevelGroupID
    if (!gid) continue
    const existing = levelByGroup.get(gid)
    if (!existing || num(r.AwakeningLevel) > num(existing.AwakeningLevel)) {
      levelByGroup.set(gid, r)
    }
  }

  // Walk nodes; each node is an independent "slot" that contributes its max-level
  // row. Multiple nodes referencing the same gid (e.g. three SWEEPER +100 ATK nodes
  // all pointing to group 20601) each add their bonus separately — this matches
  // the in-game tree where every sub-node is individually leveled.
  const out = { element: zeroStats(), klass: zeroStats(), subclass: zeroStats() }
  for (const node of awakNodes) {
    if (disabledNodeIds.has(node.ID)) continue
    const gid = node.AwakeningLevelGroupID
    if (!gid) continue
    const v = num(node.AwakeningApplyTypeValue)
    let bucket: StatBlock | null = null
    if (node.AwakeningApplyType === 'AAT_ELEMENTAL' && v === elemIdx)   bucket = out.element
    else if (node.AwakeningApplyType === 'AAT_CLASS' && v === classIdx)  bucket = out.klass
    else if (node.AwakeningApplyType === 'AAT_SUBCLASS' && v === subIdx) bucket = out.subclass
    if (!bucket) continue
    const lvlRow = levelByGroup.get(gid)
    if (!lvlRow) continue
    accumulateGiftBonus(bucket, lvlRow, buffs)
  }
  return out
}

// ── Assembly ───────────────────────────────────────────────────────────

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  // Optional overrides. When omitted, the route returns "max everything" stats
  // (the original behavior): highest reachable TransStar, Codex lv 11, no disabled gifts.
  const url = new URL(request.url)
  const transcendStarParam   = url.searchParams.get('transcendStar')
  const codexLevelParam      = url.searchParams.get('codexLevel')
  const disabledParam        = url.searchParams.get('disabledNodeIds')
  const disableAllGiftsParam = url.searchParams.get('disableAllGifts')
  const targetTranscend = transcendStarParam != null ? parseInt(transcendStarParam, 10) : undefined
  const targetCodex     = codexLevelParam    != null ? parseInt(codexLevelParam, 10)    : undefined
  const disabledNodeIds = new Set(
    (disabledParam ?? '').split(',').map(s => s.trim()).filter(Boolean),
  )
  const disableAllGifts = disableAllGiftsParam === '1' || disableAllGiftsParam === 'true'

  const [
    charTemplet,
    evoStats,
    archiveStats,
    transcendent,
    skillLevels,
    buffs,
    awakLevels,
    awakNodes,
    fusionTemplet,
  ] = await Promise.all([
    loadTable('CharacterTemplet'),
    loadTable('CharacterEvolutionStatTemplet'),
    loadTable('CharacterArchiveStatTemplet'),
    loadTable('CharacterTranscendentTemplet'),
    loadTable('CharacterSkillLevelTemplet'),
    loadTable('BuffTemplet'),
    loadTable('CharacterAwakeningLevelTemplet'),
    loadTable('CharacterAwakeningNodeTemplet'),
    loadTable('CharacterFusionTemplet'),
  ])

  const row = charTemplet.find(r => r.ID === id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Core Fusion characters (e.g. 2700037) share their evolution rewards with
  // the source character (2000037) via CharacterFusionTemplet.ChangeCharID →
  // CharacterID. Resolve the source ID for table lookups that are keyed on
  // CharacterID; awakening/codex/transcend lookups are unaffected (no per-char
  // rows for fusion variants exist in those tables).
  const fusionRow = fusionTemplet.find(r => r.ChangeCharID === id)
  const evoCharId = fusionRow?.CharacterID ?? id

  const basicStar = num(row.BasicStar)
  const base       = extractBase(row)
  const evo        = extractEvolution(evoStats, evoCharId)
  const codex      = extractCodex(archiveStats, targetCodex)
  const transcend  = extractTranscend(transcendent, basicStar, id, targetTranscend)
  const baseForRate = { spd: base.spd + evo.spd, eff: base.eff + evo.eff, res: base.res + evo.res }
  const classPass  = extractClassPassive(row, skillLevels, buffs, baseForRate)
  const skill8     = extractSkill8Passive(row, skillLevels, buffs, transcend.skillLevel, baseForRate)
  const gifts      = disableAllGifts
    ? { element: zeroStats(), klass: zeroStats(), subclass: zeroStats() }
    : extractGifts(row, awakNodes, awakLevels, buffs, disabledNodeIds)

  // Sum every flat and percent contribution from the three gift scopes into a
  // single giftTotal bucket. Class passive and Skill_8 contributions stay in
  // their own blocks so the contributor breakdown remains auditable.
  const giftTotal: StatBlock = zeroStats()
  for (const g of [gifts.element, gifts.klass, gifts.subclass]) {
    giftTotal.atk += g.atk; giftTotal.def += g.def; giftTotal.hp += g.hp; giftTotal.spd += g.spd
    giftTotal.eff += g.eff; giftTotal.res += g.res
    giftTotal.chc += g.chc; giftTotal.chd += g.chd; giftTotal.pen += g.pen
    giftTotal.dmgRed += g.dmgRed; giftTotal.dmgInc += g.dmgInc
    giftTotal.atkPct += g.atkPct; giftTotal.defPct += g.defPct; giftTotal.hpPct += g.hpPct
  }

  // ATK / DEF / HP formula — see header doc for full explanation.
  function calcStat(baseMax: number, evoFlat: number, flat: number, pctBonuses: number, codexPct: number, transcendPct: number): number {
    const compoundPct = ((1 + transcendPct / 100) * (1 + pctBonuses / 100) - 1) * 100
    const onBase = codexPct + compoundPct
    const onFlat = compoundPct
    return Math.floor(baseMax * (1 + onBase / 100) + (evoFlat + flat) * (1 + onFlat / 100))
  }

  const atkPctBonus = classPass.atkPct + skill8.atkPct + giftTotal.atkPct
  const defPctBonus = classPass.defPct + skill8.defPct + giftTotal.defPct
  const hpPctBonus  = classPass.hpPct  + skill8.hpPct  + giftTotal.hpPct

  const final: StatBlock = {
    atk: calcStat(base.atk, evo.atk, giftTotal.atk, atkPctBonus, codex.atkPct, transcend.atkPct),
    def: calcStat(base.def, evo.def, giftTotal.def, defPctBonus, codex.defPct, transcend.defPct),
    hp:  calcStat(base.hp,  evo.hp,  giftTotal.hp,  hpPctBonus,  codex.hpPct,  transcend.hpPct),
    spd: base.spd + evo.spd + giftTotal.spd + classPass.spd + skill8.spd,
    chc: base.chc + evo.chc + giftTotal.chc + classPass.chc + skill8.chc,
    chd: base.chd + evo.chd + giftTotal.chd + classPass.chd + skill8.chd,
    chdReduce: 0,
    pen: base.pen + evo.pen + giftTotal.pen + classPass.pen + skill8.pen,
    dmgInc: base.dmgInc + evo.dmgInc + giftTotal.dmgInc + classPass.dmgInc + skill8.dmgInc,
    dmgRed: base.dmgRed + evo.dmgRed + giftTotal.dmgRed + classPass.dmgRed + skill8.dmgRed,
    eff: base.eff + evo.eff + giftTotal.eff + classPass.eff + skill8.eff,
    res: base.res + evo.res + giftTotal.res + classPass.res + skill8.res,
    atkPct: 0, defPct: 0, hpPct: 0, // folded into atk/def/hp above
  }

  const contributors: Contributor[] = [
    {
      source: 'base',
      description: 'CharacterTemplet *_Max (lv 100 base stats)',
      fields: base,
    },
    {
      source: 'evolution',
      description: 'CharacterEvolutionStatTemplet — flat bonuses from lv 20/40/60/80/100 upgrade tiers',
      fields: evo,
    },
    {
      source: 'codex',
      description: `CharacterArchiveStatTemplet Lv ${codex.level} — %-multipliers on base ATK/DEF/HP`,
      fields: { atkPct: codex.atkPct, defPct: codex.defPct, hpPct: codex.hpPct },
    },
    {
      source: 'transcend',
      description: `CharacterTranscendentTemplet TransStar ${transcend.star} — cumulative % bonus; also unlocks Skill_8 lvl ${transcend.skillLevel}`,
      fields: { atkPct: transcend.atkPct, defPct: transcend.defPct, hpPct: transcend.hpPct },
    },
    {
      source: 'classPassive',
      description: `Skill_22 (class passive) BT_STAT_PREMIUM / cond=NONE buffs — ${classPass.breakdown.join(', ') || 'none'}`,
      fields: omitZero(classPass),
    },
    {
      source: 'skill8Passive',
      description: `Skill_8 lvl ${transcend.skillLevel} — ${skill8.breakdown.join(', ') || 'none'}`,
      fields: omitZero(skill8),
    },
    {
      source: 'elementGifts',
      description: `CharacterAwakeningNodeTemplet AAT_ELEMENTAL for ${row.Element ?? '?'}`,
      fields: gifts.element,
    },
    {
      source: 'classGifts',
      description: `CharacterAwakeningNodeTemplet AAT_CLASS for ${row.Class ?? '?'}`,
      fields: gifts.klass,
    },
    {
      source: 'subclassGifts',
      description: `CharacterAwakeningNodeTemplet AAT_SUBCLASS for ${row.SubClass ?? '?'}`,
      fields: gifts.subclass,
    },
  ]

  return NextResponse.json({
    meta: {
      id: row.ID,
      class: row.Class ?? null,
      subclass: row.SubClass ?? null,
      element: row.Element ?? null,
      basicStar,
      level: 100,
      transcendStar: transcend.star,
      evolutionLevel: 'max',
      codexLevel: codex.level,
    },
    contributors,
    final,
  })
}
