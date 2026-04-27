import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')
const CHARACTER_DIR = path.join(process.cwd(), 'data', 'character')

interface SkillLevel { ID: string; SkillID: string; SkillLevel: string; DamageFactor?: string }
interface CharacterTempletRow {
  ID: string
  Skill_1?: string; Skill_2?: string; Skill_3?: string; Skill_22?: string
  Atk_Max?: string; Def_Max?: string; HP_Max?: string
  CriticalDMGRate_Max?: string       // encoded ×10, e.g. 1500 = 150%
  CriticalRate_Max?: string          // encoded as int %
  BasicStar?: string                 // rarity (1/2/3) — drives core_passive_Nstar_ablity_*
}

interface BuffRow {
  ID: string; BuffID: string; Level?: string
  Type?: string; StatType?: string; ApplyingType?: string
  Value?: string; BuffConditionType?: string
}

interface SkillLevelRow {
  ID: string; SkillID: string; SkillLevel: string; BuffID?: string
}

// Rows in CharacterEvolutionStatTemplet. Up to 3 stat bonuses per evolution level.
interface EvolutionStatRow {
  CharacterID: string
  EvolutionLevel: string
  RewardStatType_1?: string; RewardValue_1?: string
  RewardStatType_2?: string; RewardValue_2?: string
  RewardStatType_3?: string; RewardValue_3?: string
}

// Rows in CharacterArchiveStatTemplet — a.k.a. the in-game "Hero Codex" global stat
// bonus. Every row is a threshold level (1..11) unlocked by the total codex growth
// goals completed. Values are per-mille (Atk_Rate=100 → +10% ATK, etc.) and apply to
// EVERY character in the roster. The damage-lab defaults to the max (Lv.11).
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
  transcend?: Record<string, string>  // keys like '3', '4_1', '4_2', '5_1', '5_2', '5_3', '6' with localized variants (suffix _jp/_kr/_zh)
  // Set on core-fusion derivatives (ID 2700xxx). Their S1/S2 icons live under the
  // *original* character's ID — only S3 (Ultimate) uses the fusion's own ID.
  originalCharacter?: string
}

export type TranscendLevel = '0' | '3' | '4_1' | '4_2' | '5_1' | '5_2' | '5_3' | '6'
const TRANSCEND_LEVELS: TranscendLevel[] = ['0', '3', '4_1', '4_2', '5_1', '5_2', '5_3', '6']

// Parse the ATK/DEF/HP additive % from a transcend text line. Returns 0 if not found.
// Matches e.g. "ATK DEF HP +30%" or "+30% ATK DEF HP".
function parseTranscendAtkBonus(text: string | undefined): number {
  if (!text) return 0
  const m = text.match(/ATK\s+DEF\s+HP\s+\+(\d+)\s*%/i) ?? text.match(/\+(\d+)\s*%\s+ATK\s+DEF\s+HP/i)
  return m ? parseInt(m[1], 10) : 0
}

interface SkillData {
  skillId: string
  damageFactors: (number | null)[]   // index 0 = level 1, length 5
  // Conditional additional attack ratio derived from CharacterDamageTemplet rows.
  // Pattern: rows named `{charId}_Skill_{slot}_{N}` are MAIN attack hits; rows named
  // `{charId}_Skill_{slot}_{N}_{M}` (3+ numeric segments) are CONDITIONAL sub-attacks
  // that fire on a per-character condition (e.g. Luna's Barrier-triggered additional
  // attack). The additional component contributes (sum_sub_DFs / sum_main_DFs) ×
  // listed_DF as a separate damage hit using the same pool/mit/DR path.
  // Validated empirically on Luna (sub: _2_1=100, _2_2=200; main: _1=300, _2=300, _3=400):
  //   additionalRatio = 300/1000 = 0.30 → 30% extra damage on Barrier trigger,
  //   matches the obs diff of 462 between her two test rows (no-barrier vs barrier).
  // null when no sub-attack rows exist for that skill.
  additionalAttackRatio: number | null
  // Character-specific BT_DMG_TO_BOSS pool bonus (% points) gated by `CallerSkillType`.
  // Sourced from the character's own skill buff lists (BuffID like `2000065_2_4`),
  // filtered to BuffConditionType=NONE / ApplyingType=OAT_RATE / TargetType=ME, with
  // a CallerSkillType list that includes either SKT_ALL or the SKT_* matching this
  // slot (S1=SKT_FIRST, S2=SKT_SECOND, S3=SKT_ULTIMATE). Validated on:
  //   - Ame (2000065_2_4, SKT_ALL, +50%) → applies to S1/S2/S3 on boss
  //   - Stella (2000053_1_3 SKT_FIRST, +100%; 2000053_3_4 SKT_ULTIMATE, +300%)
  // Applied at compute-time by adding to the pool only when the target is boss.
  bossDmgPct: number
}

