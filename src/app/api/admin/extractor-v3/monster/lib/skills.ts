import { loadTable, indexBy, getLangTexts, expandLang, num, type Row } from './common'
import type { Lang } from '@/lib/i18n/config'

// ── Output type ─────────────────────────────────────────────────────
//
// A skill is exposed as a flat record so it round-trips cleanly to JSON.
// Localized fields are expanded into Name / Name_jp / ... / Description / ...

export type MonsterSkill = Record<string, unknown>

// ── Loaders / indexes ───────────────────────────────────────────────

export type SkillTables = {
  skillIndex: Map<string, Row> // MonsterSkillTemplet by ID
  skillLevelByID: Map<string, Row> // MonsterSkillLevelTemplet, level 1, keyed by SkillID
  textSkillIndex: Map<string, Row>
  buffsByBuffID: Map<string, Row> // BuffTemplet level 1, keyed by BuffID
  buffRowsByBuffID: Map<string, Row[]> // BuffTemplet level 1, all rows per BuffID
}

let cached: SkillTables | null = null

export function loadSkillTables(): SkillTables {
  if (cached) return cached

  const skillIndex = indexBy(loadTable('MonsterSkillTemplet'))

  // Monster skills only have level 1 (verified: 3870/3870 entries are level 1).
  const skillLevelByID = new Map<string, Row>()
  for (const r of loadTable('MonsterSkillLevelTemplet')) {
    if (!r.SkillID) continue
    if (r.SkillLevel === '1' || !skillLevelByID.has(r.SkillID)) {
      skillLevelByID.set(r.SkillID, r)
    }
  }

  // Index BuffTemplet by BuffID for level 1. Multiple rows may share a BuffID
  // at level 1 (variants) — keep all for buff/debuff classification, plus a
  // "first wins" map for placeholder resolution.
  const buffsByBuffID = new Map<string, Row>()
  const buffRowsByBuffID = new Map<string, Row[]>()
  for (const r of loadTable('BuffTemplet')) {
    if (!r.BuffID || r.Level !== '1') continue
    if (!buffsByBuffID.has(r.BuffID)) buffsByBuffID.set(r.BuffID, r)
    let arr = buffRowsByBuffID.get(r.BuffID)
    if (!arr) {
      arr = []
      buffRowsByBuffID.set(r.BuffID, arr)
    }
    arr.push(r)
  }

  cached = {
    skillIndex,
    skillLevelByID,
    textSkillIndex: indexBy(loadTable('TextSkill')),
    buffsByBuffID,
    buffRowsByBuffID,
  }
  return cached
}

// ── Placeholder resolution ──────────────────────────────────────────
//
// Skill descriptions contain placeholders like:
//   [Buff_C_common_monster_buff_32]   → CreateRate
//   [Buff_T_4034001_4_3]              → TurnDuration
//   [Buff_V_monad_gate_monster_4]     → Value
//
// The buff id segment may contain underscores; the regex captures
// everything up to the closing bracket.

function isPermille(buff: Row): boolean {
  if (buff.ApplyingType === 'OAT_RATE') return true
  const st = buff.StatType ?? ''
  if (st.includes('_RATE') || st.includes('_DMG')) return true
  const t = buff.Type ?? ''
  if (t === 'BT_ADDITIVE_TURN' || t.includes('_ENHANCE')) return true
  return false
}

function fmtValue(buff: Row): string {
  const v = parseInt(buff.Value ?? '0', 10)
  if (!Number.isFinite(v)) return '?'
  return isPermille(buff) ? `${Math.abs(v) / 10}%` : String(Math.abs(v))
}

function fmtCreateRate(buff: Row): string {
  if (!buff.CreateRate) return '?'
  const v = parseInt(buff.CreateRate, 10)
  return Number.isFinite(v) ? `${v / 10}%` : '?'
}

function fmtTurn(buff: Row): string {
  return /^\d+$/.test(buff.TurnDuration ?? '') ? buff.TurnDuration! : '?'
}

const PLACEHOLDER_RE = /\[Buff_([CVT])_([^\]]+)\]/g

export function resolveSkillDescription(text: string, buffsByBuffID: Map<string, Row>): string {
  return text.replace(PLACEHOLDER_RE, (match, kind: string, bid: string) => {
    const buff = buffsByBuffID.get(bid)
    if (!buff) return match
    switch (kind) {
      case 'C':
        return fmtCreateRate(buff)
      case 'T':
        return fmtTurn(buff)
      case 'V':
        return fmtValue(buff)
      default:
        return match
    }
  })
}

