/**
 * Server-side decoder: BuffTemplet rows + Awakening tree → flat list of
 * `ApplicableBuff` (v2). One source of truth for "what can affect a damage
 * calc", consumed by `/api/admin/damage-lab/v2/extract-buffs`.
 *
 * Two entry points (pure functions, no I/O):
 *   - `extractAwakeningBuffs`: walks `CharacterAwakeningNodeTemplet` →
 *     awakening buffs (PVE / Element / Class / Subclass / Adventure License).
 *   - `extractCharSkillBuffs`: walks each char's `Skill_N` slot → char-specific
 *     buffs (scaling, char BT_DMG_TO_BOSS, conditional pool, …).
 *
 * Stat-display buffs (`BT_STAT_PREMIUM` cond=NONE on stats) are intentionally
 * excluded — they're already folded into the prefilled stats by the
 * `/api/admin/characters/:id/stats` route. We only emit buffs whose effect
 * lives in the damage formula pipeline.
 *
 * ── Key fix vs v1 ────────────────────────────────────────────────────────
 *  • `BT_DMG_ENEMY_TEAM_DECREASE` (type 94) → `enemy_team_decrease` poolCond.
 *    v1 collapsed it onto `team_decrease` (= MY_TEAM, allies); PR 4bis disasm
 *    of `FindBuffEnemyTeamDecreaseDamageRate` (VA 0x2639194) confirmed the
 *    multiplier source is the count of dead/missing ENEMIES, not allies.
 *  • Each `BT_DMG_*` mapping carries its dispatch VA in the comment for audit
 *    traceability against PR 4bis findings.
 */

import type {
  ApplicableBuff, AppliesTo, AwakeningGroup, BuffEffect, BuffTrigger,
  CallerSlot, EffectTarget, PoolCondition,
} from './buffs'

// ── Raw row shapes ───────────────────────────────────────────────────────
type Row = Record<string, string | undefined>

export interface BuffRow {
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

// ── Enum mappings ────────────────────────────────────────────────────────
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
  // Burst variants replace S3 when the user casts under burst — each has
  // its own buff list (and DamageFactor on Skill_19/20/21 in the templet).
  SKT_BURST_1: 'B1', SKT_BURST_2: 'B2', SKT_BURST_3: 'B3',
}

/**
 * BT_DMG_* type → PoolCondition mapping (per PR 4bis disasm). Each entry
 * matches one binary case in `FindBuffAdditionalDamage` (VA 0x2637548) or
 * `FindBuffEnemyTeamDecreaseDamageRate` (VA 0x2639194 for type 94).
 */
const POOL_COND_BY_BUFF_TYPE: Record<string, PoolCondition> = {
  // FindBuffAdditionalDamage (VA 0x2637548) dispatch chain
  BT_DMG_OWNER_LOST_HP_RATE:  'owner_lost_hp',       // 84  @ 0x26376f8
  BT_DMG_TARGET_LOST_HP_RATE: 'target_lost_hp',      // 85  @ 0x2637744
  BT_DMG_OWNER_BUFF:          'owner_buff',          // 88  @ 0x2637938
  BT_DMG_TARGET_BUFF:         'target_buff',         // 89  @ 0x2637988
  BT_DMG_OWNER_DEBUFF:        'owner_debuff',        // 90  @ 0x26379dc
  BT_DMG_TARGET_DEBUFF:       'target_debuff',       // 91  @ 0x2637a2c
  BT_DMG_TARGET_BREAK:        'target_break',        // 95  @ 0x2637a94
  BT_DMG_KILL_COUNT_STACK:    'kill_count_stack',    // 97  @ 0x2637b50
  BT_DMG_NOT_CRITICAL:        'not_critical',        // 98  @ 0x2637b90
  BT_DMG_PVP_CONTENT:         'pvp_content',         // 99  @ 0x2637c04
  BT_DMG_CASTER_LOST_HP_RATE: 'caster_lost_hp',      // 101 @ 0x2637c84
  BT_DMG_OWNER_TEAM_BUFF:     'team_buff',           // 102 @ 0x2637d0c
  BT_DMG_MY_TEAM_DECREASE:    'team_decrease',       // 103 @ 0x2637e20
  BT_DMG_MONADGATE_CONTENT:   'monadgate_content',   // 104 @ 0x2637f18
  BT_DMG_TOWER_CONTENT:       'tower_content',       // 105 @ 0x2637fec
  // FindBuffEnemyTeamDecreaseDamageRate (VA 0x2639194) — dedicated fn for type 94
  BT_DMG_ENEMY_TEAM_DECREASE: 'enemy_team_decrease', // 94  @ 0x2639194 (separate)
}