interface CharacterEntry {
  id: string
  name: string
  element: string
  class: string
  subClass: string
  // Core-fusion source character (ID 2000xxx). Used by the UI to resolve S1/S2
  // skill icons, which live under the original character's ID rather than the
  // fusion's own (2700xxx). Undefined for non-fusion characters.
  originalCharacter?: string
  basicStar: number                   // 1, 2, or 3 — drives the transcend level progression in the UI
  // Base stats at lvl 100 (Max values from CharacterTemplet, no gear/evolution/awakening bonuses)
  atkMax: number
  defMax: number
  hpMax: number
  chdMax: number                      // % (already divided by 10)
  critRateMax: number                 // %
  // Transcendence ATK/DEF/HP additive % bonuses, keyed by level ('0' = none, '6' = max).
  // Parsed from data/character/{id}.json `transcend` field; missing levels default to 0.
  transcendAtkBonus: Record<TranscendLevel, number>
  // Cumulative flat stat bonuses from fully evolving the character (sum of
  // CharacterEvolutionStatTemplet rows for this char). These are in-game UI stats —
  // already baked into the character's combat display — so the damage-lab prefill
  // adds them on top of the base Max stats.
  evolutionBonuses: {
    atkFlat: number
    defFlat: number
    hpFlat: number
    critRateFlat: number
    critDmgFlat: number
  }
  // Class-passive stat bonuses — extracted from CharacterTemplet.Skill_22 (the "class
  // passive skill" shared by every PC of a given class). Example: Mage chars have
  // Skill_22=4 whose max-level BuffID CSV includes MAGE_PASSIVE_2 (ST_ATK +10% OAT_RATE).
  // These are applied unconditionally to the prefill (like evolution bonuses).
  classPassive: {
    atkPct: number; atkFlat: number
    defPct: number; defFlat: number
    hpPct: number;  hpFlat: number
    chdPct: number
    critRatePct: number
    penPct: number
    poolPct: number
  }
  skills: {
    first: SkillData | null
    second: SkillData | null
    ultimate: SkillData | null
  }
  // Damage scaling overrides — empirically decoded from BuffTemplet on the
  // character's skill buff lists. By default every active skill scales on ATK
  // via its DamageFactor; these entries describe deviations from that default.
  //
  //   swap: BT_SWAP_STAT_ATTACK — replaces ATK as the scaling stat. valuePerMille
  //         is the multiplier (1000 = 1:1 swap, 1300 = the swapped stat is
  //         boosted ×1.30 before substitution). Caren (2000089) → DEF × 1.30,
  //         Gnosis Viella (2000109) → HP × 0.25.
  //
  //   add:  BT_DMG_OWNER_STAT / BT_DMG_CASTER_STAT — adds a bonus damage
  //         component scaled on a specific stat *in addition* to ATK.
  //         valuePerMille is the % of that stat folded into the damage equation.
  //         Demiurge Stella (2000053) → +3% HP, Regina (2000067) → +50% CHC.
  //
  //   special: rarer mechanisms that don't fit the simple "stat × value" model:
  //            BT_DMG_OWNER_LOST_HP_RATE (caster's lost-HP %), BT_DMG_TARGET_STAT
  //            (target-stat scaling, e.g. % of target HP for execute-style hits).
  scaling: {
    swap: { stat: string; valuePerMille: number; buffId: string } | null
    add:  { stat: string; valuePerMille: number; buffId: string }[]
    special: { kind: 'lost_hp' | 'target_stat'; stat: string; valuePerMille: number; buffId: string }[]
  }
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

// Walk CharacterDamageTemplet rows for a given (charId, skillSlot) and split them
// into main vs sub-attack weights. The slot is the 1-based Skill_N index from
// CharacterTemplet (1 / 2 / 3 for S1 / S2 / S3); CharacterDamageTemplet rows
// follow the convention `{charId}_Skill_{slot}_{...}`.
//
// Naming patterns observed:
//   {charId}_Skill_{slot}_{N}         → main attack hit (numeric suffix only)
//   {charId}_Skill_{slot}_{N}_{M}     → conditional sub-attack (extra numeric segment)
//   {charId}_Skill_{slot}_{N}_{LET}   → variant of hit N (alphabetic suffix, e.g. Ame's _5_B)
// Variants are intentionally ignored here: they represent in-game alternate animations
// of the same hit, not an additive sub-attack component.
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
                       dmgRows: { ID?: string; DamageFactor?: string }[],
                       bossDmgPct: number): SkillData | null {
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
    skillId,
    damageFactors: factors,
    additionalAttackRatio: computeAdditionalRatio(charId, slot, dmgRows),
    bossDmgPct,
  }
}

