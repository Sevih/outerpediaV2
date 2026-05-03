/**
 * No-gear stat contributors for the damage calculator bake.
 *
 * Mirrors `src/app/api/admin/characters/[id]/stats/route.ts` but emits raw
 * contributor blocks (one per source: base / evolution / classPassive /
 * skill8 / quirks) rather than a single resolved stat block. The client
 * recomposes them via `computeFinalStats` according to user-toggled
 * settings (codex level, quirk scopes, transcend tier — which gates
 * skill8) — so changing settings doesn't require a re-bake.
 *
 * Codex contribution is char-agnostic; baked once into the manifest.
 *
 * ── Encoding rules (same as admin route) ─────────────────────────────────
 *   Per-mille (÷10 → %): CHC, CHD, PEN, DMG_RED, DMG_INC, ATK%, DEF%, HP%
 *   Flat:                ATK, DEF, HP, SPD, EFF, RES
 *   OAT_RATE on SPD/EFF/RES → flat premium = floor(baseForRate × value / 1000)
 */

type Row = Record<string, string | undefined>

/**
 * Sparse contributor block — only nonzero fields are emitted to keep the
 * baked JSON tight. Both flat and percentage fields share the same shape;
 * the formula (`computeFinalStats`) decides which bucket to fold them into.
 */
export interface StatContribution {
  atk?: number
  def?: number
  hp?: number
  spd?: number
  chc?: number
  chd?: number
  pen?: number
  dmgInc?: number
  dmgRed?: number
  eff?: number
  res?: number
  /** %-bonus on base ATK — folded into the calcStat multiplier. */
  atkPct?: number
  /** %-bonus on base DEF. */
  defPct?: number
  /** %-bonus on base HP. */
  hpPct?: number
}

/**
 * Quirk groups exposed to the calc UI. Maps the templet's
 * `AwakeningType` field to in-game gift menu categories:
 *   - `element`           → AwakeningType=ELEMENTAL          (CM_Gift_Menu_01)
 *   - `job`               → AwakeningType=JOB                (CM_Gift_Menu_03) —
 *                            combines AAT_CLASS (5 main class passives) +
 *                            AAT_SUBCLASS (subclass branches under the same
 *                            in-game tab)
 *   - `adventureLicense`  → AwakeningType=ADVENTURE_LICENSE  (CM_Gift_Menu_06) —
 *                            mode-gated stat bonuses (apply only when the
 *                            picked target sits in DM_ADVENTURE_MISSION /
 *                            DM_ADVENTURE_CHALLENGE). The main-node BT_DMG
 *                            buff (+100% pool vs boss) lives in the awakening
 *                            buffs catalog and is gated separately by the
 *                            recompute reducer's `inAdventureLicense` flag.
 *
 * The other AwakeningType values aren't surfaced in the no-gear sheet:
 *   - UTILITY            (no stat impact in-game by design)
 *   - PVE / Counteract   (BT_DMG-only — runtime damage formula, not stats)
 */
export interface QuirkContributions {
  element: StatContribution
  job: StatContribution
  adventureLicense: StatContribution
}

export interface NoGearStats {
  /** Lv 100 base (CharacterTemplet *_Max). Always applied. */
  base: StatContribution
  /** Cumulative ev1→ev6 flats (CharacterEvolutionStatTemplet). Always applied. */
  evolution: StatContribution
  /** Skill_22 BT_STAT_PREMIUM cond=NONE buffs. Always applied. */
  classPassive: StatContribution
  /**
   * Skill_8 contribution per `transStar` — keyed by string transStar so the
   * client can look up by the user's current transcend tier directly.
   * Empty entries (skill8 not unlocked at that tier) are omitted.
   */
  skill8ByTransStar: Record<string, StatContribution>
  /** Element / class / subclass quirk groups — each toggleable in settings. */
  quirks: QuirkContributions
}

export interface CodexEntry {
  level: number
  atkPct: number
  defPct: number
  hpPct: number
}