// Percent-encoded stats (per-mille → %).
const PERCENT_STATS = new Set([
  'ST_CRITICAL_DMG_RATE', 'ST_CRITICAL_RATE',
  'ST_PIERCE_POWER_RATE', 'ST_DMG_REDUCE_RATE',
  'ST_DMG_BOOST', 'ST_BUFF_CHANCE', 'ST_BUFF_RESIST',
])

// ── Helpers ──────────────────────────────────────────────────────────────
function num(v: string | undefined): number {
  if (!v) return 0
  const p = parseInt(v, 10)
  return Number.isFinite(p) ? p : 0
}

// Strip {C/...}{/C} pseudo-color tags from in-game text without losing inner text.
function stripColorTags(s: string): string {
  return s.replace(/\{[^/}]+\/([^}]*)\}/g, '$1').replace(/\{\/[A-Z]+\}/g, '')
}

function splitCsv(s: string | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

/**
 * Resolve `CallerSkillType` (CSV of SKT_*) into `BuffTrigger.callerSlots`.
 *   empty / contains SKT_ALL          → 'all'
 *   contains SKT_FIRST/SECOND/ULTIMATE → list of matching slots (deduped)
 *   only burst-type entries           → []  (caller drops the buff — bursts not modeled)
 */
export function resolveCallerSlots(csv: string | undefined): 'all' | CallerSlot[] {
  const list = splitCsv(csv)
  if (list.length === 0 || list.includes('SKT_ALL')) return 'all'
  const slots: CallerSlot[] = []
  for (const skt of list) {
    const slot = SLOT_BY_SKT[skt]
    if (slot && !slots.includes(slot)) slots.push(slot)
  }
  return slots
}

/**
 * Resolve a `BuffConditionType` into a `TriggerCondition`. Returns null when
 * the condition isn't representable in our context (the reducer drops the buff).
 */
export function resolveCondition(cond: string | undefined, condValue?: string): BuffTrigger['requires'] | null {
  switch (cond ?? 'NONE') {
    case 'NONE':                   return 'always'
    case 'ATTACKER_ELEMENT_WIN':   return 'adv'
    case 'ATTACKER_ELEMENT_LOSE':  return 'disadv'
    case 'ATTACKER_ELEMENT_EQUAL': return 'neutral'
    case 'CASTER_CRITICAL':        return 'crit'
    case 'TARGET_IS_BOSS':         return 'boss'
    case 'OWNER_RESOURCE':         return 'resource'
    // OWNER_HAS_BUFF / CASTER_HAS_BUFF — buff-condition catalogs.
    // BuffConditionValue=6 = "Defense up" (validated via Veronica core fusion
    // S1 self-debuff `2700037_1_3` whose desc reads "If the caster's Defense
    // is currently increased…", and the core-fusion passive
    // `core_passive_def_buff_ally_dmg`). Other values (1=ATK up, 7=Shield…)
    // wired ad-hoc as we encounter them.
    case 'OWNER_HAS_BUFF':
    case 'CASTER_HAS_BUFF':
      if (condValue === '6') return 'caster_def_up'
      return null
    // TARGET_ELEMENT — gates damage on the target's element (EE mainstats
    // like Maxwell's "DMG vs Light" carry `BuffConditionValue=3`). Element
    // index per `ELEMENT_BY_INDEX` (0=Earth, 1=Water, 2=Fire, 3=Light, 4=Dark).
    case 'TARGET_ELEMENT':
      switch (condValue ?? '0') {
        case '0': return 'target_element_earth'
        case '1': return 'target_element_water'
        case '2': return 'target_element_fire'
        case '3': return 'target_element_light'
        case '4': return 'target_element_dark'
        default:  return null
      }
    default:                       return null
  }
}

/**
 * Pick the row with the highest `Level` for each `BuffID`. There can be 1..N
 * rows per BuffID — players reach the max-Level version after fully unlocking.
 */
function indexBuffsByIdMax(buffs: BuffRow[]): Map<string, BuffRow> {
  const out = new Map<string, BuffRow>()
  for (const b of buffs) {
    if (!b.BuffID) continue
    const cur = out.get(b.BuffID)
    if (!cur || num(b.Level) > num(cur.Level)) out.set(b.BuffID, b)
  }
  return out
}

/** Pick the highest-`SkillLevel` row for each `SkillID`. */
function indexSkillLevelMax(rows: SkillLevelRow[]): Map<string, SkillLevelRow> {
  const out = new Map<string, SkillLevelRow>()
  for (const r of rows) {
    if (!r.SkillID) continue
    const cur = out.get(r.SkillID)
    if (!cur || num(r.SkillLevel) > num(cur.SkillLevel)) out.set(r.SkillID, r)
  }
  return out
}

// ── Awakening extractor ──────────────────────────────────────────────────

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

    const eff = decodeAwakeningEffect(buffType, statType, applyingType, rawValue, buffId)
    if (!eff) continue

    // Several buff families gate on the target being a boss even when their
    // BuffConditionType=NONE — the engine resolves the gate via the buff
    // type/name pattern:
    //   BT_DMG_TO_BOSS         → boss (Awakening_Boss_Dmg_10 +30%)
    //   Awakening_Boss_*_Down_* → boss (BT_STAT_PREMIUM negative ST_BUFF_*)
    const isMonsterDebuff = eff.target === 'monster_res' || eff.target === 'monster_eff'
    const requires: BuffTrigger['requires'] =
      buffType === 'BT_DMG_TO_BOSS' || isMonsterDebuff ? 'boss' : baseRequires

    const appliesTo = decodeAwakeningApplies(node)
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

/**
 * Decode an awakening buff's `(buffType, statType, applyingType, rawValue)`
 * tuple into a `BuffEffect`. Returns null if the row doesn't contribute to
 * a damage calc.
 */
function decodeAwakeningEffect(
  buffType: string,
  statType: string,
  applyingType: string,
  rawValue: number,
  buffId: string,
): BuffEffect | null {
  const isRate = applyingType === 'OAT_RATE'
  const isAdd = applyingType === 'OAT_ADD'
  if (!isRate && !isAdd) return null

  // BT_DMG cond=NONE → pool. Skip Awakening_Chain_Dmg_* (chain-only, not single-skill).
  if (buffType === 'BT_DMG' && statType === 'ST_NONE') {
    if (/^Awakening_Chain_Dmg_/.test(buffId)) return null
    return { target: 'pool', unit: '%', amount: rawValue / 10 }
  }

  // BT_DMG_TO_BOSS cond=NONE → pool gated on `requires:'boss'` (set by caller).
  // Covers Awakening_Boss_Dmg_10 (+30%) and `licence_Awakening_Boss_Dmg_*`.
  if (buffType === 'BT_DMG_TO_BOSS' && statType === 'ST_NONE') {
    return { target: 'pool', unit: '%', amount: rawValue / 10 }
  }

  // Awakening_Boss_*_Down_* — engine treats negative ST_BUFF_RESIST/CHANCE as
  // a debuff on the boss target despite TargetType=ME. Buff name pattern.
  if (buffType === 'BT_STAT_PREMIUM' && /^Awakening_Boss_.*_Down_/.test(buffId)) {
    if (statType === 'ST_BUFF_RESIST') return { target: 'monster_res', unit: '%', amount: rawValue / 10 }
    if (statType === 'ST_BUFF_CHANCE') return { target: 'monster_eff', unit: '%', amount: rawValue / 10 }
  }

  // Percent stats from BT_STAT_PREMIUM / BT_STAT (Awakening) — already in the
  // attacker stat readout (`/api/admin/characters/:id/stats`); emitting here
  // would double-count.
  if (PERCENT_STATS.has(statType)) return null

  // ATK / DEF / HP — same: already in the stats readout.
  if (statType === 'ST_ATK' || statType === 'ST_DEF' || statType === 'ST_HP') return null

  return null
}

// ── Char-skill extractor ─────────────────────────────────────────────────

export interface ExtractCharSkillInput {
  characters: CharTempletRow[]
  skillLevels: SkillLevelRow[]
  buffs: BuffRow[]
}

/**
 * Map `Skill_N` index → active CallerSlot or 'passive' (or undefined for
 * unmodeled slots — strikes / backups).
 *
 * Active : S1=Skill_1, S2=Skill_2, S3=Skill_3, B1=Skill_19, B2=Skill_20, B3=Skill_21.
 * Passive: Skill_4 (chain), Skill_8 (transcendent), Skill_22 (class),
 *          Skill_23 (core-fusion `SKT_FUSION_PASSIVE` — Veronica's CHD pop +
 *          DEF-buff allies damage bonus, etc.) — always-on, fire on every
 *          active cast subject to CallerSkillType (which now includes the
 *          burst variants when applicable).
 */
function slotIndexToCaller(idx: number): CallerSlot | 'passive' | undefined {
  if (idx === 1) return 'S1'
  if (idx === 2) return 'S2'
  if (idx === 3) return 'S3'
  if (idx === 19) return 'B1'
  if (idx === 20) return 'B2'
  if (idx === 21) return 'B3'
  if (idx === 4 || idx === 8 || idx === 22 || idx === 23) return 'passive'
  return undefined
}

export function extractCharSkillBuffs(input: ExtractCharSkillInput): ApplicableBuff[] {
  const buffsById = indexBuffsByIdMax(input.buffs)
  const skillLevelMax = indexSkillLevelMax(input.skillLevels)
  const out: ApplicableBuff[] = []

  for (const charRow of input.characters) {
    const charId = charRow.ID
    if (!charId) continue

    // Build (buffId → set of caller slots that reference it via this char's
    // skill loadout). Then intersect with BuffTemplet's own CallerSkillType.
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
      // Passives fire on every active cast — including burst variants since
      // the player still rolls the same chain-passive / class-passive when
      // casting Burst 1/2/3 over their S3.
      const slotsToTag: CallerSlot[] = caller === 'passive' ? ['S1', 'S2', 'S3', 'B1', 'B2', 'B3'] : [caller]
      for (const bid of splitCsv(lvlRow.BuffID)) {
        const set = hostedSlots.get(bid) ?? new Set<CallerSlot>()
        for (const s of slotsToTag) set.add(s)
        hostedSlots.set(bid, set)
      }
    }

    for (const [bid, hostSet] of hostedSlots) {
      const b = buffsById.get(bid)
      if (!b) continue
      // Caster-side buffs only.
      //   - `ME`        → always accepted.
      //   - `MY_TEAM`   → accept only when `BuffCreateType` is PASSIVE/PASSIVE2.
      //     Non-permanent MY_TEAM buffs (SKILL_START/SKILL_FINISH on a skill
      //     cast) apply AFTER the cast — Skadi S2 grants team CHC/CHD that
      //     benefits *next* turn, not the current S2 hit. Permanent MY_TEAM
      //     buffs (Veronica core fusion `core_passive_def_buff_ally_dmg`)
      //     genuinely include the caster from battle start.
      const target = b.TargetType ?? ''
      const teamLike = target === 'MY_TEAM'
      const isPermanentEarly = b.BuffCreateType === 'PASSIVE' || b.BuffCreateType === 'PASSIVE2'
      if (target !== 'ME' && !(teamLike && isPermanentEarly)) continue
      // Drop ON_SPAWN buffs — they fire at battle start with a finite
      // TurnDuration and we don't model turn-window state. Ex:
      // `core_passive_cri_dmg` (+50 CHD for 2 turns) would over-apply if
      // extracted as always-on. The user inputs final ATK/CHD/etc. already
      // reflecting whichever turn they're on.
      if (b.BuffCreateType === 'ON_SPAWN') continue

      const eff = decodeCharSkillEffect(b)
      if (!eff) continue
      const requires = resolveCondition(b.BuffConditionType, b.BuffConditionValue)
      if (!requires) continue

      // BuffCreateType decides how `callerSlots` is gated:
      //   PASSIVE / PASSIVE2  → permanent. CallerSkillType is the gate.
      //   else (SKILL_START)  → combat-triggered. Intersect host slots × CallerSkillType.
      const isPermanent = b.BuffCreateType === 'PASSIVE' || b.BuffCreateType === 'PASSIVE2'
      const filterSlots = resolveCallerSlots(b.CallerSkillType)
      let finalSlots: CallerSlot[]
      // Empty filterSlots means CallerSkillType references no recognized slot
      // type — drop. Bursts ARE recognized now (B1/B2/B3) so a CSV listing
      // only burst types resolves to ['B1', 'B2', 'B3'] not the empty set.
      if (filterSlots !== 'all' && filterSlots.length === 0) continue
      if (isPermanent) {
        finalSlots = filterSlots === 'all' ? ['S1', 'S2', 'S3', 'B1', 'B2', 'B3'] : filterSlots
      } else {
        const hostArr = Array.from(hostSet)
        finalSlots = filterSlots === 'all' ? hostArr : hostArr.filter(s => filterSlots.includes(s))
      }
      if (finalSlots.length === 0) continue

      const finalRequires: BuffTrigger['requires'] = b.Type === 'BT_DMG_TO_BOSS' ? 'boss' : requires
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

/**
 * Decode a char-skill `BuffRow` into a `BuffEffect`. Returns null for buffs we
 * don't propagate into the formula (BT_DMG_REDUCE caster DR, BT_HEAL, etc.).
 *
 * Exported for reuse by `extract-ee.ts` (EE buffs share the same Type/StatType
 * decoding rules — only the source/scaling differ).
 */
export function decodeCharSkillEffect(b: BuffRow): BuffEffect | null {
  const t = b.Type ?? ''
  const stat = b.StatType ?? ''
  const value = num(b.Value)
  if (value === 0 && t !== 'BT_SWAP_STAT_ATTACK') return null

  // ── Direct pool contribution (type 83 BT_DMG, type 96 BT_DMG_TO_BOSS) ──
  // Accepts ST_NONE (char-skill buffs) AND ST_DMG_BOOST (EE mainstat
  // convention — Maxwell `BID_CEQUIP_MAIN_DMG_DARK` etc.). Both encode the
  // same pool % addition; they only differ in their cosmetic StatType slot.
  if (t === 'BT_DMG' && (stat === 'ST_NONE' || stat === 'ST_DMG_BOOST')) {
    return { target: 'pool', unit: '%', amount: value / 10 }
  }
  if (t === 'BT_DMG_TO_BOSS' && (stat === 'ST_NONE' || stat === 'ST_DMG_BOOST')) {
    return { target: 'pool', unit: '%', amount: value / 10 }
  }

  // ── Scaling — replaces ATK or adds a separate component ──
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

  // ── Conditional pool (BT_DMG_* types — see POOL_COND_BY_BUFF_TYPE for VAs) ──
  const poolCond = POOL_COND_BY_BUFF_TYPE[t]
  if (poolCond) {
    return { target: 'pool_cond', unit: '%', amount: value / 10, poolCond }
  }

  // ── BT_STAT — combat-triggered stat buff ──
  // Validated targets (% display stats):
  //   ST_PIERCE_POWER_RATE  → pen   (Demiurge Stella S1 +10% PEN, S3 +50% PEN vs boss)
  //   ST_CRITICAL_DMG_RATE  → chd
  //   ST_CRITICAL_RATE      → crit_rate
  //   ST_DMG_BOOST          → pool  (additive damage % — same channel as BT_DMG)
  // ST_ATK/DEF/HP intentionally skipped: already in the stats prefill.
  // ST_SPEED/EFF/RES aren't damage-formula stats.
  if (t === 'BT_STAT') {
    if (stat === 'ST_PIERCE_POWER_RATE') return { target: 'pen',       unit: '%', amount: value / 10 }
    if (stat === 'ST_CRITICAL_DMG_RATE') return { target: 'chd',       unit: '%', amount: value / 10 }
    if (stat === 'ST_CRITICAL_RATE')     return { target: 'crit_rate', unit: '%', amount: value / 10 }
    if (stat === 'ST_DMG_BOOST')         return { target: 'pool',      unit: '%', amount: value / 10 }
  }

  return null
}
