import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

/**
 * GET /api/admin/characters/:id/stats
 *
 * Computes the full no-gear stat block for a playable character at lv 100,
 * fully evolved (ev6), fully transcended (max TransStar for its BasicStar),
 * with max Hero Codex, and all applicable Gift / Awakening nodes unlocked
 * (element + class + subclass; ADVENTURE_LICENSE is intentionally skipped).
 *
 * The response splits the final stats into a `contributors` array so each
 * source (base, evolution, codex, transcend, class passive, Skill_8 passive,
 * element gifts, class gifts, subclass gifts) can be audited independently
 * against the in-game display.
 *
 * All inputs come from `data/admin/json2/` tables. No value conversion is
 * done at the boundary — every per-mille → % conversion is commented where
 * it happens so the raw game values stay traceable.
 *
 * Restricted to development (returns 403 in prod).
 *
 * Response shape:
 *   {
 *     meta: { id, class, subclass, element, basicStar, level, transcendStar, evolutionLevel, codexLevel },
 *     contributors: Array<{ source, description, fields: Partial<StatBlock> }>,
 *     final: StatBlock,
 *   }
 *
 * where StatBlock = {
 *   atk, def, hp, spd,
 *   chc, chd, chdReduce, pen,     // %
 *   dmgInc, dmgRed,               // %
 *   eff, res,                     // raw (Outerplane displays these as flat ints)
 * }
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
}

interface Contributor {
  source: string
  description: string
  fields: Partial<StatBlock> & { atkPct?: number; defPct?: number; hpPct?: number }
}

// ── Enum mappings (mirrors src/app/api/admin/damage-lab/quirks/route.ts) ──
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
  }
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
function extractBase(row: Row): StatBlock {
  return {
    atk: num(row.Atk_Max),
    def: num(row.Def_Max),
    hp: num(row.HP_Max),
    spd: num(row.Speed_Max),
    chc: num(row.CriticalRate_Max) / 10,
    chd: num(row.CriticalDMGRate_Max) / 10,
    chdReduce: 0,
    pen: 0,
    dmgInc: 0,
    dmgRed: 0,
    eff: num(row.BuffChance_Max),
    res: num(row.BuffResist_Max),
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
    }
  }
  return out
}

// 3. Hero Codex (CharacterArchiveStatTemplet) — picks the max-ID row (Lv 11).
//    Atk_Rate / Def_Rate / HP_Rate are per-mille (÷10 → %) multipliers applied
//    to the base stat.
function extractCodex(archiveStats: Row[]): { atkPct: number; defPct: number; hpPct: number; level: number } {
  const maxRow = archiveStats.reduce((best, r) => (num(r.ID) > num(best.ID) ? r : best), archiveStats[0])
  return {
    atkPct: num(maxRow.Atk_Rate) / 10,
    defPct: num(maxRow.Def_Rate) / 10,
    hpPct:  num(maxRow.HP_Rate)  / 10,
    level:  num(maxRow.ID),
  }
}

// 4. Transcendence (CharacterTranscendentTemplet) — picks the highest reachable
//    TransStar row for this BasicStar (or char-specific override when the table
//    has CharacterID != "0" rows, used for a few hand-tuned chars).
//    The Reward*Rate columns are cumulative %-multipliers at that star,
//    stored per-mille (÷10 → %). `skillLevel` is the Skill_8 level unlocked
//    at that star (used by contributor #6).
function extractTranscend(transcendent: Row[], basicStar: number, charId: string) {
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
  const row = reachable.reduce((best, r) => (num(r.TransStar) > num(best.TransStar) ? r : best), reachable[0])
  if (!row) return { atkPct: 0, defPct: 0, hpPct: 0, star: 0, skillLevel: 0 }
  return {
    atkPct: num(row.RewardAtkRate) / 10,
    defPct: num(row.RewardDefRate) / 10,
    hpPct:  num(row.RewardHPRate)  / 10,
    star:   num(row.TransStar),
    skillLevel: num(row.SkillLevel),
  }
}

// 5. Class passive — Skill_22 holds the ID of the class's shared passive skill
//    (1=DEFENDER, 2=ATTACKER, ..., 5=PRIEST). The passive skill has level rows
//    in CharacterSkillLevelTemplet whose BuffID column CSV-lists BuffTemplet
//    entries. We keep only BT_STAT_PREMIUM / cond=NONE buffs (always-on stat
//    modifiers) and sum their %-rate adjustments.
//
//    For 2000001 (DEFENDER): Skill_22 = 1 → DEFENDER_PASSIVE_2 (+15% DEF).
function extractClassPassive(
  row: Row,
  skillLevels: Row[],
  buffs: Row[],
): { atkPct: number; defPct: number; hpPct: number; breakdown: Array<{ buffId: string; stat: string; pct: number }> } {
  const out = { atkPct: 0, defPct: 0, hpPct: 0, breakdown: [] as Array<{ buffId: string; stat: string; pct: number }> }
  const skillId = row.Skill_22
  if (!skillId) return out
  const levelRow = pickSkillLevelRow(skillLevels, skillId)
  for (const bid of splitCsv(levelRow?.BuffID)) {
    const b = pickMaxBuff(buffs, bid)
    if (!b) continue
    if (b.Type !== 'BT_STAT_PREMIUM') continue
    if ((b.BuffConditionType ?? 'NONE') !== 'NONE') continue
    if (b.ApplyingType !== 'OAT_RATE') continue
    const pct = num(b.Value) / 10
    if (b.StatType === 'ST_ATK')      { out.atkPct += pct; out.breakdown.push({ buffId: bid, stat: 'ATK', pct }) }
    else if (b.StatType === 'ST_DEF') { out.defPct += pct; out.breakdown.push({ buffId: bid, stat: 'DEF', pct }) }
    else if (b.StatType === 'ST_HP')  { out.hpPct  += pct; out.breakdown.push({ buffId: bid, stat: 'HP',  pct }) }
  }
  return out
}

// 6. Skill_8 transcendent passive — unlocked progressively by TransStar.
//    At TransStar 9 (SkillLevel 4 for BasicStar 2), char 2000001 gains
//    `trancendent_8_dmg_reduce_rate_upgrade` → +4.8% DMG Reduction.
//    We only surface ST_DMG_REDUCE_RATE here since that's the only display
//    stat the trancendent_8_* line touches; AP / skill effects are out of
//    scope for the character sheet.
function extractSkill8Passive(
  row: Row,
  skillLevels: Row[],
  buffs: Row[],
  skillLevel: number,
): { dmgRedPct: number; buffId: string | null } {
  const out: { dmgRedPct: number; buffId: string | null } = { dmgRedPct: 0, buffId: null }
  const skillId = row.Skill_8
  if (!skillId || skillLevel <= 0) return out
  const levelRow = pickSkillLevelRow(skillLevels, skillId, skillLevel)
  for (const bid of splitCsv(levelRow?.BuffID)) {
    const b = pickMaxBuff(buffs, bid)
    if (!b) continue
    if (b.Type !== 'BT_STAT_PREMIUM') continue
    if (b.StatType === 'ST_DMG_REDUCE_RATE' && b.ApplyingType === 'OAT_ADD') {
      out.dmgRedPct += num(b.Value) / 10
      out.buffId = bid
    }
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

  // Flat stats (OAT_ADD) on absolute stat types.
  if (add) {
    if (statType === 'ST_ATK')   dest.atk += value
    else if (statType === 'ST_DEF') dest.def += value
    else if (statType === 'ST_HP')  dest.hp  += value
    else if (statType === 'ST_SPEED') dest.spd += value
    else if (statType === 'ST_BUFF_CHANCE') dest.eff += value
    else if (statType === 'ST_BUFF_RESIST') dest.res += value
  }
  // OAT_RATE on absolute stats (ATK/DEF/HP) would be a % bonus — our current
  // element/class/subclass gifts don't use this shape, so we skip it to keep
  // the contributor list auditable. Adventure License does, but it's excluded.
}

function extractGifts(
  row: Row,
  awakNodes: Row[],
  awakLevels: Row[],
  buffs: Row[],
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

  // Walk nodes; classify each gid into one of the three scopes.
  // Same gid can be referenced by multiple nodes (e.g. shared across subclass
  // variants) — first match wins, so we only count the bonus once.
  const scope = new Map<string, 'element' | 'class' | 'subclass'>()
  for (const node of awakNodes) {
    const gid = node.AwakeningLevelGroupID
    if (!gid || scope.has(gid)) continue
    const v = num(node.AwakeningApplyTypeValue)
    if (node.AwakeningApplyType === 'AAT_ELEMENTAL' && v === elemIdx)  scope.set(gid, 'element')
    else if (node.AwakeningApplyType === 'AAT_CLASS' && v === classIdx) scope.set(gid, 'class')
    else if (node.AwakeningApplyType === 'AAT_SUBCLASS' && v === subIdx) scope.set(gid, 'subclass')
  }

  const out = { element: zeroStats(), klass: zeroStats(), subclass: zeroStats() }
  for (const [gid, kind] of scope) {
    const lvlRow = levelByGroup.get(gid)
    if (!lvlRow) continue
    const bucket = kind === 'element' ? out.element : kind === 'class' ? out.klass : out.subclass
    accumulateGiftBonus(bucket, lvlRow, buffs)
  }
  return out
}

// ── Assembly ───────────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const [
    charTemplet,
    evoStats,
    archiveStats,
    transcendent,
    skillLevels,
    buffs,
    awakLevels,
    awakNodes,
  ] = await Promise.all([
    loadTable('CharacterTemplet'),
    loadTable('CharacterEvolutionStatTemplet'),
    loadTable('CharacterArchiveStatTemplet'),
    loadTable('CharacterTranscendentTemplet'),
    loadTable('CharacterSkillLevelTemplet'),
    loadTable('BuffTemplet'),
    loadTable('CharacterAwakeningLevelTemplet'),
    loadTable('CharacterAwakeningNodeTemplet'),
  ])

  const row = charTemplet.find(r => r.ID === id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const basicStar = num(row.BasicStar)
  const base       = extractBase(row)
  const evo        = extractEvolution(evoStats, id)
  const codex      = extractCodex(archiveStats)
  const transcend  = extractTranscend(transcendent, basicStar, id)
  const classPass  = extractClassPassive(row, skillLevels, buffs)
  const skill8     = extractSkill8Passive(row, skillLevels, buffs, transcend.skillLevel)
  const gifts      = extractGifts(row, awakNodes, awakLevels, buffs)

  // ── Final stats formula (best-effort reconstruction from json2 alone) ─
  //    ATK / DEF / HP: (base + evolution + giftFlat) × (1 + codex% + transcend% + classPassive%)
  //    SPD / EFF / RES: base + evolution + giftFlat  (no % modifier)
  //    CHC / CHD / PEN: base + evolution + giftPercent  (additive %)
  //    DMG Reduction:   base + Skill_8 transcendent passive + giftPercent
  //
  //  giftFlat bundles element+class+subclass flats; giftPercent bundles the % parts.
  const giftFlat = {
    atk: gifts.element.atk + gifts.klass.atk + gifts.subclass.atk,
    def: gifts.element.def + gifts.klass.def + gifts.subclass.def,
    hp:  gifts.element.hp  + gifts.klass.hp  + gifts.subclass.hp,
    spd: gifts.element.spd + gifts.klass.spd + gifts.subclass.spd,
    eff: gifts.element.eff + gifts.klass.eff + gifts.subclass.eff,
    res: gifts.element.res + gifts.klass.res + gifts.subclass.res,
  }
  const giftPct = {
    chc: gifts.element.chc + gifts.klass.chc + gifts.subclass.chc,
    chd: gifts.element.chd + gifts.klass.chd + gifts.subclass.chd,
    pen: gifts.element.pen + gifts.klass.pen + gifts.subclass.pen,
    dmgRed: gifts.element.dmgRed + gifts.klass.dmgRed + gifts.subclass.dmgRed,
  }

  const atkMult = 1 + (codex.atkPct + transcend.atkPct + classPass.atkPct) / 100
  const defMult = 1 + (codex.defPct + transcend.defPct + classPass.defPct) / 100
  const hpMult  = 1 + (codex.hpPct  + transcend.hpPct  + classPass.hpPct)  / 100

  const final: StatBlock = {
    atk: Math.round((base.atk + evo.atk + giftFlat.atk) * atkMult),
    def: Math.round((base.def + evo.def + giftFlat.def) * defMult),
    hp:  Math.round((base.hp  + evo.hp  + giftFlat.hp)  * hpMult),
    spd: base.spd + evo.spd + giftFlat.spd,
    chc: base.chc + evo.chc + giftPct.chc,
    chd: base.chd + evo.chd + giftPct.chd,
    chdReduce: 0,
    pen: base.pen + giftPct.pen,
    dmgInc: 0,
    dmgRed: base.dmgRed + skill8.dmgRedPct + giftPct.dmgRed,
    eff: base.eff + evo.eff + giftFlat.eff,
    res: base.res + evo.res + giftFlat.res,
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
      description: `Skill_22 (class passive) BT_STAT_PREMIUM / cond=NONE buffs — ${classPass.breakdown.map(b => `${b.buffId} +${b.pct}% ${b.stat}`).join(', ') || 'none'}`,
      fields: { atkPct: classPass.atkPct, defPct: classPass.defPct, hpPct: classPass.hpPct },
    },
    {
      source: 'skill8Passive',
      description: `Skill_8 lvl ${transcend.skillLevel} — ${skill8.buffId ?? 'none'}`,
      fields: { dmgRed: skill8.dmgRedPct },
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