// Walk every Skill_N slot of `charRow`, collect any BT_DMG_TO_BOSS passive buff
// (cond=NONE, OAT_RATE, TargetType=ME), and return the resolved per-slot bonus
// for S1/S2/S3 in % points. The buff's `CallerSkillType` is a CSV of SKT_*
// entries — we include a buff in slot N's bucket when the list contains
// SKT_ALL or the SKT_* matching that slot:
//   slot 1 (S1) → SKT_FIRST
//   slot 2 (S2) → SKT_SECOND
//   slot 3 (S3) → SKT_ULTIMATE
// Multiple matching buffs sum (no observed cases yet, but consistent with how
// the engine handles stackable BT_DMG_TO_BOSS sources).
const SLOT_TO_SKT: Record<number, string> = { 1: 'SKT_FIRST', 2: 'SKT_SECOND', 3: 'SKT_ULTIMATE' }
function parseBossDmgBySlot(charRow: CharacterTempletRow, buffsById: Map<string, BuffRow>, maxSkillLevelBySkill: Map<string, SkillLevelRow>): { 1: number; 2: number; 3: number } {
  const out = { 1: 0, 2: 0, 3: 0 } as { 1: number; 2: number; 3: number }
  for (const k of Object.keys(charRow)) {
    if (!k.startsWith('Skill_')) continue
    const skillId = (charRow as unknown as Record<string, string | undefined>)[k]
    if (!skillId) continue
    const lvlRow = maxSkillLevelBySkill.get(skillId)
    if (!lvlRow?.BuffID) continue
    for (const bid of lvlRow.BuffID.split(',').map(s => s.trim()).filter(Boolean)) {
      const b = buffsById.get(bid)
      if (!b) continue
      if (b.Type !== 'BT_DMG_TO_BOSS') continue
      if ((b.BuffConditionType ?? 'NONE') !== 'NONE') continue
      if ((b.ApplyingType ?? '') !== 'OAT_RATE') continue
      // TargetType=ME means the buff applies to the caster (i.e. the player char).
      // MY_TEAM / ENEMY_TEAM_* / etc. are scoped to other recipients and don't
      // contribute to the caster's own boss-damage bonus.
      const tt = (b as unknown as { TargetType?: string }).TargetType ?? ''
      if (tt !== 'ME') continue
      const csvCaller = (b as unknown as { CallerSkillType?: string }).CallerSkillType ?? ''
      const callers = csvCaller.split(',').map(s => s.trim()).filter(Boolean)
      const value = (parseInt(b.Value ?? '0', 10) || 0) / 10  // per-mille → % points
      if (value === 0) continue
      for (const slot of [1, 2, 3] as const) {
        const skt = SLOT_TO_SKT[slot]
        if (callers.includes('SKT_ALL') || callers.includes(skt)) {
          out[slot] += value
        }
      }
    }
  }
  return out
}