/** Subset of admin route's enum mappings — kept in sync if the binary changes. */
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

function num(v: string | undefined): number {
  if (!v) return 0
  const p = parseInt(v, 10)
  return Number.isFinite(p) ? p : 0
}

function splitCsv(s: string | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

/** Same lv 100 ATK/DEF correction as the admin route (3★ ATTACKER quirk). */
function needsAttackerLv100Patch(row: Row): boolean {
  return row.Class === 'CCT_ATTACKER'
    && row.SubClass === 'ATTACKER'
    && num(row.BasicStar) === 3
    && num(row.Atk_Max) === 930
    && num(row.Def_Max) === 247
}

/** Drop zero / undefined fields so the baked JSON stays compact. */
function trim(c: StatContribution): StatContribution {
  const out: StatContribution = {}
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === 'number' && v !== 0) (out as Record<string, number>)[k] = v
  }
  return out
}

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

function pickMaxBuff(rows: Row[], buffId: string): Row | undefined {
  let best: Row | undefined
  for (const r of rows) {
    if (r.BuffID !== buffId) continue
    if (!best || num(r.Level) > num(best.Level)) best = r
  }
  return best
}

function extractBase(row: Row): StatContribution {
  const patch = needsAttackerLv100Patch(row) ? 1 : 0
  return {
    atk: num(row.Atk_Max) - patch,
    def: num(row.Def_Max) - patch,
    hp:  num(row.HP_Max),
    spd: num(row.Speed_Max),
    chc: num(row.CriticalRate_Max) / 10,
    chd: num(row.CriticalDMGRate_Max) / 10,
    eff: num(row.BuffChance_Max),
    res: num(row.BuffResist_Max),
  }
}

function extractEvolution(evoStats: Row[], charId: string): StatContribution {
  const out: StatContribution = {}
  for (const r of evoStats) {
    if (r.CharacterID !== charId) continue
    for (let i = 1; i <= 3; i++) {
      const t = r[`RewardStatType_${i}`]
      const v = num(r[`RewardValue_${i}`])
      if (!v) continue
      addStat(out, t, v, false)
    }
  }
  return out
}

/** Mutating add — `t` is an `ST_*` ref, `pct` flag chooses the % bucket. */
function addStat(dest: StatContribution, t: string | undefined, v: number, pct: boolean): void {
  if (!t || !v) return
  if (t === 'ST_ATK')                    { if (pct) dest.atkPct = (dest.atkPct ?? 0) + v / 10; else dest.atk = (dest.atk ?? 0) + v; return }
  if (t === 'ST_DEF')                    { if (pct) dest.defPct = (dest.defPct ?? 0) + v / 10; else dest.def = (dest.def ?? 0) + v; return }
  if (t === 'ST_HP')                     { if (pct) dest.hpPct  = (dest.hpPct  ?? 0) + v / 10; else dest.hp  = (dest.hp  ?? 0) + v; return }
  if (t === 'ST_SPEED')                  { dest.spd  = (dest.spd  ?? 0) + v; return }
  if (t === 'ST_BUFF_CHANCE')            { dest.eff  = (dest.eff  ?? 0) + v; return }
  if (t === 'ST_BUFF_RESIST')            { dest.res  = (dest.res  ?? 0) + v; return }
  if (t === 'ST_CRITICAL_RATE')          { dest.chc    = (dest.chc    ?? 0) + v / 10; return }
  if (t === 'ST_CRITICAL_DMG_RATE')      { dest.chd    = (dest.chd    ?? 0) + v / 10; return }
  if (t === 'ST_PIERCE_POWER_RATE')      { dest.pen    = (dest.pen    ?? 0) + v / 10; return }
  if (t === 'ST_DMG_REDUCE_RATE')        { dest.dmgRed = (dest.dmgRed ?? 0) + v / 10; return }
  if (t === 'ST_DMG_BOOST')              { dest.dmgInc = (dest.dmgInc ?? 0) + v / 10; return }
}

