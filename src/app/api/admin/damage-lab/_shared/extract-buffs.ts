/**
 * Server-side decoder: BuffTemplet rows + Awakening tree → flat list of
 * `ApplicableBuff`. One source of truth for "what can affect a damage calc",
 * consumed by the `/api/admin/damage-lab/buffs` endpoint.
 *
 * Two entry points:
 *   - `extractAwakeningBuffs`: walks CharacterAwakeningNodeTemplet → buffs
 *     with `source.kind: 'awakening'`. Covers PVE / Element / Class / Subclass
 *     gifts (including MAGE_PASSIVE_3_10 via JOB02 MAIN, Awakening_Boss_Dmg_10,
 *     Awakening_Element_Dmg_10, etc.).
 *   - `extractCharSkillBuffs`: walks every Skill_N slot of every character →
 *     buffs with `source.kind: 'char_skill'`. Covers scaling (SWAP/ADD),
 *     char-specific BT_DMG_TO_BOSS, char-specific BT_DMG, etc.
 *
 * Stat-display buffs (`BT_STAT_PREMIUM` cond=NONE on stats) are intentionally
 * excluded — they're already folded into the prefilled stats by the existing
 * `/api/admin/characters/:id/stats` route. We only emit buffs whose effect
 * lives in the `damage formula pipeline` (pool, scaling, target debuff).
 */

import type {
  ApplicableBuff, AppliesTo, AwakeningGroup, BuffTrigger, EffectTarget, PoolCondition, CallerSlot,
} from '@/lib/damage/buffs'

// ── Raw row shapes ──────────────────────────────────────────────────────
type Row = Record<string, string | undefined>

interface BuffRow {
  ID?: string
  BuffID?: string
  Level?: string
  Type?: string
  StatType?: string
  ApplyingType?: string
  Value?: string
  BuffConditionType?: string
  BuffConditionValue?: string
  TargetType?: string
  TargetSkillType?: string
  CallerSkillType?: string
  BuffCreateType?: string
}

interface CharTempletRow {
  ID: string
  Element?: string
  Class?: string
  SubClass?: string
  [key: string]: string | undefined
}

interface SkillLevelRow {
  SkillID: string
  SkillLevel: string
  BuffID?: string
}

// ── Enum mappings (mirrors the legacy quirks route) ─────────────────────
const ELEMENT_BY_INDEX: Record<number, string> = {
  0: 'Earth', 1: 'Water', 2: 'Fire', 3: 'Light', 4: 'Dark',
}
const CLASS_BY_INDEX: Record<number, string> = {
  1: 'Defender', 2: 'Attacker', 3: 'Ranger', 4: 'Mage', 5: 'Priest',
}
const SUBCLASS_BY_INDEX: Record<number, string> = {
  1: 'ATTACKER', 2: 'BRUISER', 3: 'WIZARD', 4: 'ENCHANTER',
  5: 'VANGUARD', 6: 'TACTICIAN', 7: 'SWEEPER', 8: 'PHALANX',
  9: 'RELIEVER', 10: 'SAGE',
}

const SLOT_BY_SKT: Record<string, CallerSlot> = {
  SKT_FIRST: 'S1', SKT_SECOND: 'S2', SKT_ULTIMATE: 'S3',
}

// Percent-encoded stats (per-mille → %).
const PERCENT_STATS = new Set([
  'ST_CRITICAL_DMG_RATE', 'ST_CRITICAL_RATE',
  'ST_PIERCE_POWER_RATE', 'ST_DMG_REDUCE_RATE',
  'ST_DMG_BOOST', 'ST_BUFF_CHANCE', 'ST_BUFF_RESIST',
])

// ── Helpers ─────────────────────────────────────────────────────────────
function num(v: string | undefined): number {
  if (!v) return 0
  const p = parseInt(v, 10)
  return Number.isFinite(p) ? p : 0
}