// Stats stored in BuffTemplet as per-mille (value / 10 = %). Consistent with the same
// PERCENT_STATS set in the quirks API.
const PERCENT_STATS = new Set([
  'ST_CRITICAL_DMG_RATE', 'ST_CRITICAL_RATE',
  'ST_PIERCE_POWER_RATE', 'ST_DMG_REDUCE_RATE',
  'ST_DMG_BOOST', 'ST_BUFF_CHANCE', 'ST_BUFF_RESIST',
])

// Accumulator for class-passive stat bonuses parsed from a Skill_22 buff list
// AND the Skill_8 `trancendent_8_*_upgrade` BT_STAT_PREMIUM buffs (unconditional,
// always-on once the player hits that transcend milestone).
interface ClassPassive {
  atkPct: number; atkFlat: number
  defPct: number; defFlat: number
  hpPct: number;  hpFlat: number
  chdPct: number
  critRatePct: number
  penPct: number
  poolPct: number
}

function emptyClassPassive(): ClassPassive {
  return { atkPct: 0, atkFlat: 0, defPct: 0, defFlat: 0, hpPct: 0, hpFlat: 0, chdPct: 0, critRatePct: 0, penPct: 0, poolPct: 0 }
}

// Resolved scaling info per character — see the CharacterEntry.scaling docstring
// for the encoding rules.
type ScalingInfo = CharacterEntry['scaling']

const ADD_SCALING_TYPES = new Set([
  'BT_DMG_OWNER_STAT', 'BT_DMG_CASTER_STAT',
])

// Walk every Skill_N slot of a character row, look up the max-level row in
// CharacterSkillLevelTemplet, and inspect each referenced buff for damage-
// scaling buff types. Aggregates the results into a per-character ScalingInfo.
//
// We deliberately scan ALL Skill_N keys (not just Skill_1/2/3) because the
// scaling buff is most often hosted by a passive slot (Skill_2 marked PASSIVE
// in CharacterSkillTemplet, or Skill_22 class passive) and applies via
// `BuffCreateType=PASSIVE` + `TargetSkillType=SKT_NONE` to every active skill.
function parseScaling(charRow: CharacterTempletRow, buffsById: Map<string, BuffRow>, maxSkillLevelBySkill: Map<string, SkillLevelRow>): ScalingInfo {
  const out: ScalingInfo = { swap: null, add: [], special: [] }
  for (const k of Object.keys(charRow)) {
    if (!k.startsWith('Skill_')) continue
    const skillId = (charRow as unknown as Record<string, string | undefined>)[k]
    if (!skillId) continue
    const lvlRow = maxSkillLevelBySkill.get(skillId)
    if (!lvlRow?.BuffID) continue
    for (const bid of lvlRow.BuffID.split(',').map(s => s.trim()).filter(Boolean)) {
      const b = buffsById.get(bid)
      if (!b) continue
      const t = b.Type ?? ''
      const stat = b.StatType ?? ''
      const value = parseInt(b.Value ?? '0', 10) || 0
      if (t === 'BT_SWAP_STAT_ATTACK') {
        // Last writer wins — chars typically have a single SWAP buff. If a
        // future char ever has multiple, the highest-value one is kept.
        if (!out.swap || value > out.swap.valuePerMille) {
          out.swap = { stat, valuePerMille: value, buffId: bid }
        }
      } else if (ADD_SCALING_TYPES.has(t)) {
        out.add.push({ stat, valuePerMille: value, buffId: bid })
      } else if (t === 'BT_DMG_OWNER_LOST_HP_RATE') {
        out.special.push({ kind: 'lost_hp', stat: 'ST_HP_LOST', valuePerMille: value, buffId: bid })
      } else if (t === 'BT_DMG_TARGET_STAT') {
        out.special.push({ kind: 'target_stat', stat, valuePerMille: value, buffId: bid })
      }
    }
  }
  return out
}