/** OAT_RATE fallback for SPD / EFF / RES — premium = floor(base × value / 1000). */
function applyRateFlat(dest: StatContribution, t: string | undefined, v: number, baseForRate: { spd: number; eff: number; res: number }): void {
  if (!t || !v) return
  if (t === 'ST_SPEED')        { dest.spd = (dest.spd ?? 0) + Math.floor(baseForRate.spd * v / 1000); return }
  if (t === 'ST_BUFF_CHANCE')  { dest.eff = (dest.eff ?? 0) + Math.floor(baseForRate.eff * v / 1000); return }
  if (t === 'ST_BUFF_RESIST')  { dest.res = (dest.res ?? 0) + Math.floor(baseForRate.res * v / 1000); return }
}

/**
 * Apply a single BT_STAT_PREMIUM / cond=NONE buff. Returns true if the buff
 * contributed something. Mirrors the admin route's `applyPremiumBuff`.
 */
function applyPremiumBuff(dest: StatContribution, buff: Row, baseForRate: { spd: number; eff: number; res: number }): boolean {
  if (buff.Type !== 'BT_STAT_PREMIUM') return false
  if ((buff.BuffConditionType ?? 'NONE') !== 'NONE') return false
  const value = num(buff.Value)
  const rate  = buff.ApplyingType === 'OAT_RATE'
  const add   = buff.ApplyingType === 'OAT_ADD'
  if (!rate && !add) return false

  const t = buff.StatType
  // Pure %-stats (per-mille → %).
  if (t === 'ST_CRITICAL_RATE' || t === 'ST_CRITICAL_DMG_RATE'
   || t === 'ST_PIERCE_POWER_RATE' || t === 'ST_DMG_REDUCE_RATE'
   || t === 'ST_DMG_BOOST') {
    addStat(dest, t, value, false)
    return true
  }
  // ATK / DEF / HP — OAT_RATE → %, OAT_ADD → flat.
  if (t === 'ST_ATK' || t === 'ST_DEF' || t === 'ST_HP') {
    addStat(dest, t, value, rate)
    return true
  }
  // SPD / EFF / RES — OAT_RATE resolves into a flat on baseForRate.
  if (t === 'ST_SPEED' || t === 'ST_BUFF_CHANCE' || t === 'ST_BUFF_RESIST') {
    if (rate) applyRateFlat(dest, t, value, baseForRate)
    else      addStat(dest, t, value, false)
    return true
  }
  return false
}

function extractClassPassive(
  row: Row,
  skillLevels: Row[],
  buffs: Row[],
  baseForRate: { spd: number; eff: number; res: number },
): StatContribution {
  const out: StatContribution = {}
  const skillId = row.Skill_22
  if (!skillId) return out
  const levelRow = pickSkillLevelRow(skillLevels, skillId)
  for (const bid of splitCsv(levelRow?.BuffID)) {
    const b = pickMaxBuff(buffs, bid)
    if (b) applyPremiumBuff(out, b, baseForRate)
  }
  return out
}

/** Extract Skill_8 contribution at a specific skill level (0 = none). */
function extractSkill8Passive(
  row: Row,
  skillLevels: Row[],
  buffs: Row[],
  skillLevel: number,
  baseForRate: { spd: number; eff: number; res: number },
): StatContribution {
  const out: StatContribution = {}
  const skillId = row.Skill_8
  if (!skillId || skillLevel <= 0) return out
  const levelRow = pickSkillLevelRow(skillLevels, skillId, skillLevel)
  for (const bid of splitCsv(levelRow?.BuffID)) {
    const b = pickMaxBuff(buffs, bid)
    if (b) applyPremiumBuff(out, b, baseForRate)
  }
  return out
}