function stripColorTags(s: string): string {
  // {C/...}{/C} pseudo-tags from the in-game text — strip without losing inner text.
  return s.replace(/\{[^/}]+\/([^}]*)\}/g, '$1').replace(/\{\/[A-Z]+\}/g, '')
}

// CSV → array of trimmed non-empty entries.
function splitCsv(s: string | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

// Resolve `CallerSkillType` (CSV of SKT_*) into `BuffTrigger.callerSlots`.
//   empty / contains SKT_ALL          → 'all'
//   contains SKT_FIRST/SECOND/ULTIMATE → list of matching slots (deduped)
//   only burst-type entries           → []  (caller drops the buff — bursts
//                                            aren't modeled by the lab)
function resolveCallerSlots(csv: string | undefined): 'all' | CallerSlot[] {
  const list = splitCsv(csv)
  if (list.length === 0 || list.includes('SKT_ALL')) return 'all'
  const slots: CallerSlot[] = []
  for (const skt of list) {
    const slot = SLOT_BY_SKT[skt]
    if (slot && !slots.includes(slot)) slots.push(slot)
  }
  return slots
}

// Resolve a BuffConditionType into a TriggerCondition. Returns null when the
// condition isn't representable in our context (e.g. TARGET_HPRATE_OVER) — those
// buffs are ignored by the reducer.
function resolveCondition(cond: string | undefined): BuffTrigger['requires'] | null {
  switch (cond ?? 'NONE') {
    case 'NONE':                   return 'always'
    case 'ATTACKER_ELEMENT_WIN':   return 'adv'
    case 'ATTACKER_ELEMENT_LOSE':  return 'disadv'
    case 'ATTACKER_ELEMENT_EQUAL': return 'neutral'
    case 'CASTER_CRITICAL':        return 'crit'
    case 'TARGET_IS_BOSS':         return 'boss'
    default:                        return null
  }
}

// Pick the row with the highest Level for each BuffID. There can be 1..N rows
// per BuffID — players reach the max-Level version after fully unlocking.
function indexBuffsByIdMax(buffs: BuffRow[]): Map<string, BuffRow> {
  const out = new Map<string, BuffRow>()
  for (const b of buffs) {
    if (!b.BuffID) continue
    const cur = out.get(b.BuffID)
    if (!cur || num(b.Level) > num(cur.Level)) out.set(b.BuffID, b)
  }
  return out
}

// Pick the highest-SkillLevel row for each SkillID. Used to find the buff list
// the player actually has after fully leveling each skill.
function indexSkillLevelMax(rows: SkillLevelRow[]): Map<string, SkillLevelRow> {
  const out = new Map<string, SkillLevelRow>()
  for (const r of rows) {
    if (!r.SkillID) continue
    const cur = out.get(r.SkillID)
    if (!cur || num(r.SkillLevel) > num(cur.SkillLevel)) out.set(r.SkillID, r)
  }
  return out
}

// ── Awakening extractor ─────────────────────────────────────────────────
// Walks awakening nodes the same way the legacy quirks route does, but emits
// `ApplicableBuff` entries instead of `ResolvedQuirk`. The mapping table:
//
//   IOT_BUFF row  → resolve BuffTemplet
//                   - BT_DMG cond=NONE/condition → effect.target='pool'
//                     (skipped: Awakening_Chain_Dmg_* — chain-only, not single-skill)
//                   - BT_STAT_PREMIUM Awakening_Boss_*_Down_* ST_BUFF_RESIST/CHANCE
//                     → effect.target='monster_res' / 'monster_eff'
//                   - BT_STAT_PREMIUM percent stat (CHC/CHD/PEN/DMG_BOOST)
//                     → effect.target='chd'/'pen'/'crit_rate'/'pool' (DMG_BOOST is gear pool)
//                   - BT_STAT_PREMIUM ST_ATK → effect.target='atk_pct'/'atk_flat'
//                   - other types → skipped (not damage-affecting)
//
//   IOT_STAT row  → inline stat (synthesized buffType='BT_STAT'); same mapping.
export interface ExtractAwakeningInput {
  nodes: Row[]
  levels: Row[]
  buffs: BuffRow[]
  textSystem: Map<string, { English: string }>
}

export function extractAwakeningBuffs(input: ExtractAwakeningInput): ApplicableBuff[] {
  const { nodes, levels, buffs, textSystem } = input

  // Index awakening levels by group, keep the max-AwakeningLevel row.
  const levelByGroup = new Map<string, Row>()
  for (const r of levels) {
    const gid = r.AwakeningLevelGroupID
    if (!gid) continue
    const cur = levelByGroup.get(gid)
    if (!cur || num(r.AwakeningLevel) > num(cur.AwakeningLevel)) levelByGroup.set(gid, r)
  }

  const buffsById = indexBuffsByIdMax(buffs)
  const out: ApplicableBuff[] = []

  for (const node of nodes) {
    const groupId = node.AwakeningLevelGroupID
    if (!groupId) continue
    const max = levelByGroup.get(groupId)
    if (!max) continue

    let buffId = ''
    let buffType = ''
    let statType = ''
    let applyingType = ''
    let rawValue = 0
    let condition = 'NONE'
    if (max.OptionType === 'IOT_BUFF' || max.BuffID) {
      const b = buffsById.get(max.BuffID ?? '')
      if (!b) continue
      buffId = b.BuffID ?? ''
      buffType = b.Type ?? ''
      statType = b.StatType ?? ''
      applyingType = b.ApplyingType ?? ''
      rawValue = num(b.Value)
      condition = b.BuffConditionType ?? 'NONE'
    } else if (max.OptionType === 'IOT_STAT') {
      buffType = 'BT_STAT'
      statType = max.StatType ?? ''
      applyingType = max.ApplyingType ?? ''
      rawValue = num(max.OptionValue)
      condition = 'NONE'
    } else {
      continue
    }

    const baseRequires = resolveCondition(condition)
    if (!baseRequires) continue

    // Decode the (buffType, statType, applyingType, rawValue) tuple into an effect.
    const eff = decodeEffect(buffType, statType, applyingType, rawValue, buffId)
    if (!eff) continue

    // Several buff families gate on the target being a boss even when their
    // BuffConditionType=NONE — the engine resolves the gate via the buff
    // type/name pattern. Same logic the legacy quirks route applied:
    //   - BT_DMG_TO_BOSS         → boss (e.g. Awakening_Boss_Dmg_10 +30%)
    //   - Awakening_Boss_*_Down_* → boss (BT_STAT_PREMIUM negative ST_BUFF_*)
    const isMonsterDebuff = eff.target === 'monster_res' || eff.target === 'monster_eff'
    const requires: BuffTrigger['requires'] =
      buffType === 'BT_DMG_TO_BOSS' || isMonsterDebuff ? 'boss' : baseRequires

    // Applies-to: derived from AwakeningApplyType / AwakeningApplyTypeValue.
    const appliesTo = decodeAwakeningApplies(node)
    // ADVENTURE_LICENSE is paid/seasonal — off by default in the UI.
    const group = (node.AwakeningType as AwakeningGroup) ?? 'UTILITY'
    const defaultEnabled = group !== 'ADVENTURE_LICENSE'

    const nameText = textSystem.get(node.NodeNameID ?? '')?.English ?? node.NodeNameID ?? ''
    const descRaw = textSystem.get(node.NodeDescID ?? '')?.English ?? ''
    const formattedValue = applyingType === 'OAT_RATE'
      ? `${(rawValue / 10).toFixed(1)}%`
      : String(rawValue)
    const desc = stripColorTags(descRaw.replace('{0}', formattedValue))

    out.push({
      id: `awak:${node.ID ?? buffId}`,
      source: { kind: 'awakening', nodeId: node.ID ?? '', group, buffId },
      appliesTo,
      effect: eff,
      trigger: { requires, callerSlots: 'all' },
      ui: {
        name: stripColorTags(nameText),
        desc,
        defaultEnabled,
        maxLevel: num(max.AwakeningLevel),
      },
    })
  }

  return out
}

function decodeAwakeningApplies(node: Row): AppliesTo {
  const apply = node.AwakeningApplyType
  const v = num(node.AwakeningApplyTypeValue)
  if (apply === 'AAT_ELEMENTAL') return { kind: 'element',  value: ELEMENT_BY_INDEX[v]  ?? null }
  if (apply === 'AAT_CLASS')     return { kind: 'class',    value: CLASS_BY_INDEX[v]    ?? null }
  if (apply === 'AAT_SUBCLASS')  return { kind: 'subclass', value: SUBCLASS_BY_INDEX[v] ?? null }
  return { kind: 'all', value: null }
}

// ── Char-skill extractor ────────────────────────────────────────────────
// Walks every Skill_N slot of every character row → emits buffs with
// `source.kind: 'char_skill'`. Covers all "char-specific damage modifiers":
//   - BT_SWAP_STAT_ATTACK              → scaling_swap
//   - BT_DMG_OWNER_STAT / BT_DMG_CASTER_STAT → scaling_add_pct or scaling_add_flat
//   - BT_DMG_TARGET_STAT               → scaling_target_stat (Noa S2)
//   - BT_DMG_TO_BOSS  cond=NONE        → pool gated on requires:'boss', callerSlots from CallerSkillType
//   - BT_DMG          cond=NONE/cond   → pool gated on the BuffConditionType (rare on chars)
//   - BT_DMG_OWNER_LOST_HP_RATE / BT_DMG_TARGET_LOST_HP_RATE / BT_DMG_OWNER_BUFF /
//     BT_DMG_TARGET_BUFF / BT_DMG_OWNER_DEBUFF / BT_DMG_TARGET_DEBUFF /
//     BT_DMG_TARGET_BREAK / BT_DMG_KILL_COUNT_STACK / BT_DMG_NOT_CRITICAL /
//     BT_DMG_PVP_CONTENT / BT_DMG_CASTER_LOST_HP_RATE / BT_DMG_OWNER_TEAM_BUFF /
//     BT_DMG_(MY|ENEMY)_TEAM_DECREASE / BT_DMG_MONADGATE_CONTENT / BT_DMG_TOWER_CONTENT
//                                       → pool_cond with poolCond discriminator
//                                         (multiplier resolved at recompute time
//                                          from BuffContext flags; default-0 = no-op)
//
// CallerSkillType drives the `callerSlots` gate (S1/S2/S3 mapping); buffs with
// CallerSkillType limited to bursts (SKT_BURST_*) only are dropped (not
// representable in the lab — single-skill calc).
export interface ExtractCharSkillInput {
  characters: CharTempletRow[]
  skillLevels: SkillLevelRow[]
  buffs: BuffRow[]
}

// Mapping Skill_N → active CallerSlot (or null for passives that span all slots).
// Active slots: S1 = Skill_1, S2 = Skill_2, S3 = Skill_3.
// Passive slots: Skill_4 (chain passive), Skill_8 (transcendent), Skill_22
//   (class passive) — these are "always-on", their buffs fire on every active
//   skill cast (subject to BuffTemplet.CallerSkillType filter).
// Other Skill_N (Skill_5..7, 9..10 = strike/backup, 19..21 = bursts):
//   bursts and strikes aren't modeled by the lab, so buffs only-hosted there
//   are dropped (return undefined).
function slotIndexToCaller(idx: number): CallerSlot | 'passive' | undefined {
  if (idx === 1) return 'S1'
  if (idx === 2) return 'S2'
  if (idx === 3) return 'S3'
  if (idx === 4 || idx === 8 || idx === 22) return 'passive'
  return undefined  // strike / backup / burst — not modeled
}

export function extractCharSkillBuffs(input: ExtractCharSkillInput): ApplicableBuff[] {
  const buffsById = indexBuffsByIdMax(input.buffs)
  const skillLevelMax = indexSkillLevelMax(input.skillLevels)
  const out: ApplicableBuff[] = []

  for (const charRow of input.characters) {
    const charId = charRow.ID
    if (!charId) continue

    // Build (buffId → set of caller slots that reference it via this char's
    // skill loadout). A buff fires on a cast slot if (a) it's in that slot's
    // BuffID list, OR (b) it's in a passive slot's BuffID list (in which case
    // it fires on every active cast). Then we further intersect with the
    // BuffTemplet's own CallerSkillType filter.
    const hostedSlots = new Map<string, Set<CallerSlot>>()
    for (const k of Object.keys(charRow)) {
      if (!k.startsWith('Skill_')) continue
      const skillId = (charRow as unknown as Record<string, string | undefined>)[k]
      if (!skillId) continue
      const lvlRow = skillLevelMax.get(skillId)
      if (!lvlRow?.BuffID) continue
      const slotIdx = parseInt(k.replace('Skill_', ''), 10)
      const caller = slotIndexToCaller(slotIdx)
      if (!caller) continue
      const slotsToTag: CallerSlot[] = caller === 'passive' ? ['S1', 'S2', 'S3'] : [caller]
      for (const bid of splitCsv(lvlRow.BuffID)) {
        const set = hostedSlots.get(bid) ?? new Set<CallerSlot>()
        for (const s of slotsToTag) set.add(s)
        hostedSlots.set(bid, set)
      }
    }

    // Emit one entry per buff with the correctly-resolved callerSlots.
    for (const [bid, hostSet] of hostedSlots) {
      const b = buffsById.get(bid)
      if (!b) continue
      if (b.TargetType !== 'ME') continue   // caster-side only
      const eff = decodeCharSkillEffect(b)
      if (!eff) continue
      const requires = resolveCondition(b.BuffConditionType)
      if (!requires) continue

      // BuffCreateType decides how `callerSlots` is gated:
      //   PASSIVE / PASSIVE2  → permanent buff. Host slot is just a data
      //                         attachment point; CallerSkillType is the
      //                         actual gate (scaling, BT_DMG_TO_BOSS, etc.).
      //                         e.g. Caren `2000089_2_1` SWAP DEF on Skill_2
      //                         w/ CallerSkillType=SKT_ALL → fires on S1/S2/S3.
      //   else (SKILL_START)  → combat-triggered buff. Host slot IS the
      //                         trigger (the buff only spawns when that skill
      //                         is cast). Intersect host with CallerSkillType.
      //                         e.g. Caren `2000089_3_1` PEN +30% hosted on
      //                         Skill_3 only → fires on S3 cast only.
      const isPermanent = b.BuffCreateType === 'PASSIVE' || b.BuffCreateType === 'PASSIVE2'
      const filterSlots = resolveCallerSlots(b.CallerSkillType)
      let finalSlots: CallerSlot[]
      if (filterSlots !== 'all' && filterSlots.length === 0) continue   // burst-only — drop
      if (isPermanent) {
        // For permanent buffs, ignore host slot — CallerSkillType is the gate.
        finalSlots = filterSlots === 'all' ? ['S1', 'S2', 'S3'] : filterSlots
      } else {
        // For combat-triggered buffs, intersect host slots with CallerSkillType.
        const hostArr = Array.from(hostSet)
        finalSlots = filterSlots === 'all' ? hostArr : hostArr.filter(s => filterSlots.includes(s))
      }
      if (finalSlots.length === 0) continue

      // BT_DMG_TO_BOSS implies a "boss" gate even when BuffConditionType=NONE.
      // Same logic the engine applies via the buff type's name.
      const finalRequires: BuffTrigger['requires'] = b.Type === 'BT_DMG_TO_BOSS' ? 'boss' : requires

      // Pick representative slotIdx for the source field — the lowest-numbered
      // host (most often the buff's "primary" skill). Not load-bearing for math.
      const repSlot = finalSlots.includes('S1') ? 1 : finalSlots.includes('S2') ? 2 : 3

      out.push({
        id: `char:${charId}:${bid}`,
        source: { kind: 'char_skill', charId, skillSlot: repSlot, buffId: bid },
        appliesTo: { kind: 'char', value: charId },
        effect: eff,
        trigger: { requires: finalRequires, callerSlots: finalSlots },
      })
    }
  }

  return out
}

// Decode a char-skill buff row into an effect. Returns null for buffs we don't
// (yet) propagate into the formula (BT_DMG_REDUCE caster DR, BT_HEAL, etc.).
function decodeCharSkillEffect(b: BuffRow): ApplicableBuff['effect'] | null {
  const t = b.Type ?? ''
  const stat = b.StatType ?? ''
  const value = num(b.Value)
  if (value === 0 && t !== 'BT_SWAP_STAT_ATTACK') return null

  if (t === 'BT_DMG' && stat === 'ST_NONE') {
    return { target: 'pool', unit: '%', amount: value / 10 }
  }
  if (t === 'BT_DMG_TO_BOSS' && stat === 'ST_NONE') {
    return { target: 'pool', unit: '%', amount: value / 10 }
  }
  if (t === 'BT_SWAP_STAT_ATTACK') {
    return { target: 'scaling_swap', unit: 'permille', amount: value, statRef: stat }
  }
  if (t === 'BT_DMG_OWNER_STAT' || t === 'BT_DMG_CASTER_STAT') {
    const target: EffectTarget = PERCENT_STATS.has(stat) ? 'scaling_add_pct' : 'scaling_add_flat'
    return { target, unit: 'permille', amount: value, statRef: stat }
  }
  if (t === 'BT_DMG_TARGET_STAT') {
    return { target: 'scaling_target_stat', unit: 'permille', amount: value, statRef: stat }
  }
  // ── Conditional pool types (BT_DMG_* aggregated by FindBuffAdditionalDamage) ──
  // Each contributes `(value/1000) × multiplier` to the rate; the multiplier is
  // resolved at recompute-time from the BuffContext fields the lab UI fills in.
  // Default-zero context produces zero contribution → safe no-op when the user
  // hasn't set the gating input (lost HP, buff count, mode flag, …).
  const poolCondMap: Record<string, PoolCondition> = {
    BT_DMG_OWNER_LOST_HP_RATE:  'owner_lost_hp',
    BT_DMG_TARGET_LOST_HP_RATE: 'target_lost_hp',
    BT_DMG_CASTER_LOST_HP_RATE: 'caster_lost_hp',
    BT_DMG_OWNER_BUFF:          'owner_buff',
    BT_DMG_TARGET_BUFF:         'target_buff',
    BT_DMG_OWNER_DEBUFF:        'owner_debuff',
    BT_DMG_TARGET_DEBUFF:       'target_debuff',
    BT_DMG_TARGET_BREAK:        'target_break',
    BT_DMG_KILL_COUNT_STACK:    'kill_count_stack',
    BT_DMG_NOT_CRITICAL:        'not_critical',
    BT_DMG_PVP_CONTENT:         'pvp_content',
    BT_DMG_OWNER_TEAM_BUFF:     'team_buff',
    BT_DMG_MY_TEAM_DECREASE:    'team_decrease',
    BT_DMG_ENEMY_TEAM_DECREASE: 'team_decrease',  // 18 rows, same multiplier source
    BT_DMG_MONADGATE_CONTENT:   'monadgate_content',
    BT_DMG_TOWER_CONTENT:       'tower_content',
  }
  if (poolCondMap[t] !== undefined) {
    return { target: 'pool_cond', unit: '%', amount: value / 10, poolCond: poolCondMap[t] }
  }
  // BT_STAT — combat-triggered stat buff. Fires when the caller skill is used,
  // gated by CallerSkillType. Validated targets:
  //   ST_PIERCE_POWER_RATE  → pen   (e.g. Demiurge Stella 2000053_1_5: +10% PEN
  //                                  on S1/S3 — "ignores 10% target's defense")
  //                                  and 2000053_3_5: +50% PEN cond=TARGET_IS_BOSS
  //                                  on S3 — "ignores 50% of boss def".
  //   ST_CRITICAL_DMG_RATE  → chd
  //   ST_CRITICAL_RATE      → crit_rate
  //   ST_DMG_BOOST          → pool  (additive damage % — same channel as BT_DMG)
  // ST_ATK/DEF/HP intentionally skipped: they're typically baked into the API
  // stat readout the user already feeds as input ATK/DEF, so adding via the
  // buffs path would double-count. ST_SPEED/EFF/RES aren't damage-formula stats.
  if (t === 'BT_STAT') {
    if (stat === 'ST_PIERCE_POWER_RATE')      return { target: 'pen',       unit: '%', amount: value / 10 }
    if (stat === 'ST_CRITICAL_DMG_RATE')      return { target: 'chd',       unit: '%', amount: value / 10 }
    if (stat === 'ST_CRITICAL_RATE')          return { target: 'crit_rate', unit: '%', amount: value / 10 }
    if (stat === 'ST_DMG_BOOST')              return { target: 'pool',      unit: '%', amount: value / 10 }
  }
  return null
}

// Generic decoder used by the awakening path. Maps (buffType, statType,
// applyingType, rawValue) → an effect, or null if the row doesn't contribute
// to a damage calc (combat-triggered buff, irrelevant stat, etc.).
function decodeEffect(buffType: string, statType: string, applyingType: string, rawValue: number, buffId: string): ApplicableBuff['effect'] | null {
  const isRate = applyingType === 'OAT_RATE'
  const isAdd = applyingType === 'OAT_ADD'
  if (!isRate && !isAdd) return null

  // BT_DMG cond=NONE → pool. Skip Awakening_Chain_Dmg_* (chain-only, not single skill).
  if (buffType === 'BT_DMG' && statType === 'ST_NONE') {
    if (/^Awakening_Chain_Dmg_/.test(buffId)) return null
    return { target: 'pool', unit: '%', amount: rawValue / 10 }
  }

  // BT_DMG_TO_BOSS cond=NONE → pool gated on `requires:'boss'` (set by caller).
  // Covers Awakening_Boss_Dmg_10 (+30%) and `licence_Awakening_Boss_Dmg_*`.
  if (buffType === 'BT_DMG_TO_BOSS' && statType === 'ST_NONE') {
    return { target: 'pool', unit: '%', amount: rawValue / 10 }
  }

  // Awakening_Boss_*_Down_* — the engine treats negative ST_BUFF_RESIST/CHANCE
  // as a debuff on the boss target despite TargetType=ME. Buff name pattern.
  if (buffType === 'BT_STAT_PREMIUM' && /^Awakening_Boss_.*_Down_/.test(buffId)) {
    if (statType === 'ST_BUFF_RESIST') return { target: 'monster_res', unit: '%', amount: rawValue / 10 }
    if (statType === 'ST_BUFF_CHANCE') return { target: 'monster_eff', unit: '%', amount: rawValue / 10 }
  }

  // Percent stats from BT_STAT_PREMIUM / BT_STAT (Awakening) — folded into the
  // attacker's stat layer. The stats API already includes these in its prefilled
  // ATK/CHD/PEN, so emitting them here is redundant for math; we keep them out
  // of the buff list to avoid double-counting on the page-side reducer.
  // (DMG_BOOST is the single exception — it's NOT in the stats prefill but in
  // the live `dmgIncPct` input. Awakening doesn't have unconditional DMG_BOOST
  // gifts that we know of, so this branch is essentially dead but documented.)
  if (PERCENT_STATS.has(statType)) {
    return null
  }

  // ATK / DEF / HP — ditto, already in the stats prefill.
  if (statType === 'ST_ATK' || statType === 'ST_DEF' || statType === 'ST_HP') {
    return null
  }

  return null
}
