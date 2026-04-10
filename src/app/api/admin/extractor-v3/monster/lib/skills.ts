import { loadTable, indexBy, getLangTexts, expandLang, num, type Row } from './common'
import type { Lang } from '@/lib/i18n/config'
import {
  classifyEffects,
  expandImplicitBuffIds,
  buildTooltipMap,
  type EffectTables,
} from '../../_shared/effects'

// ── Output type ─────────────────────────────────────────────────────
//
// A skill is exposed as a flat record so it round-trips cleanly to JSON.
// Localized fields are expanded into Name / Name_jp / ... / Description / ...

export type MonsterSkill = Record<string, unknown>

// ── Loaders / indexes ───────────────────────────────────────────────

export type SkillTables = {
  skillIndex: Map<string, Row>
  skillLevelByID: Map<string, Row>
  textSkillIndex: Map<string, Row>
  /** First BuffTemplet row per BuffID (level 1), for placeholder resolution. */
  buffsByBuffID: Map<string, Row>
  /**
   * All BuffTemplet level 1 rows per BuffID. Reused as-is by the shared
   * classifier via `effectTables.buffsByID`.
   */
  buffRowsByBuffID: Map<string, Row[]>
  /** Shared-classifier-compatible bundle. */
  effectTables: EffectTables
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

  // Build tooltip map for the shared classifier's discovery pass.
  const textSystemIndex = indexBy(loadTable('TextSystem'))
  const tooltipMap = buildTooltipMap(loadTable('BuffToolTipTemplet'), textSystemIndex)

  cached = {
    skillIndex,
    skillLevelByID,
    textSkillIndex: indexBy(loadTable('TextSkill')),
    buffsByBuffID,
    buffRowsByBuffID,
    effectTables: { buffsByID: buffRowsByBuffID, tooltipMap },
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

// ── Extraction ──────────────────────────────────────────────────────

export type MonsterSkillContext = {
  /** Monster ID — used as ownerId for forced overrides and implicit scans. */
  ownerId: string
  /** Skill slot (1..18) from Skill_N — used to build `${ownerId}_${slot}_` prefix. */
  slot: number
}

export function extractSkill(
  skillId: string,
  ctx: MonsterSkillContext,
  t?: SkillTables
): MonsterSkill | null {
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

  // Declared BuffIDs + implicit scan via `${ownerId}_${slot}_` prefix.
  const declared = (level?.BuffID ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const buffIdSet = expandImplicitBuffIds(
    declared,
    [`${ctx.ownerId}_${ctx.slot}_`],
    tables.buffRowsByBuffID
  )

  // `MonsterSkillLevelTemplet` has no per-skill BuffToolTip CSV like
  // `CharacterSkillLevelTemplet` does, so we synthesize one by collecting
  // row-level ToolTipIDs from every BuffTemplet row that matches the
  // resolved buff-ID set. This lets the shared classifier's tooltip
  // discovery surface variant labels like "Corrosive Poison" even when
  // the row's IconName doesn't contain "Interruption".
  const explicitTooltipIds = (level?.BuffToolTip ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const rowTooltipIds = new Set<string>(explicitTooltipIds)
  for (const bid of buffIdSet) {
    for (const row of tables.buffRowsByBuffID.get(bid) ?? []) {
      if (row.ToolTipID && (row.IconName ?? '').includes('Interruption') === false) {
        rowTooltipIds.add(row.ToolTipID)
      }
    }
  }
  const tooltipIds = [...rowTooltipIds]
  const { buffs: buff, debuffs: debuff, removeBuff, removeDebuff } = classifyEffects(buffIdSet, {
    ownerId: ctx.ownerId,
    skillType: row.SkillType ?? '',
    tables: tables.effectTables,
    tooltipIds,
  })

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
    removeBuff,
    removeDebuff,
  } as MonsterSkill
  Object.assign(out, expandLang('Name', nameTexts))
  Object.assign(out, expandLang('Description', descTexts))
  return out
}

/** Resolve a list of skill slot/id pairs (typically from MonsterBase.skillIds). */
export function extractMonsterSkills(
  skillIds: { slot: number; id: string }[],
  ownerId: string,
  t?: SkillTables
): MonsterSkill[] {
  const tables = t ?? loadSkillTables()
  const out: MonsterSkill[] = []
  for (const { slot, id } of skillIds) {
    const s = extractSkill(id, { ownerId, slot }, tables)
    if (s) out.push(s)
  }
  return out
}