function accumulateGiftBonus(
  dest: StatContribution,
  levelRow: Row,
  buffs: Row[],
  baseForRate?: { spd: number; eff: number; res: number },
): void {
  let statType = levelRow.StatType ?? 'ST_NONE'
  let applying = levelRow.ApplyingType ?? 'OAT_NONE'
  let value    = num(levelRow.OptionValue)
  let condition = 'NONE'

  if (levelRow.OptionType === 'IOT_BUFF' && levelRow.BuffID) {
    const b = pickMaxBuff(buffs, levelRow.BuffID)
    if (!b) return
    if (b.Type !== 'BT_STAT_PREMIUM') return  // skip BT_DMG/BT_STAT — not always-on stats
    statType = b.StatType ?? 'ST_NONE'
    applying = b.ApplyingType ?? 'OAT_NONE'
    value    = num(b.Value)
    condition = b.BuffConditionType ?? 'NONE'
  }
  if (condition !== 'NONE') return

  const rate = applying === 'OAT_RATE'
  const add  = applying === 'OAT_ADD'
  if (!rate && !add) return

  // Pure %-stats — value is per-mille regardless of rate/add.
  if (statType === 'ST_CRITICAL_RATE' || statType === 'ST_CRITICAL_DMG_RATE'
   || statType === 'ST_PIERCE_POWER_RATE' || statType === 'ST_DMG_REDUCE_RATE'
   || statType === 'ST_DMG_BOOST') {
    addStat(dest, statType, value, false)
    return
  }
  // ATK / DEF / HP — OAT_RATE → %, OAT_ADD → flat.
  if (statType === 'ST_ATK' || statType === 'ST_DEF' || statType === 'ST_HP') {
    addStat(dest, statType, value, rate)
    return
  }
  // SPD / EFF / RES — OAT_ADD adds flat, OAT_RATE resolves to a flat via
  // floor(baseForRate × value / 1000) (matches admin route + class-passive
  // convention). Adventure License nodes use OAT_RATE on EFF/RES; older
  // element/job quirks use OAT_ADD only.
  if (statType === 'ST_SPEED' || statType === 'ST_BUFF_CHANCE' || statType === 'ST_BUFF_RESIST') {
    if (rate && baseForRate) {
      applyRateFlat(dest, statType, value, baseForRate)
    } else if (add) {
      if (statType === 'ST_SPEED')            dest.spd = (dest.spd ?? 0) + value
      else if (statType === 'ST_BUFF_CHANCE') dest.eff = (dest.eff ?? 0) + value
      else if (statType === 'ST_BUFF_RESIST') dest.res = (dest.res ?? 0) + value
    }
  }
}

function extractQuirks(
  row: Row,
  awakNodes: Row[],
  awakLevels: Row[],
  buffs: Row[],
  baseForRate: { spd: number; eff: number; res: number },
): QuirkContributions {
  const elemIdx  = ELEMENT_INDEX[row.Element ?? '']   ?? -1
  const classIdx = CLASS_INDEX[row.Class ?? '']       ?? -1
  const subIdx   = SUBCLASS_INDEX[row.SubClass ?? ''] ?? -1

  // Index awakening levels by group → max-AwakeningLevel row (that's the
  // "fully unlocked" reward we surface in the no-gear sheet).
  const levelByGroup = new Map<string, Row>()
  for (const r of awakLevels) {
    const gid = r.AwakeningLevelGroupID
    if (!gid) continue
    const existing = levelByGroup.get(gid)
    if (!existing || num(r.AwakeningLevel) > num(existing.AwakeningLevel)) {
      levelByGroup.set(gid, r)
    }
  }

  const out: QuirkContributions = { element: {}, job: {}, adventureLicense: {} }
  for (const node of awakNodes) {
    const gid = node.AwakeningLevelGroupID
    if (!gid) continue
    const v = num(node.AwakeningApplyTypeValue)
    let bucket: StatContribution | null = null
    // Element gifts → element bucket (filtered by char's element index).
    if (node.AwakeningApplyType === 'AAT_ELEMENTAL' && v === elemIdx) {
      bucket = out.element
    }
    // Class + subclass nodes both live under the in-game "Class" gift tab,
    // so they share a single `job` bucket. Class index is the parent passive,
    // subclass index narrows to the char's subclass branch.
    else if (node.AwakeningApplyType === 'AAT_CLASS'    && v === classIdx) bucket = out.job
    else if (node.AwakeningApplyType === 'AAT_SUBCLASS' && v === subIdx)   bucket = out.job
    // Adventure License — char-agnostic stat bonuses (AAT_NONE, applies to
    // every char). Surface them in their own bucket so the recompute can
    // gate them on the AL toggle + dungeon mode at apply time.
    else if (node.AwakeningType === 'ADVENTURE_LICENSE' && node.AwakeningNodeType === 'ANT_NORMAL') {
      bucket = out.adventureLicense
    }
    if (!bucket) continue
    const lvlRow = levelByGroup.get(gid)
    if (lvlRow) accumulateGiftBonus(bucket, lvlRow, buffs, baseForRate)
  }
  return out
}