// ── Buff classification ─────────────────────────────────────────────
//
// Each buff/debuff is encoded as either `Type` (e.g. "BT_FREEZE") or
// `Type|StatType` (e.g. "BT_STAT|ST_SPEED") for stat-affecting buffs.
// When `IsIgnoreInterruption === 'True'` (and the row isn't NEUTRAL*),
// an `_IR` suffix is appended to mark the "ignore resist/immune" variant,
// matching the wiki convention used in existing boss files.

function buffSignature(buff: Row): string {
  const t = buff.Type ?? ''
  if (!t || t === 'BT_NONE') return ''
  let sig: string
  if (t === 'BT_STAT' && buff.StatType && buff.StatType !== 'ST_NONE') {
    sig = `${t}|${buff.StatType}`
  } else {
    sig = t
  }
  const bdt = buff.BuffDebuffType ?? ''
  const isNeutral = bdt === 'NEUTRAL' || bdt === 'NEUTRAL2'
  if (!isNeutral && buff.IsIgnoreInterruption === 'True') sig += '_IR'
  return sig
}

// DEBUFF* covers DEBUFF, DEBUFF_IGNORE_RESIST, DEBUFF_IGNORE_IMMUNE,
// DEBUFF_IGNORE_ALL. NEUTRAL/NEUTRAL2 fall back on TargetType — anything
// targeting enemies is a debuff, anything targeting self/ally is a buff.
function isDebuffRow(buff: Row): boolean {
  const bdt = buff.BuffDebuffType ?? ''
  if (bdt.startsWith('DEBUFF')) return true
  if (bdt === 'BUFF') return false
  const target = buff.TargetType ?? ''
  return target.startsWith('ENEMY_')
}

function classifyBuffsForSkill(
  buffIdCsv: string | undefined,
  tables: SkillTables
): { buff: string[]; debuff: string[] } {
  const buff: string[] = []
  const debuff: string[] = []
  if (!buffIdCsv) return { buff, debuff }
  const ids = buffIdCsv.split(',').map((s) => s.trim()).filter(Boolean)
  const seenBuff = new Set<string>()
  const seenDebuff = new Set<string>()
  for (const id of ids) {
    const rows = tables.buffRowsByBuffID.get(id)
    if (!rows) continue
    for (const row of rows) {
      const sig = buffSignature(row)
      if (!sig) continue
      if (isDebuffRow(row)) {
        if (!seenDebuff.has(sig)) {
          seenDebuff.add(sig)
          debuff.push(sig)
        }
      } else {
        if (!seenBuff.has(sig)) {
          seenBuff.add(sig)
          buff.push(sig)
        }
      }
    }
  }
  return { buff, debuff }
}

// ── Extraction ──────────────────────────────────────────────────────

export function extractSkill(skillId: string, t?: SkillTables): MonsterSkill | null {
  const tables = t ?? loadSkillTables()
  const row = tables.skillIndex.get(skillId)
  if (!row) return null

  const level = tables.skillLevelByID.get(skillId)

  const nameTexts = getLangTexts(tables.textSkillIndex.get(row.NameID ?? ''))
  const descTextsRaw = getLangTexts(tables.textSkillIndex.get(row.DescID ?? ''))

  // Resolve [Buff_*] placeholders for each language.
  const descTexts = descTextsRaw
    ? (Object.fromEntries(
        Object.entries(descTextsRaw).map(([lang, txt]) => [
          lang,
          resolveSkillDescription(txt, tables.buffsByBuffID),
        ])
      ) as Record<Lang, string>)
    : null

  const { buff, debuff } = classifyBuffsForSkill(level?.BuffID, tables)

  const out: MonsterSkill = {
    id: row.ID,
    type: row.SkillType ?? '',
    subType: row.SkillSubType ?? '',
    iconName: row.IconName ?? null,
    damageFactor: level ? num(level.DamageFactor) : 0,
    cool: level?.Cool ? num(level.Cool) : null,
    startCool: level?.StartCool ? num(level.StartCool) : null,
    wgReduce: level?.WGReduce ? num(level.WGReduce) : null,
    buffToolTip: level?.BuffToolTip ?? null,
    nameId: row.NameID ?? null,
    descId: row.DescID ?? null,
    nameTexts,
    descTexts,
    buff,
    debuff,
  } as MonsterSkill
  Object.assign(out, expandLang('Name', nameTexts))
  Object.assign(out, expandLang('Description', descTexts))
  return out
}

/** Resolve a list of skill IDs (typically from MonsterBase.skillIds). */
export function extractMonsterSkills(skillIds: string[], t?: SkillTables): MonsterSkill[] {
  const tables = t ?? loadSkillTables()
  const out: MonsterSkill[] = []
  for (const id of skillIds) {
    const s = extractSkill(id, tables)
    if (s) out.push(s)
  }
  return out
}
