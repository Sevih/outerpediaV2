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
}

interface CharacterEntry {
  id: string
  name: string
  element: string
  class: string
  subClass: string
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
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function buildSkillData(skillId: string | undefined, levelsBySkill: Map<string, SkillLevel[]>): SkillData | null {
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
  return { skillId, damageFactors: factors }
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

export async function GET() {
  const charTemplet = loadJson<CharacterTempletRow[]>(path.join(JSON2_DIR, 'CharacterTemplet.json'))
  const skillLevels = loadJson<SkillLevel[]>(path.join(JSON2_DIR, 'CharacterSkillLevelTemplet.json'))
  const evoStats = loadJson<EvolutionStatRow[]>(path.join(JSON2_DIR, 'CharacterEvolutionStatTemplet.json'))
  const buffs = loadJson<BuffRow[]>(path.join(JSON2_DIR, 'BuffTemplet.json'))

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
      skills: {
        first: buildSkillData(row.Skill_1, levelsBySkill),
        second: buildSkillData(row.Skill_2, levelsBySkill),
        ultimate: buildSkillData(row.Skill_3, levelsBySkill),
      },
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
