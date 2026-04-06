import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { LANGS, DEFAULT_LANG, type Lang } from '@/lib/i18n/config'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

// Maps our lang keys to column names in the game JSON tables
const LANG_COLUMNS: Record<Lang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
}

function loadTable<T = Record<string, string>>(name: string): T[] {
  const filePath = path.join(JSON2_DIR, `${name}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

// Build a lookup map from a table, keyed by a field (default: "ID")
function indexBy(rows: Record<string, string>[], key = 'ID', caseInsensitive = false) {
  const map = new Map<string, Record<string, string>>()
  for (const row of rows) {
    const k = row[key]
    if (k) map.set(caseInsensitive ? k.toUpperCase() : k, row)
  }
  return map
}

// Build a lookup map that groups multiple rows per key
function groupBy(rows: Record<string, string>[], key: string) {
  const map = new Map<string, Record<string, string>[]>()
  for (const row of rows) {
    const k = row[key]
    if (!k) continue
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(row)
  }
  return map
}

function getText(textMap: Map<string, Record<string, string>>, id: string): Record<Lang, string> | null {
  const entry = textMap.get(id) ?? textMap.get(id.toUpperCase())
  if (!entry) return null
  const result = {} as Record<Lang, string>
  for (const lang of LANGS) {
    result[lang] = entry[LANG_COLUMNS[lang]] ?? ''
  }
  return result
}

function buildGiftMap(textSystem: Record<string, string>[]) {
  const map: Record<string, string> = {}
  const textMap = indexBy(textSystem)
  for (const row of textSystem) {
    // Entries like SYS_ITS_PRESENT_01 → "Science"
    const match = row.ID?.match(/^SYS_(ITS_PRESENT_\d+)$/)
    if (match) {
      map[match[1]] = textMap.get(row.ID)?.[LANG_COLUMNS[DEFAULT_LANG]] ?? row.ID
    }
  }
  return map
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function extractTranscend(
  charRow: Record<string, string>,
  transcendTemplet: Record<string, string>[],
  uniquePassiveSkillID: string | null,
  skillLevelTemplet: Record<string, string>[],
  textSkill: Record<string, string>[]
) {
  const basicStar = charRow.BasicStar
  const charID = charRow.ID

  // Get transcend entries: character-specific override generic
  const charEntries = transcendTemplet.filter((r) => r.CharacterID === charID)
  const entries = charEntries.length > 0
    ? charEntries
    : transcendTemplet.filter((r) => r.CharacterID === '0' && r.BasicStar === basicStar)

  // Sort entries by TransStar and count per ShowUIStar
  const sorted = entries
    .slice()
    .sort((a, b) => (parseInt(a.TransStar) || 0) - (parseInt(b.TransStar) || 0))

  // Count entries with actual content per ShowUIStar
  const contentCountPerUI = new Map<string, number>()
  for (const r of sorted) {
    const hasContent = (parseInt(r.RewardHPRate) || 0) > 0
      || (parseInt(r.RewardAtkRate) || 0) > 0
      || (parseInt(r.RewardDefRate) || 0) > 0
    // We'll also count entries that unlock new skill levels in a second pass,
    // but stat-based check covers the main case
    if (hasContent) {
      contentCountPerUI.set(r.ShowUIStar, (contentCountPerUI.get(r.ShowUIStar) ?? 0) + 1)
    }
  }

  // Get unique passive DescIDs per skill level
  const textMap = indexBy(textSkill, 'ID', true)
  const uniqueLevels = uniquePassiveSkillID
    ? (groupBy(skillLevelTemplet, 'SkillID').get(uniquePassiveSkillID) ?? [])
        .sort((a, b) => (parseInt(a.SkillLevel) || 0) - (parseInt(b.SkillLevel) || 0))
    : []

  const transcend: Record<string, unknown> = {}
  let prevSkillLevel = 0

  // Stars below the first ShowUIStar are null, starting from 1 for 1-2 stars
  // 3-star chars start at ShowUI 3, so no null entries at all
  const rarity = parseInt(basicStar) || 1
  const firstUIStar = sorted[0] ? parseInt(sorted[0].ShowUIStar) : rarity
  const startNull = rarity >= 3 ? firstUIStar : 1
  for (let s = startNull; s < firstUIStar; s++) {
    transcend[String(s)] = null
  }

  for (const entry of sorted) {
    const ui = entry.ShowUIStar
    const starPlus = parseInt(entry.StarPlus) || 0
    const hasSubLevels = (contentCountPerUI.get(ui) ?? 0) > 1
    const hp = parseInt(entry.RewardHPRate) || 0
    const atk = parseInt(entry.RewardAtkRate) || 0
    const def = parseInt(entry.RewardDefRate) || 0
    const skillLevel = parseInt(entry.SkillLevel) || 0

    // Build the output key: "4" if single, "4_1"/"4_2" if sub-levels
    const outputKey = hasSubLevels ? `${ui}_${starPlus + 1}` : ui

    const parts: Record<Lang, string[]> = {} as Record<Lang, string[]>
    for (const lang of LANGS) parts[lang] = []

    // Stat line
    if (hp > 0 || atk > 0 || def > 0) {
      const pct = atk / 10
      for (const lang of LANGS) {
        parts[lang].push(`ATK DEF HP +${pct}%`)
      }
    }

    // Unique passive unlocks (new levels since previous star)
    for (let lvl = prevSkillLevel + 1; lvl <= skillLevel; lvl++) {
      const levelEntry = uniqueLevels.find((l) => parseInt(l.SkillLevel) === lvl)
      if (levelEntry?.DescID) {
        const descIDs = levelEntry.DescID.split(',').map((s) => s.trim())
        for (const descID of descIDs) {
          const desc = getText(textMap, descID)
          if (desc) {
            for (const lang of LANGS) {
              if (desc[lang]) parts[lang].push(desc[lang].replace(/\\n/g, '\n').trim())
            }
          }
        }
      }
    }

    prevSkillLevel = skillLevel

    // Skip entries with no content (e.g. 2-star sub-levels with HP=0)
    const defaultText = parts[DEFAULT_LANG].join('\n')
    if (!defaultText) continue

    // Skip localized keys when all languages have the same content (stats-only)
    const allSame = LANGS.every((l) => parts[l].join('\n') === defaultText)

    for (const lang of LANGS) {
      const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
      const key = `${outputKey}${suffix}`
      const text = parts[lang].join('\n')
      if (!text) continue
      if (suffix && allSame) continue
      transcend[key] = text
    }
  }

  return transcend
}

// Skill types we extract (mapped to CharacterTemplet Skill_N fields)
const MAIN_SKILL_TYPES = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE'] as const

// For a given skill level, get the buff entry with highest Level ≤ skillLevel
function getBuffAtLevel(buffEntries: Record<string, string>[], skillLevel: number) {
  let best: Record<string, string> | null = null
  for (const entry of buffEntries) {
    const lvl = parseInt(entry.Level) || 0
    if (lvl <= skillLevel && (!best || lvl > (parseInt(best.Level) || 0))) {
      best = entry
    }
  }
  return best ?? buffEntries[0] ?? null
}

// Resolve [Buff_X_BUFFID] placeholders in a description
function resolvePlaceholders(
  desc: string,
  skillLevel: number,
  buffsByID: Map<string, Record<string, string>[]>
) {
  return desc.replace(/\[Buff_([CVT])_([^\]]+)\]/g, (_match, field: string, buffID: string) => {
    const entries = buffsByID.get(buffID)
    if (!entries?.length) return _match

    const buff = getBuffAtLevel(entries, skillLevel)
    if (!buff) return _match

    switch (field) {
      case 'C': {
        const rate = parseInt(buff.CreateRate) || 0
        return `${rate / 10}%`
      }
      case 'V': {
        const val = parseInt(buff.Value) || 0
        if (buff.ApplyingType === 'OAT_RATE') return `${Math.abs(val) / 10}%`
        return String(Math.abs(val))
      }
      case 'T':
        return buff.TurnDuration ?? '0'
      default:
        return _match
    }
  })
}

// Get buff/debuff type label from a buff entry
function buffTypeLabel(
  buff: Record<string, string>,
  tooltipCtx?: { map: Map<string, { name: string; isDebuff: boolean }>; blacklist: Set<string> }
) {
  const type = buff.Type

  // Irremovable handling: IconName contains "Interruption" and has a ToolTipID
  if (buff.IconName?.includes('Interruption') && buff.ToolTipID && tooltipCtx) {
    // Character-specific tooltip (not blacklisted) → use tooltip name as label
    if (!tooltipCtx.blacklist.has(buff.ToolTipID)) {
      const tt = tooltipCtx.map.get(buff.ToolTipID)
      if (tt) return tt.name.toUpperCase().replace(/\s+/g, '_')
    }
    // Generic irremovable → append _IR suffix
    const base = (type === 'BT_STAT' && buff.StatType && buff.StatType !== 'ST_NONE')
      ? `${type}|${buff.StatType}` : type
    return `${base}_IR`
  }

  // Triggered passive mechanics (counter, revenge, agile response, additional attack)
  // Use ActivateText as label instead of the verbose BT_RUN_* type
  if (type.startsWith('BT_RUN_') && buff.ActivateText?.startsWith('SYS_BUFF_')) {
    return buff.ActivateText
  }

  if (type === 'BT_STAT' && buff.StatType && buff.StatType !== 'ST_NONE') {
    return `${type}|${buff.StatType}`
  }
  // Sustained recovery = heal with duration (not instant)
  if ((type === 'BT_HEAL_BASED_TARGET' || type === 'BT_HEAL_BASED_CASTER') &&
      parseInt(buff.TurnDuration) > 0 && buff.BuffRemoveType === 'ON_TURN_END') {
    return 'BT_CONTINU_HEAL'
  }
  return type
}

// Buff types to exclude from display
const BUFF_BLACKLIST = new Set([
  'BT_DMG', 'BT_DMG_OWNER_STAT', 'BT_DMG_OWNER_LOST_HP_RATE',
  'BT_SKILL_RANGE_ALL', 'BT_DMG_ENEMY_TEAM_DECREASE', 'BT_DMG_TO_BOSS',
  'BT_HEAL_BASED_TARGET', 'BT_HEAL_BASED_CASTER',
  'BT_RESOURCE_CHARGE', 'BT_RESOURCE_USE_SKILL', 'BT_SKILL_USING_CONDITION',
  'BT_SWAP_STAT_ATTACK', 'BT_DMG_TARGET_DEBUFF', 'BT_DMG_TARGET_STAT', 'BT_DMG_TARGET_BUFF',
  'BT_STAT_OWNER_LOST_HP_RATE', 'BT_STAT_PREMIUM', 'BT_GROUP', 'BT_DMG_REDUCE', 'BT_STAT|ST_HIT_HP_RECOVERY', 'BT_DMG_TARGET_LOST_HP_RATE'
])

// Classify buffs into buff/debuff arrays
function classifyBuffs(
  buffIDs: string[],
  buffsByID: Map<string, Record<string, string>[]>,
  tooltipCtx?: { map: Map<string, { name: string; isDebuff: boolean }>; blacklist: Set<string> }
) {
  const buffs: string[] = []
  const debuffs: string[] = []
  const seen = new Set<string>()

  for (const bid of buffIDs) {
    const entries = buffsByID.get(bid)
    if (!entries?.length) continue
    const entry = entries[0]
    const label = buffTypeLabel(entry, tooltipCtx)
    if (BUFF_BLACKLIST.has(label)) continue
    // Skip internal stat buffs that only exist during skill execution
    if (entry.BuffRemoveType === 'ON_SKILL_FINISH' && entry.Type === 'BT_STAT') continue
    // Skip permanent stacking stat increases (not a visible buff)
    if (entry.Type === 'BT_STAT' && entry.TurnDuration === '-1' && parseInt(entry.StackCount) > 1) continue
    if (seen.has(label)) continue
    seen.add(label)

    const debuffType = entry.BuffDebuffType ?? ''
    const target = entry.TargetType ?? ''
    if (debuffType.startsWith('DEBUFF')) {
      debuffs.push(label)
    } else if (debuffType.startsWith('NEUTRAL') && target.startsWith('ENEMY')) {
      debuffs.push(label)
    } else if (debuffType === 'BUFF') {
      buffs.push(label)
    }
  }
  return { buffs, debuffs }
}

function targetType(rangeType: string) {
  if (rangeType === 'SINGLE') return 'mono'
  if (rangeType === 'ALL') return 'multi'
  if (rangeType === 'DOUBLE' || rangeType === 'DOUBLE_SPEED') return 'duo'
  if (!rangeType || rangeType === 'NONE') return null
  return rangeType.toLowerCase()
}

function extractSkills(
  charRow: Record<string, string>,
  skillTemplet: Record<string, string>[],
  skillLevelTemplet: Record<string, string>[],
  textSkill: Record<string, string>[],
  buffTemplet: Record<string, string>[],
  tooltipTemplet: Record<string, string>[],
  textSystem: Map<string, Record<string, string>>
) {
  const skillMap = indexBy(skillTemplet)
  const levelsBySkill = groupBy(skillLevelTemplet, 'SkillID')

  // Build tooltip ID → name mapping (e.g. 87 → "HEAVY_STRIKE")
  const tooltipMap = new Map<string, { name: string; isDebuff: boolean }>()
  // Blacklist generic tooltips that duplicate already-extracted buff types
  // 1-75: generic stat/CC/mechanic tooltips, 1001-1102: duplicates of 1-102
  const TOOLTIP_BLACKLIST = new Set<string>()
  for (let i = 1; i <= 75; i++) TOOLTIP_BLACKLIST.add(String(i))
  for (let i = 1001; i <= 1102; i++) TOOLTIP_BLACKLIST.add(String(i))
  TOOLTIP_BLACKLIST.add('78') // Burst Skill
  TOOLTIP_BLACKLIST.add('80') // Find Weakness (= BT_DMG_TARGET_BREAK)
  TOOLTIP_BLACKLIST.add('84') // Burst Skill
  TOOLTIP_BLACKLIST.add('86') // Resurrection Greater (= BT_RESURRECTION)
  TOOLTIP_BLACKLIST.add('88') // Increases Lifesteal (= BT_STAT|ST_VAMPIRIC)
  TOOLTIP_BLACKLIST.add('89') // Reduces Lifesteal
  TOOLTIP_BLACKLIST.add('90') // Immortality (= BT_UNDEAD)
  for (const tt of tooltipTemplet) {
    const nameEntry = textSystem.get(tt.NameID)
    const name = nameEntry?.[LANG_COLUMNS[DEFAULT_LANG]] ?? tt.NameID
    tooltipMap.set(tt.ID, { name, isDebuff: tt.IsDebuff === 'True' })
  }
  const tooltipCtx = { map: tooltipMap, blacklist: TOOLTIP_BLACKLIST }

  const addTooltipBuffs = (ttIDs: string[], buffs: string[], debuffs: string[]) => {
    const seen = new Set(buffs.concat(debuffs))
    for (const ttID of ttIDs) {
      if (TOOLTIP_BLACKLIST.has(ttID)) continue
      const tt = tooltipMap.get(ttID)
      if (!tt) continue
      const label = tt.name.toUpperCase().replace(/\s+/g, '_')
      if (!label) continue
      if (seen.has(label)) continue
      seen.add(label)
      if (tt.isDebuff) debuffs.push(label)
      else buffs.push(label)
    }
  }

  const textMap = indexBy(textSkill, 'ID', true)
  const buffsByID = groupBy(buffTemplet, 'BuffID')

  // Collect all skill IDs assigned to this character
  const charSkills: Record<string, string> = {}
  for (const [key, val] of Object.entries(charRow)) {
    if (key.startsWith('Skill_') && val) {
      charSkills[key] = val
    }
  }

  // Build a map of skillType → skill data for this character
  const skillsByType = new Map<string, { skillID: string; skill: Record<string, string> }>()
  for (const skillID of Object.values(charSkills)) {
    const skill = skillMap.get(skillID)
    if (skill) skillsByType.set(skill.SkillType, { skillID, skill })
  }

  const skills: Record<string, unknown> = {}

  for (const skillType of MAIN_SKILL_TYPES) {
    const entry = skillsByType.get(skillType)
    if (!entry) continue

    const { skillID, skill } = entry
    const levels = (levelsBySkill.get(skillID) ?? [])
      .sort((a, b) => (parseInt(a.SkillLevel) || 0) - (parseInt(b.SkillLevel) || 0))

    if (!levels.length) continue

    const descIDs = (skill.DescID ?? '').split(',').map((s) => s.trim())
    const nameText = getText(textMap, skill.NameID)

    // Build skill output
    const skillOut: Record<string, unknown> = {
      NameIDSymbol: skillID,
      IconName: skill.IconName,
      SkillType: skillType,
    }

    // Skill name per language
    for (const lang of LANGS) {
      const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
      skillOut[`name${suffix}`] = (nameText?.[lang] ?? '').trim()
    }

    // Descriptions per level with resolved placeholders
    const trueDescLevels: Record<string, string> = {}
    for (let i = 0; i < levels.length; i++) {
      const lvl = parseInt(levels[i].SkillLevel) || (i + 1)
      const descID = descIDs[i] ?? descIDs[0]
      const descText = getText(textMap, descID)
      if (!descText) continue

      for (const lang of LANGS) {
        const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
        const key = `${lvl}${suffix}`
        trueDescLevels[key] = resolvePlaceholders(descText[lang], lvl, buffsByID).trim()
      }
    }
    skillOut.true_desc_levels = trueDescLevels

    // Enhancement descriptions (levels 2+)
    const enhancement: Record<string, unknown> = {}
    for (const level of levels) {
      const lvl = parseInt(level.SkillLevel) || 0
      if (lvl <= 1 || !level.DescID) continue

      const enhIDs = level.DescID.split(',').map((s) => s.trim())
      for (const lang of LANGS) {
        const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
        const texts = enhIDs
          .map((eid) => getText(textMap, eid)?.[lang]?.trimEnd())
          .filter((t): t is string => !!t)
        if (texts.length) enhancement[`${lvl}${suffix}`] = texts
      }
    }
    skillOut.enhancement = enhancement

    // WGR and cooldown from level 1
    skillOut.wgr = parseInt(levels[0]?.WGReduce) || null
    const cd = parseInt(levels[0]?.Cool) || null
    skillOut.cd = cd

    // Buff/debuff from all BuffIDs across all levels, including burst skills
    const buffIDSet = new Set<string>()
    for (const lvl of levels) {
      (lvl.BuffID ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((b) => buffIDSet.add(b))
    }
    // Also scan BuffTemplet for implicit buffs matching charID_skillNum_* pattern
    // Only include if the buff is referenced in at least one skill level of this character
    const allCharBuffIDs = new Set<string>()
    for (const sid of Object.values(charSkills)) {
      for (const lvl of (levelsBySkill.get(sid) ?? [])) {
        (lvl.BuffID ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((b) => allCharBuffIDs.add(b))
      }
    }
    const skillNum = Object.entries(charSkills).find(([, v]) => v === skillID)?.[0]?.replace('Skill_', '')
    if (skillNum) {
      const prefix = `${charRow.ID}_${skillNum}_`
      for (const [bid] of buffsByID) {
        if (!bid.startsWith(prefix)) continue
        // Only include if referenced somewhere in skill levels OR in class passive
        if (allCharBuffIDs.has(bid)) buffIDSet.add(bid)
      }
    }
    const extraDebuffs: string[] = []
    if (skill.RequireAP) {
      for (const burstType of ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3']) {
        const burstEntry = skillsByType.get(burstType)
        if (!burstEntry) continue
        const burstLevels = levelsBySkill.get(burstEntry.skillID) ?? []
        const burstL1 = burstLevels.find((l) => l.SkillLevel === '1') ?? burstLevels[0]
        if (burstL1?.BuffID) {
          burstL1.BuffID.split(',').map((s) => s.trim()).filter(Boolean).forEach((b) => buffIDSet.add(b))
        }
        // WG damage on burst desc → BT_WG_REVERSE_HEAL
        const burstDescIDs = (burstEntry.skill.DescID ?? '').split(',').map((s) => s.trim())
        if (burstDescIDs.some((d) => d.includes('SE_DESC_DMG_WG_V'))) {
          extraDebuffs.push('BT_WG_REVERSE_HEAL')
        }
      }
    }
    const { buffs, debuffs } = classifyBuffs([...buffIDSet], buffsByID, tooltipCtx)
    for (const d of extraDebuffs) {
      if (!debuffs.includes(d)) debuffs.push(d)
    }

    // Add tooltip-based properties (e.g. HEAVY_STRIKE)
    const tooltipIDs = (levels[0]?.BuffToolTip ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    addTooltipBuffs(tooltipIDs, buffs, debuffs)

    skillOut.buff = buffs
    skillOut.debuff = debuffs

    // Offensive / target — needs DamageFactor AND enemy targeting
    if (skillType === 'SKT_CHAIN_PASSIVE') {
      skillOut.offensive = true
      skillOut.target = 'multi'
    } else {
      skillOut.offensive = !!levels[0]?.DamageFactor && skill.TargetTeamType === 'ENEMY'
      skillOut.target = targetType(skill.RangeType)
    }

    // Burst effects — attached to whichever skill has RequireAP
    if (skill.RequireAP) {
      const burnEffect: Record<string, unknown> = {}
      const apCosts = skill.RequireAP.split(',').map((s) => parseInt(s.trim()) || 0)

      for (const burstType of ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'] as const) {
        const burstEntry = skillsByType.get(burstType)
        if (!burstEntry) continue

        const burstSkill = burstEntry.skill
        const burstDescText = getText(textMap, (burstSkill.DescID ?? '').split(',')[0])
        const burstLevel = burstType === 'SKT_BURST_1' ? 1 : burstType === 'SKT_BURST_2' ? 2 : 3
        const apIdx = burstLevel - 1

        const burst: Record<string, unknown> = {}
        for (const lang of LANGS) {
          const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
          burst[`effect${suffix}`] = burstDescText?.[lang] ?? ''
        }
        const burstLevels = levelsBySkill.get(burstEntry.skillID) ?? []
        const burstL1 = burstLevels.find((l) => l.SkillLevel === '1') ?? burstLevels[0]
        burst.cost = apCosts[apIdx] ?? 0
        burst.level = burstLevel
        burst.offensive = !!burstL1?.DamageFactor && burstSkill.TargetTeamType === 'ENEMY'
        burst.target = targetType(burstSkill.RangeType)

        burnEffect[burstType] = burst
      }

      if (Object.keys(burnEffect).length) skillOut.burnEffect = burnEffect
    }

    // Chain passive: add dual attack info from BACKUP skills
    if (skillType === 'SKT_CHAIN_PASSIVE') {
      skillOut.wgr = 3

      // Chain passive tooltips apply to both chain and dual
      const chainTooltips = (levels[0]?.BuffToolTip ?? '').split(',').map((s) => s.trim()).filter(Boolean)

      // Collect chain buff IDs: from strike skill levels + implicit chain_* buffs in BuffTemplet
      const charID = charRow.ID
      const chainBuffIDs = new Set<string>()

      const strikeSkill = skillsByType.get('SKT_STRIKE_FINISH')
        ?? skillsByType.get('SKT_STRIKE_AERIAL')
        ?? skillsByType.get('SKT_STRIKE_GROUND')
      if (strikeSkill) {
        const strikeLevels = (levelsBySkill.get(strikeSkill.skillID) ?? [])
          .sort((a, b) => (parseInt(a.SkillLevel) || 0) - (parseInt(b.SkillLevel) || 0))
        const strikeL1 = strikeLevels[0]
        ;(strikeL1?.BuffID ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((b) => chainBuffIDs.add(b))

        // Add tooltips from strike skill + chain passive
        const strikeTooltips = (strikeL1?.BuffToolTip ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        // Will be added after classifyBuffs below
        chainTooltips.push(...strikeTooltips)
      }

      // Add implicit chain_* buffs from BuffTemplet (not referenced in skill levels)
      const chainPrefix = `${charID}_chain_`
      for (const [bid] of buffsByID) {
        if (bid.startsWith(chainPrefix)) chainBuffIDs.add(bid)
      }

      {
        const chainClassified = classifyBuffs([...chainBuffIDs], buffsByID, tooltipCtx)
        skillOut.buff = chainClassified.buffs
        skillOut.debuff = chainClassified.debuffs
        addTooltipBuffs(chainTooltips, skillOut.buff as string[], skillOut.debuff as string[])
      }

      // Dual attack info from BACKUP skills — always wgr 1, offensive, mono
      const backup = skillsByType.get('SKT_BACKUP_AERIAL') ?? skillsByType.get('SKT_BACKUP_GROUND')
      if (backup) {
        skillOut.wgr_dual = 1
        skillOut.dual_offensive = true
        skillOut.dual_target = 'mono'

        const backupLevels = (levelsBySkill.get(backup.skillID) ?? [])
          .sort((a, b) => (parseInt(a.SkillLevel) || 0) - (parseInt(b.SkillLevel) || 0))
        const backupBuffIDs = (backupLevels[0]?.BuffID ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        const backupClassified = classifyBuffs(backupBuffIDs, buffsByID, tooltipCtx)
        skillOut.dual_buff = backupClassified.buffs
        skillOut.dual_debuff = backupClassified.debuffs

        // Add tooltips from backup skill + chain passive
        const backupTooltips = (backupLevels[0]?.BuffToolTip ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        addTooltipBuffs(backupTooltips, skillOut.dual_buff as string[], skillOut.dual_debuff as string[])
      }
    }

    skills[skillType] = skillOut
  }

  return skills
}

interface Tables {
  characters: Record<string, string>[]
  textCharacter: Record<string, string>[]
  textSkill: Record<string, string>[]
  textSystem: Record<string, string>[]
  trustTemplet: Record<string, string>[]
  skillTemplet: Record<string, string>[]
  skillLevelTemplet: Record<string, string>[]
  buffTemplet: Record<string, string>[]
  transcendTemplet: Record<string, string>[]
  extraTemplet: Record<string, string>[]
  fusionTemplet: Record<string, string>[]
  fusionLevelTemplet: Record<string, string>[]
  changeTemplet: Record<string, string>[]
  chainTemplet: Record<string, string>[]
  // Pre-built indexes
  textMap: Map<string, Record<string, string>>
  textSystemMap: Map<string, Record<string, string>>
  extraByChar: Map<string, Record<string, string>>
  fusionByChange: Map<string, Record<string, string>>
  fusionByChar: Map<string, Record<string, string>>
  itemTemplet: Map<string, Record<string, string>>
  textItem: Map<string, Record<string, string>>
  recruitByChar: Map<string, Record<string, string>[]>
  giftMap: Record<string, string>
}

function loadAllTables(): Tables {
  const characters = loadTable('CharacterTemplet')
  const textCharacter = loadTable('TextCharacter')
  const textSkill = loadTable('TextSkill')
  const textSystem = loadTable('TextSystem')
  const trustTemplet = loadTable('TrustTemplet')
  const skillTemplet = loadTable('CharacterSkillTemplet')
  const skillLevelTemplet = loadTable('CharacterSkillLevelTemplet')
  const buffTemplet = loadTable('BuffTemplet')
  const transcendTemplet = loadTable('CharacterTranscendentTemplet')
  const extraTemplet = loadTable('CharacterExtraTemplet')
  const fusionTemplet = loadTable('CharacterFusionTemplet')
  const fusionLevelTemplet = loadTable('CharacterFusionLevelTemplet')
  const changeTemplet = loadTable('CharacterChangeTemplet')
  const chainTemplet = loadTable('ChainCombinationTemplet')

  return {
    characters, textCharacter, textSkill, textSystem, trustTemplet,
    skillTemplet, skillLevelTemplet, buffTemplet, transcendTemplet,
    extraTemplet, fusionTemplet, fusionLevelTemplet, changeTemplet, chainTemplet,
    textMap: indexBy(textCharacter),
    textSystemMap: indexBy(textSystem),
    extraByChar: indexBy(extraTemplet, 'CharacterID'),
    fusionByChange: indexBy(fusionTemplet, 'ChangeCharID'),
    fusionByChar: indexBy(fusionTemplet, 'CharacterID'),
    itemTemplet: indexBy(loadTable('ItemTemplet')),
    textItem: indexBy(loadTable('TextItem')),
    recruitByChar: groupBy(loadTable('RecruitGroupTemplet'), 'PickupID'),
    giftMap: buildGiftMap(textSystem),
  }
}

function extractCharacter(id: string, tables?: Tables) {
  const t = tables ?? loadAllTables()

  const charRow = t.characters.find((c) => c.ID === id)
  if (!charRow) return null

  const trustRow = t.trustTemplet.find((r) => r.ID === id)
  const extraRow = t.extraByChar.get(id)
  const fusionRow = t.fusionByChange.get(id)

  // Names
  const names = getText(t.textMap, `${id}_Name`)
  const nickname = getText(t.textMap, charRow.NickNameID ?? `${id}_NickName`)
  // Voice actor: normalize "CV.X" → "CV. X" and treat "0" as empty
  const formatVA = (s: string) => {
    if (!s || s === '0') return ''
    return s.replace(/^(CV|VA)\./i, '$1. ').replace(/  +/, ' ').trim()
  }

  // Gift
  const gift = trustRow ? t.giftMap[trustRow.PresentTypeLike] ?? trustRow.PresentTypeLike : null

  const result: Record<string, unknown> = { ID: id }

  // Fullname per language — prefix with NickName if ShowNickName, or FusionName for core fusion
  for (const lang of LANGS) {
    const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
    let fullname = names?.[lang] ?? ''

    if (fusionRow?.FusionNameID) {
      const fusionText = getText(t.textSystemMap, fusionRow.FusionNameID)
      // Normalize "Core Fusion: X" / "Core Fusion : X" → "Core Fusion X"
      if (fusionText?.[lang]) fullname = fusionText[lang].replace(/\s*[:：]\s*/g, ' ')
    } else if (extraRow?.ShowNickName === 'True' && nickname?.[lang]) {
      fullname = `${nickname[lang]} ${fullname}`
    }

    result[`Fullname${suffix}`] = fullname.trim()
  }

  result.Rarity = parseInt(charRow.BasicStar) || 0

  // Element, Class, SubClass: use game display names from TextSystem
  const elemRaw = charRow.Element?.replace('CET_', '') ?? ''
  const elemText = t.textSystemMap.get(`SYS_ELEMENT_${elemRaw}`)
  result.Element = elemText?.[LANG_COLUMNS[DEFAULT_LANG]] ?? capitalize(elemRaw)

  const classRaw = charRow.Class?.replace('CCT_', '') ?? ''
  const classText = t.textSystemMap.get(`SYS_CLASS_${classRaw}`)
  result.Class = classText?.[LANG_COLUMNS[DEFAULT_LANG]] ?? capitalize(classRaw)

  const subClassRaw = charRow.SubClass ?? ''
  const subClassText = t.textSystemMap.get(`SYS_CLASS_NAME_${subClassRaw}`)
  result.SubClass = subClassText?.[LANG_COLUMNS[DEFAULT_LANG]] ?? capitalize(subClassRaw)
  result.gift = gift

  // VoiceActor per language: use CVName_{lang} entry, zh falls back to jp entry
  // Core Fusion chars fallback to base character's VA
  const baseCharID = fusionRow?.CharacterID ?? id
  for (const lang of LANGS) {
    const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
    const vaLang = lang === 'zh' ? 'jp' : lang
    const vaEntry = getText(t.textMap, `${id}_CVName_${vaLang}`)
      ?? getText(t.textMap, `${baseCharID}_CVName_${vaLang}`)
    result[`VoiceActor${suffix}`] = formatVA(vaEntry?.[lang] ?? '')
  }

  // Chain type from chain passive skill tooltip (72=Start, 73=Join, 74=Finish)
  const CHAIN_TOOLTIP: Record<string, string> = { '72': 'Start', '73': 'Join', '74': 'Finish' }
  const skillMap = indexBy(t.skillTemplet)
  for (const [key, val] of Object.entries(charRow)) {
    if (key.startsWith('Skill_') && val) {
      const sk = skillMap.get(val)
      if (sk?.SkillType === 'SKT_CHAIN_PASSIVE') {
        const chainLevels = groupBy(t.skillLevelTemplet, 'SkillID').get(val) ?? []
        const chainL1 = chainLevels.find((l) => l.SkillLevel === '1') ?? chainLevels[0]
        const ttIds = (chainL1?.BuffToolTip ?? '').split(',').map((s) => s.trim())
        for (const ttId of ttIds) {
          if (CHAIN_TOOLTIP[ttId]) { result.Chain_Type = CHAIN_TOOLTIP[ttId]; break }
        }
        // Fallback to ChainCombinationTemplet.Sequence
        if (!result.Chain_Type) {
          const CHAIN_SEQ: Record<string, string> = { '0': 'Start', '3': 'Finish' }
          const chainRow = t.chainTemplet.find((r) => r.ID === id)
          if (chainRow) result.Chain_Type = CHAIN_SEQ[chainRow.Sequence] ?? 'Join'
        }
        break
      }
    }
  }

  // Tags: premium, limited, seasonal, collab, core-fusion
  const tags: string[] = []
  const recruitEntries = t.recruitByChar.get(id) ?? []
  const ribbonTypes = new Set(recruitEntries.map((r) => r.RibbonType).filter(Boolean))
  const hasCollabBanner = recruitEntries.some((r) => r.RollingBannerImage?.includes('Collabo'))

  const isCollabExtra = extraRow?.ThumbnailEffect === 'FX_UI_Character_List_Dungeon'

  if (hasCollabBanner || isCollabExtra) {
    tags.push('collab')
  } else if (ribbonTypes.has('PREMIUM')) {
    tags.push('premium')
  } else if (ribbonTypes.has('OUTER_FES')) {
    tags.push('limited')
  } else if (ribbonTypes.has('SEASONAL')) {
    tags.push('seasonal')
  }

  // limited flag: true for limited, seasonal, collab
  if (tags.some((t) => ['limited', 'seasonal', 'collab'].includes(t))) {
    result.limited = true
  }

  // Core Fusion fields
  if (fusionRow) {
    // This IS a core fusion character (2700xxx)
    result.fusionType = 'core-fusion'
    result.originalCharacter = fusionRow.CharacterID
    tags.push('core-fusion')

    // costPerLevel from CharacterFusionLevelTemplet
    const levels = t.fusionLevelTemplet.filter((l) => l.FusionGroupID === fusionRow.FusionGroupID)
      .sort((a, b) => (parseInt(a.FusionLevel) || 0) - (parseInt(b.FusionLevel) || 0))
    const costPerLevel: Record<string, { item: string; nb: number }> = {}
    let totalMaterial = 0
    let materialItemID = ''
    for (const lvl of levels) {
      const nb = parseInt(lvl.RequireItemValue) || 0
      costPerLevel[lvl.FusionLevel] = { item: lvl.RequireItemID, nb }
      totalMaterial += nb
      if (!materialItemID) materialItemID = lvl.RequireItemID
    }
    result.costPerLevel = costPerLevel

    // Resolve material name from ItemTemplet → TextItem
    const itemRow = t.itemTemplet.get(materialItemID)
    const itemName = itemRow?.NameID ? (t.textItem.get(itemRow.NameID)?.[LANG_COLUMNS[DEFAULT_LANG]] ?? materialItemID) : materialItemID

    // Convert internal TransStar to display ShowUIStar
    const baseChar = t.characters.find((c) => c.ID === fusionRow.CharacterID)
    const baseStar = baseChar?.BasicStar ?? '3'
    const transEntry = t.transcendTemplet.find((r) =>
      (r.CharacterID === fusionRow.CharacterID || (r.CharacterID === '0' && r.BasicStar === baseStar))
      && r.TransStar === fusionRow.CharacterTransStar
    )
    const requiredStar = parseInt(transEntry?.ShowUIStar ?? fusionRow.CharacterTransStar) || 0

    result.fusionRequirements = {
      transcendence: requiredStar,
      material: { id: itemName, quantity: totalMaterial },
    }
  } else {
    // Check if this base character HAS a core fusion
    const cfRow = t.fusionByChar.get(id)
    if (cfRow) {
      result.hasCoreFusion = true
      result.coreFusionId = cfRow.ChangeCharID
    }
  }

  // Assign tags
  if (tags.length) result.tags = tags

  // Find unique passive skill ID for transcend descriptions
  let uniquePassiveID: string | null = null
  for (const [key, val] of Object.entries(charRow)) {
    if (key.startsWith('Skill_') && val) {
      const sk = skillMap.get(val)
      if (sk?.SkillType === 'SKT_UNIQUE_PASSIVE') { uniquePassiveID = val; break }
    }
  }

  // Transcend
  result.transcend = extractTranscend(charRow, t.transcendTemplet, uniquePassiveID, t.skillLevelTemplet, t.textSkill)

  // Skills
  result.skills = extractSkills(charRow, t.skillTemplet, t.skillLevelTemplet, t.textSkill, t.buffTemplet, loadTable('BuffToolTipTemplet'), t.textSystemMap)

  return result
}

function listCharacters(tables?: Tables) {
  const t = tables ?? loadAllTables()
  const changedIDs = new Set(t.changeTemplet.map((r) => r.ChangeCharacterID))
  const isCharacterID = (id: string) => /^(200|270)0\d{3}$/.test(id)

  const pcCharacters = t.characters
    .filter((c) => c.Type === 'CT_PC' && isCharacterID(c.ID) && !changedIDs.has(c.ID))
    .map((c) => {
      const nameEntry = t.textMap.get(`${c.ID}_Name`)
      const nickEntry = t.textMap.get(`${c.ID}_NickName`)
      const extraRow = t.extraByChar.get(c.ID)
      const fusionRow = t.fusionByChange.get(c.ID)

      let name = nameEntry?.[LANG_COLUMNS[DEFAULT_LANG]] ?? c.ID
      if (fusionRow?.FusionNameID) {
        const fusionText = t.textSystemMap.get(fusionRow.FusionNameID)
        if (fusionText?.[LANG_COLUMNS[DEFAULT_LANG]]) name = fusionText[LANG_COLUMNS[DEFAULT_LANG]]
      } else if (extraRow?.ShowNickName === 'True' && nickEntry?.[LANG_COLUMNS[DEFAULT_LANG]]) {
        name = `${nickEntry[LANG_COLUMNS[DEFAULT_LANG]]} ${name}`
      }

      return {
        id: c.ID,
        name,
        name_kr: nameEntry?.[LANG_COLUMNS.kr] ?? '',
        element: c.Element?.replace('CET_', '') ?? '',
        class: c.Class?.replace('CCT_', '') ?? '',
        rarity: parseInt(c.BasicStar) || 0,
      }
    })
    .sort((a, b) => parseInt(a.id) - parseInt(b.id))

  return pcCharacters
}

interface DiffEntry {
  key: string
  type: 'changed' | 'missing_existing' | 'missing_extracted' | 'typo'
  extracted: unknown
  existing: unknown
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepDiffs(
  extracted: unknown,
  existing: unknown,
  prefix: string,
  out: DiffEntry[]
) {
  // Both are plain objects → recurse into sub-keys
  if (isPlainObject(extracted) && isPlainObject(existing)) {
    const allKeys = new Set([...Object.keys(extracted), ...Object.keys(existing)])
    for (const k of allKeys) {
      const path = prefix ? `${prefix}.${k}` : k
      const inA = k in extracted
      const inB = k in existing

      if (inA && !inB) {
        out.push({ key: path, type: 'missing_existing', extracted: extracted[k], existing: undefined })
      } else if (!inA && inB) {
        out.push({ key: path, type: 'missing_extracted', extracted: undefined, existing: existing[k] })
      } else {
        deepDiffs(extracted[k], existing[k], path, out)
      }
    }
    return
  }

  // Array comparison: ignore order
  if (Array.isArray(extracted) && Array.isArray(existing)) {
    const sortedA = [...extracted].sort()
    const sortedB = [...existing].sort()
    if (JSON.stringify(sortedA) === JSON.stringify(sortedB)) return
  }

  // Leaf comparison
  if (JSON.stringify(extracted) !== JSON.stringify(existing)) {
    // Detect typo differences (whitespace, Chinese comma variants)
    const normalize = (v: unknown) => JSON.stringify(v)
      .replace(/\s+/g, '')
      .replace(/[，,]/g, ',')
      .replace(/[：:]/g, ':')
      .replace(/[（(]/g, '(')
      .replace(/[）)]/g, ')')
      .replace(/[！!]/g, '!')
      .replace(/[\u2018\u2019']/g, "'")
      .replace(/[\u3001\uFF64]/g, '\u3001')
      .replace(/[\u3002\uFF61]/g, '\u3002')
      .replace(/[~\uFF5E]/g, '~')
      .replace(/\.\.\./g, '\u2026').replace(/\u2026/g, '...')
      .replace(/[？?]/g, '?')
      .replace(/[％%]/g, '%')
      .replace(/[；;]/g, ';')
      .replace(/[＋+]/g, '+')
    const type = normalize(extracted) === normalize(existing) ? 'typo' as const : 'changed' as const
    out.push({ key: prefix, type, extracted, existing })
  }
}

// Fields that are manually edited, not extracted from game data
const MANUAL_FIELDS = new Set(['rank', 'rank_pvp', 'role', 'skill_priority', 'video', 'rank_by_transcend', 'role_by_transcend'])

function buildDiffs(
  extracted: Record<string, unknown>,
  existing: Record<string, unknown> | null
): DiffEntry[] {
  if (!existing) return []
  const diffs: DiffEntry[] = []
  deepDiffs(extracted, existing, '', diffs)
  return diffs.filter((d) => !MANUAL_FIELDS.has(d.key))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case 'list':
      return NextResponse.json(listCharacters())

    case 'compare': {
      const tables = loadAllTables()
      const list = listCharacters(tables)
      const charDir = path.join(process.cwd(), 'data', 'character')
      const results = list.map((c: { id: string; name: string; name_kr: string; element: string; class: string; rarity: number }) => {
        const existingPath = path.join(charDir, `${c.id}.json`)
        const exists = fs.existsSync(existingPath)
        let status: 'new' | 'ok' | 'diff' | 'typo' = 'new'
        let diffCount = 0
        let typoCount = 0

        if (exists) {
          const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'))
          const extracted = extractCharacter(c.id, tables)
          if (!extracted) { return { ...c, status, diffCount, typoCount } }

          // Merge manual tag 'free' from existing
          if (existing?.tags?.includes('free')) {
            const tags = (extracted.tags as string[]) ?? []
            if (!tags.includes('free')) extracted.tags = [...tags, 'free']
          }

          const deepResult = buildDiffs(extracted, existing)
          typoCount = deepResult.filter((d) => d.type === 'typo').length
          diffCount = deepResult.length - typoCount
          status = diffCount > 0 ? 'diff' : typoCount > 0 ? 'typo' : 'ok'
        }

        return { ...c, status, diffCount, typoCount }
      })

      type Result = { status: string; diffCount: number; typoCount: number }
      const total = results.length
      const ok = results.filter((r: Result) => r.status === 'ok').length
      const diff = results.filter((r: Result) => r.diffCount > 0).length
      const typo = results.filter((r: Result) => r.typoCount > 0).length
      const newCount = results.filter((r: Result) => r.status === 'new').length

      return NextResponse.json({ total, ok, diff, typo, new: newCount, characters: results })
    }

    case 'extract': {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const extracted = extractCharacter(id)
      if (!extracted) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

      const charDir = path.join(process.cwd(), 'data', 'character')
      const existingPath = path.join(charDir, `${id}.json`)
      const existing = fs.existsSync(existingPath)
        ? JSON.parse(fs.readFileSync(existingPath, 'utf-8'))
        : null

      // Merge manual tag 'free' from existing into extracted tags
      if (existing?.tags?.includes('free')) {
        const tags = (extracted.tags as string[]) ?? []
        if (!tags.includes('free')) extracted.tags = [...tags, 'free']
      }

      const diffs = buildDiffs(extracted, existing)

      // Manual fields from existing file (if any)
      const manual: Record<string, unknown> = {}
      if (existing) {
        for (const key of MANUAL_FIELDS) {
          if (key in existing) manual[key] = existing[key]
        }
        // Include tags so UI can read the free checkbox state
        if (existing.tags) manual.tags = existing.tags
      }

      return NextResponse.json({ extracted, existing, diffs, manual })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

// Key order for output JSON
const KEY_ORDER = [
  'ID',
  'Fullname', 'Fullname_jp', 'Fullname_kr', 'Fullname_zh',
  'Rarity', 'Element', 'Class', 'SubClass',
  'rank', 'rank_pvp', 'role',
  'limited', 'rank_by_transcend', 'role_by_transcend', 'tags',
  'skill_priority',
  'Chain_Type', 'gift', 'video',
  'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
  'hasCoreFusion', 'coreFusionId',
  'fusionType', 'originalCharacter', 'fusionRequirements', 'costPerLevel',
  'transcend', 'skills',
]

// Sort localized sub-keys: all EN first, then _jp, _kr, _zh
function orderLocalizedKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj)
  const langOrder = ['', '_jp', '_kr', '_zh']
  keys.sort((a, b) => {
    const aSuffix = langOrder.find((s) => s && a.endsWith(s)) ?? ''
    const bSuffix = langOrder.find((s) => s && b.endsWith(s)) ?? ''
    const aBase = aSuffix ? a.slice(0, -aSuffix.length) : a
    const bBase = bSuffix ? b.slice(0, -bSuffix.length) : b
    const langDiff = langOrder.indexOf(aSuffix) - langOrder.indexOf(bSuffix)
    if (langDiff !== 0) return langDiff
    return aBase.localeCompare(bBase, undefined, { numeric: true })
  })
  const ordered: Record<string, unknown> = {}
  for (const key of keys) ordered[key] = obj[key]
  return ordered
}

const LOCALIZED_FIELDS = new Set(['transcend', 'true_desc_levels', 'enhancement'])

function deepOrderKeys(obj: unknown, fieldName?: string): unknown {
  if (typeof obj === 'string') return obj.trimEnd()
  if (Array.isArray(obj)) return obj.map((v) => deepOrderKeys(v))
  if (typeof obj !== 'object' || obj === null) return obj
  const record = obj as Record<string, unknown>

  // Apply localized ordering to specific fields
  const ordered = (fieldName && LOCALIZED_FIELDS.has(fieldName))
    ? orderLocalizedKeys(record)
    : record

  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ordered)) {
    result[k] = deepOrderKeys(v, k)
  }
  return result
}

function orderKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {}
  // First add keys in defined order
  for (const key of KEY_ORDER) {
    if (key in obj && obj[key] !== undefined) ordered[key] = deepOrderKeys(obj[key], key)
  }
  // Then add any remaining keys not in the order list
  for (const key of Object.keys(obj)) {
    if (!(key in ordered) && obj[key] !== undefined) ordered[key] = deepOrderKeys(obj[key], key)
  }
  return ordered
}

export async function POST(request: NextRequest) {
  const { id, manual } = await request.json() as {
    id: string
    manual: Record<string, unknown>
  }

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const extracted = extractCharacter(id)
  if (!extracted) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  // Merge manual tag 'free' into extracted tags
  const manualTags = (manual.tags as string[]) ?? []
  if (manualTags.includes('free')) {
    const tags = (extracted.tags as string[]) ?? []
    if (!tags.includes('free')) extracted.tags = [...tags, 'free']
  }

  // Merge manual fields into extracted
  for (const key of MANUAL_FIELDS) {
    if (manual[key] !== undefined) {
      extracted[key] = manual[key]
    }
  }

  // Order keys for output
  const ordered = orderKeys(extracted)

  // Write file
  const charDir = path.join(process.cwd(), 'data', 'character')
  if (!fs.existsSync(charDir)) fs.mkdirSync(charDir, { recursive: true })
  const filePath = path.join(charDir, `${id}.json`)
  fs.writeFileSync(filePath, JSON.stringify(ordered, null, 2) + '\n', 'utf-8')

  return NextResponse.json({ ok: true, id })
}