// ── Public entry points ─────────────────────────────────────────────────

/**
 * Build the full no-gear stat contributors for a single char. `evoCharId`
 * differs from `charId` only for Core Fusion variants (which share evolution
 * rewards with their base char via `CharacterFusionTemplet.ChangeCharID`).
 *
 * `transcendSkillLevels` is the list of `(transStar, skillLevel)` pairs from
 * the char's transcend chain — drives the Skill_8 contribution map.
 */
export function buildNoGearStats(args: {
  charId: string
  evoCharId: string
  charRow: Row
  evoStats: Row[]
  skillLevels: Row[]
  buffs: Row[]
  awakNodes: Row[]
  awakLevels: Row[]
  transcendSkillLevels: Array<{ transStar: number; skillLevel: number }>
}): NoGearStats {
  const { charRow, evoStats, skillLevels, buffs, awakNodes, awakLevels, evoCharId, transcendSkillLevels } = args

  const base = extractBase(charRow)
  const evolution = extractEvolution(evoStats, evoCharId)
  // baseForRate uses base + evo (matches the admin route — class passive and
  // skill8 OAT_RATE on SPD/EFF/RES read from this).
  const baseForRate = {
    spd: (base.spd ?? 0) + (evolution.spd ?? 0),
    eff: (base.eff ?? 0) + (evolution.eff ?? 0),
    res: (base.res ?? 0) + (evolution.res ?? 0),
  }
  const classPassive = extractClassPassive(charRow, skillLevels, buffs, baseForRate)
  const quirks = extractQuirks(charRow, awakNodes, awakLevels, buffs, baseForRate)

  const skill8ByTransStar: Record<string, StatContribution> = {}
  for (const { transStar, skillLevel } of transcendSkillLevels) {
    const c = extractSkill8Passive(charRow, skillLevels, buffs, skillLevel, baseForRate)
    const trimmed = trim(c)
    if (Object.keys(trimmed).length > 0) skill8ByTransStar[String(transStar)] = trimmed
  }

  return {
    base: trim(base),
    evolution: trim(evolution),
    classPassive: trim(classPassive),
    skill8ByTransStar,
    quirks: {
      element: trim(quirks.element),
      job: trim(quirks.job),
      adventureLicense: trim(quirks.adventureLicense),
    },
  }
}

/**
 * Build the global codex table (12 entries, Lv 0 → Lv 11). Lv 0 = no codex,
 * baked as a no-op contributor so the client can always look up the row.
 */
export function buildCodexTable(archiveStats: Row[]): CodexEntry[] {
  const out: CodexEntry[] = [{ level: 0, atkPct: 0, defPct: 0, hpPct: 0 }]
  // Sort by ID ascending — defensive against templet row order changes.
  const sorted = [...archiveStats].sort((a, b) => num(a.ID) - num(b.ID))
  for (const r of sorted) {
    out.push({
      level:  num(r.ID),
      atkPct: num(r.Atk_Rate) / 10,
      defPct: num(r.Def_Rate) / 10,
      hpPct:  num(r.HP_Rate)  / 10,
    })
  }
  return out
}