export async function GET() {
  const charTemplet = loadJson<CharacterTempletRow[]>(path.join(JSON2_DIR, 'CharacterTemplet.json'))
  const skillLevels = loadJson<SkillLevel[]>(path.join(JSON2_DIR, 'CharacterSkillLevelTemplet.json'))
  const evoStats = loadJson<EvolutionStatRow[]>(path.join(JSON2_DIR, 'CharacterEvolutionStatTemplet.json'))
  const buffs = loadJson<BuffRow[]>(path.join(JSON2_DIR, 'BuffTemplet.json'))
  const dmgRows = loadJson<{ ID?: string; DamageFactor?: string }[]>(path.join(JSON2_DIR, 'CharacterDamageTemplet.json'))

  // Index buffs by BuffID — there can be several rows per id (different Level), pick max.
  const buffsById = new Map<string, BuffRow>()
  for (const b of buffs) {
    if (!b.BuffID) continue
    const existing = buffsById.get(b.BuffID)
    if (!existing || parseInt(b.Level ?? '0', 10) > parseInt(existing.Level ?? '0', 10)) {
      buffsById.set(b.BuffID, b)
    }
  }

  // Index skill-level rows by SkillID → pick max level row (that's what the player has
  // after fully leveling the skill). Class passives usually only have Level 1 so this is
  // a no-op for them, but it's consistent with how we pick max elsewhere.
  const skillLevelRows = skillLevels as unknown as SkillLevelRow[]
  const maxSkillLevelBySkill = new Map<string, SkillLevelRow>()
  for (const r of skillLevelRows) {
    if (!r.SkillID) continue
    const existing = maxSkillLevelBySkill.get(r.SkillID)
    if (!existing || parseInt(r.SkillLevel, 10) > parseInt(existing.SkillLevel, 10)) {
      maxSkillLevelBySkill.set(r.SkillID, r)
    }
  }

  // Accumulate one buff into the class-passive bucket, respecting condition.
  // Only BT_STAT_PREMIUM (always-on innate stats like MAGE_PASSIVE_2 +10% ATK,
  // PRIEST_PASSIVE_2 +10% HP, trancendent_8_hp_upgrade +10% HP) and BT_DMG (pool)
  // buffs count as permanent passives. BT_STAT (without PREMIUM) is a combat-
  // triggered buff and must not be folded into the character's base stats.
  function accumulate(cp: ClassPassive, buff: BuffRow | undefined): void {
    if (!buff) return
    if (buff.BuffConditionType && buff.BuffConditionType !== 'NONE') return
    const apply = buff.ApplyingType ?? ''
    const stat = buff.StatType ?? ''
    const type = buff.Type ?? ''
    if (type !== 'BT_STAT_PREMIUM' && type !== 'BT_DMG') return
    const raw = parseInt(buff.Value ?? '0', 10) || 0
    const isRate = apply === 'OAT_RATE'
    const isAdd = apply === 'OAT_ADD'
    if (!isRate && !isAdd) return

    if (type === 'BT_DMG' && stat === 'ST_NONE') { cp.poolPct += raw / 10; return }
    if (PERCENT_STATS.has(stat)) {
      const amt = raw / 10
      if (stat === 'ST_CRITICAL_DMG_RATE')      cp.chdPct      += amt
      else if (stat === 'ST_CRITICAL_RATE')     cp.critRatePct += amt
      else if (stat === 'ST_PIERCE_POWER_RATE') cp.penPct      += amt
      else if (stat === 'ST_DMG_BOOST')         cp.poolPct     += amt
      return
    }
    if (stat === 'ST_ATK') {
      if (isRate) cp.atkPct  += raw / 10
      else         cp.atkFlat += raw
      return
    }
    if (stat === 'ST_DEF') {
      if (isRate) cp.defPct  += raw / 10
      else         cp.defFlat += raw
      return
    }
    if (stat === 'ST_HP') {
      if (isRate) cp.hpPct  += raw / 10
      else         cp.hpFlat += raw
    }
  }

  // Walk the CharacterTemplet Skill_N slots and accumulate BT_STAT_PREMIUM /
  // BT_DMG buffs (unconditional innate passives). These cover:
  //   - Skill_22 class passives (MAGE_PASSIVE_2 +10% ATK, PRIEST_PASSIVE_2 +10% HP, etc.)
  //   - Skill_8  transcendent 8 upgrades (trancendent_8_hp_upgrade +10% HP, etc.)
  //   - Any other slot that carries a BT_STAT_PREMIUM buff with cond=NONE
  //
  // Combat-triggered buffs (Type BT_STAT without PREMIUM, BT_DOT_*, BT_SHIELD_*, etc.)
  // are excluded — they fire on skill cast and must not be counted as permanent stats.
  //
  // NOTE: `core_passive_${star}star_ablity_*` buffs exist in BuffTemplet but are only
  // attached to non-playable entities (2700xxx/2710xxx Detachment/Trust chars via
  // skill 372/572). They do NOT apply to regular player chars.
  function parseClassPassive(charRow: CharacterTempletRow): ClassPassive {
    const cp = emptyClassPassive()
    for (const k of Object.keys(charRow)) {
      if (!k.startsWith('Skill_')) continue
      const skillId = (charRow as unknown as Record<string, string | undefined>)[k]
      if (!skillId) continue
      const lvlRow = maxSkillLevelBySkill.get(skillId)
      if (!lvlRow?.BuffID) continue
      for (const bid of lvlRow.BuffID.split(',').map(s => s.trim()).filter(Boolean)) {
        accumulate(cp, buffsById.get(bid))
      }
    }
    return cp
  }

  // Parse additional bonuses from the curated transcend text at a given level.
  // Example Tio Lv6: "ATK DEF HP +30%\n+5% Health\n+25 Action Points at battle start"
  // Example Astei Lv6: "ATK DEF HP +30%\n+5% Ally Team Health\n+25 Action Points"
  // → extra +5% HP on top of the base +30% ATK DEF HP line.
  //
  // We include "Ally Team" auras because the caster counts as a team member and benefits
  // from her own team buff (empirically validated on Astei: 3684 × 1.65 + 931 × 1.55 = 7521
  // matches in-game 7567 within ~0.6%).
  function parseTranscendExtras(text: string | undefined): { hpPct: number; chdPct: number; critRatePct: number } {
    const out = { hpPct: 0, chdPct: 0, critRatePct: 0 }
    if (!text) return out
    for (const line of text.split(/\r?\n/).slice(1)) {
      let m = line.match(/\+(\d+(?:\.\d+)?)\s*%\s*(?:Ally\s+Team\s+)?Health/i)
      if (m) out.hpPct += parseFloat(m[1])
      m = line.match(/\+(\d+(?:\.\d+)?)\s*%\s*(?:Ally\s+Team\s+)?Critical\s+Damage/i)
      if (m) out.chdPct += parseFloat(m[1])
      m = line.match(/\+(\d+(?:\.\d+)?)\s*%\s*(?:Ally\s+Team\s+)?Critical\s+Hit\s+Chance/i)
      if (m) out.critRatePct += parseFloat(m[1])
    }
    return out
  }

  const levelsBySkill = new Map<string, SkillLevel[]>()
  for (const row of skillLevels) {
    const arr = levelsBySkill.get(row.SkillID) ?? []
    arr.push(row)
    levelsBySkill.set(row.SkillID, arr)
  }

  // Cumulate evolution stat bonuses per character (sum across all EvolutionLevel rows).
  // ST_ATK / ST_DEF / ST_HP are flat; ST_CRITICAL_RATE / ST_CRITICAL_DMG_RATE are /10 % points.
  const evoByChar = new Map<string, { atkFlat: number; defFlat: number; hpFlat: number; critRateFlat: number; critDmgFlat: number }>()
  for (const row of evoStats) {
    const cid = row.CharacterID
    if (!cid) continue
    const bucket = evoByChar.get(cid) ?? { atkFlat: 0, defFlat: 0, hpFlat: 0, critRateFlat: 0, critDmgFlat: 0 }
    for (let i = 1; i <= 3; i++) {
      const t = row[`RewardStatType_${i}` as keyof EvolutionStatRow]
      const v = parseInt(row[`RewardValue_${i}` as keyof EvolutionStatRow] ?? '0', 10) || 0
      if (t === 'ST_ATK')                 bucket.atkFlat     += v
      else if (t === 'ST_DEF')            bucket.defFlat     += v
      else if (t === 'ST_HP')             bucket.hpFlat      += v
      else if (t === 'ST_CRITICAL_RATE')  bucket.critRateFlat += v / 10
      else if (t === 'ST_CRITICAL_DMG_RATE') bucket.critDmgFlat += v / 10
    }
    evoByChar.set(cid, bucket)
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
    const transcendAtkBonus: Record<TranscendLevel, number> = {
      '0': 0, '3': 0, '4_1': 0, '4_2': 0, '5_1': 0, '5_2': 0, '5_3': 0, '6': 0,
    }
    if (curated.transcend) {
      for (const lvl of TRANSCEND_LEVELS) {
        if (lvl === '0') continue
        transcendAtkBonus[lvl] = parseTranscendAtkBonus(curated.transcend[lvl])
      }
    }
    const entry: CharacterEntry = {
      id: row.ID,
      name: curated.Fullname ?? row.ID,
      element: curated.Element ?? '',
      class: curated.Class ?? '',
      subClass: curated.SubClass ?? '',
      originalCharacter: curated.originalCharacter,
      basicStar: parseInt(row.BasicStar ?? '0', 10) || 0,
      atkMax: parseInt(row.Atk_Max ?? '0', 10) || 0,
      defMax: parseInt(row.Def_Max ?? '0', 10) || 0,
      hpMax: parseInt(row.HP_Max ?? '0', 10) || 0,
      chdMax: (parseInt(row.CriticalDMGRate_Max ?? '0', 10) || 0) / 10,
      critRateMax: (parseInt(row.CriticalRate_Max ?? '0', 10) || 0) / 10,
      transcendAtkBonus,
      evolutionBonuses: evoByChar.get(row.ID) ?? { atkFlat: 0, defFlat: 0, hpFlat: 0, critRateFlat: 0, critDmgFlat: 0 },
      classPassive: (() => {
        const cp = parseClassPassive(row)
        // Fold Lv6 transcend-text extras (e.g. Tio "+5% Health") into the innate
        // passive bucket — the game applies them as permanent stat modifiers.
        const extras = parseTranscendExtras(curated.transcend?.['6'])
        cp.hpPct       += extras.hpPct
        cp.chdPct      += extras.chdPct
        cp.critRatePct += extras.critRatePct
        return cp
      })(),
      skills: (() => {
        const boss = parseBossDmgBySlot(row, buffsById, maxSkillLevelBySkill)
        return {
          first: buildSkillData(row.Skill_1, 1, row.ID, levelsBySkill, dmgRows, boss[1]),
          second: buildSkillData(row.Skill_2, 2, row.ID, levelsBySkill, dmgRows, boss[2]),
          ultimate: buildSkillData(row.Skill_3, 3, row.ID, levelsBySkill, dmgRows, boss[3]),
        }
      })(),
      scaling: parseScaling(row, buffsById, maxSkillLevelBySkill),
    }
    // Only keep characters that have at least one active skill with a DamageFactor
    const hasAny = [entry.skills.first, entry.skills.second, entry.skills.ultimate]
      .some(s => s?.damageFactors.some(v => v != null))
    if (hasAny) entries.push(entry)
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))

  // Hero Codex global bonuses (applies to every character in the roster).
  // Each row is a codex level; pick the max (Lv.11 = +10% ATK/DEF/HP for a maxed codex).
  const archiveRows = loadJson<ArchiveStatRow[]>(path.join(JSON2_DIR, 'CharacterArchiveStatTemplet.json'))
  const heroCodexLevels = archiveRows.map(r => ({
    level: parseInt(r.ID, 10) || 0,
    atkPct: (parseInt(r.Atk_Rate, 10) || 0) / 10,
    defPct: (parseInt(r.Def_Rate, 10) || 0) / 10,
    hpPct:  (parseInt(r.HP_Rate,  10) || 0) / 10,
  })).sort((a, b) => a.level - b.level)

  return NextResponse.json({ characters: entries, heroCodexLevels })
}
