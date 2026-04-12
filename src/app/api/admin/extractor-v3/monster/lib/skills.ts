import { loadTable, indexBy, getLangTexts, expandLang, num, type Row } from './common'
import type { Lang } from '@/lib/i18n/config'
import {
  classifyEffects,
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
    // BuffID lookups are case-insensitive: some placeholders use
    // mixed case (e.g. `Irregular_Check_Queen_1`) while BuffTemplet
    // stores the same key fully lowercased.
    let buff = buffsByBuffID.get(bid)
    if (!buff) buff = buffsByBuffID.get(bid.toLowerCase())
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
  /**
   * Optional human-readable scope. Forwarded to the classifier so a
   * forced-override can be keyed by `<monsterName>|<dungeonName>`
   * (single floor) or `<monsterName>|<modeName>` (whole game mode).
   */
  ownerName?: string
  dungeonName?: string
  modeName?: string
}

export function extractSkill(
  skillId: string,
  ctx: MonsterSkillContext,
  t?: SkillTables
): MonsterSkill | null {
  const tables = t ?? loadSkillTables()
  const row = tables.skillIndex.get(skillId)
  if (!row) return null
  // Always skip SKT_BACKUP_AERIAL/GROUND — these are character sub-skills
  // inherited by character-flavored boss fights and should never appear
  // in the wiki (even when they carry a valid NameID/DescID).
  const skillType = row.SkillType ?? ''
  if (skillType.startsWith('SKT_BACKUP_')) return null
  // Skip placeholder slots with no NameID (empty skill entry).
  // SKT_RAGE_FINISH rows are an exception: they also have no NameID but
  // carry real buffs that must flow into their sibling SKT_RAGE_ENTER
  // via mergeRageFinish().
  const isRageFinish = skillType.startsWith('SKT_RAGE_FINISH')
  if (!row.NameID && !isRageFinish) return null

  // Skip skills whose DescID is missing or a placeholder whitespace
  // string — the game never wired a real description for them and the
  // wiki doesn't want to carry an empty skill entry. RAGE_FINISH is
  // exempt because it is always merged into RAGE_ENTER.
  // DescID may be a CSV of per-level ids (`..._LV1,..._LV2,..._LV3,...`).
  // Walk it from highest to lowest level and pick the first id that
  // actually resolves to a TextSkill row — the CSV often references
  // non-existent `_LVn` entries as padding.
  const descIdRaw = (row.DescID ?? '').trim()
  const descIdList = descIdRaw ? descIdRaw.split(',').map((s) => s.trim()).filter(Boolean) : []
  let descIdPicked = ''
  let descRow: Row | undefined
  for (const id of descIdList) {
    const found = tables.textSkillIndex.get(id)
    if (!found) continue
    // Require the English text to be non-empty — some `_LVn` entries
    // exist in TextSkill but carry blank strings.
    const en = (found.English ?? '').trim()
    if (!en) continue
    descIdPicked = id
    descRow = found
    break
  }
  if (!descIdPicked && !isRageFinish) return null

  const level = tables.skillLevelByID.get(skillId)

  const nameTexts = getLangTexts(tables.textSkillIndex.get(row.NameID ?? ''))
  const descTextsRaw = getLangTexts(descRow)

  // Resolve [Buff_*] placeholders for each language.
  const descTexts = descTextsRaw
    ? (Object.fromEntries(
        Object.entries(descTextsRaw).map(([lang, txt]) => [
          lang,
          resolveSkillDescription(txt, tables.buffsByBuffID),
        ])
      ) as Record<Lang, string>)
    : null

  // Monster skills use the declared BuffIDs only — unlike characters we
  // do NOT expand by `${ownerId}_${slot}_` prefix. Implicit rows often
  // represent debug/internal buffs that are never mentioned in the skill
  // description and would pollute the wiki.
  const buffIdSet = (level?.BuffID ?? '').split(',').map((s) => s.trim()).filter(Boolean)

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
    ownerName: ctx.ownerName,
    dungeonName: ctx.dungeonName,
    modeName: ctx.modeName,
    skillType: row.SkillType ?? '',
    tables: tables.effectTables,
    tooltipIds,
    description: descTexts?.en ?? '',
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

// ── Rage enter/finish merge ─────────────────────────────────────────
//
// Boss rage mechanics are split across two skill slots:
//   SKT_RAGE_ENTER<N>  — the entry animation, carries the description
//   SKT_RAGE_FINISH<N> — the finish state, usually has an empty description
//                        but contains passive buffs (e.g. BT_RESURRECTION)
//
// The wiki shows both as a single entry, so we merge FINISH → ENTER
// (buff/debuff union, then drop the FINISH row). If the FINISH has its
// own non-empty description, it's a standalone skill and we keep it.

function rageFinishToEnterType(finishType: string): string | null {
  const m = /^SKT_RAGE_FINISH(\d+)$/.exec(finishType)
  return m ? `SKT_RAGE_ENTER${m[1]}` : null
}

function mergeRageFinish(skills: MonsterSkill[]): MonsterSkill[] {
  const toDrop = new Set<number>()
  for (let i = 0; i < skills.length; i++) {
    const finish = skills[i]
    const finishType = String(finish.type ?? '')
    const enterType = rageFinishToEnterType(finishType)
    if (!enterType) continue
    // If a matching SKT_RAGE_ENTER<N> exists, always merge the FINISH
    // into it — the wiki never shows FINISH as a standalone skill even
    // when the game data gives it its own name/description.
    const enterIdx = skills.findIndex((s) => s.type === enterType)
    if (enterIdx < 0) continue
    const enter = skills[enterIdx]
    const mergeList = (key: 'buff' | 'debuff' | 'removeBuff' | 'removeDebuff') => {
      const e = (enter[key] as string[] | undefined) ?? []
      const f = (finish[key] as string[] | undefined) ?? []
      const merged: string[] = [...e]
      for (const x of f) if (!merged.includes(x)) merged.push(x)
      enter[key] = merged
    }
    mergeList('buff')
    mergeList('debuff')
    mergeList('removeBuff')
    mergeList('removeDebuff')
    toDrop.add(i)
  }
  if (toDrop.size === 0) return skills
  return skills.filter((_, i) => !toDrop.has(i))
}

/** Resolve a list of skill slot/id pairs (typically from MonsterBase.skillIds). */
export function extractMonsterSkills(
  skillIds: { slot: number; id: string }[],
  ownerId: string,
  t?: SkillTables,
  scope?: { ownerName?: string; dungeonName?: string; modeName?: string }
): MonsterSkill[] {
  const tables = t ?? loadSkillTables()
  const out: MonsterSkill[] = []
  for (const { slot, id } of skillIds) {
    const s = extractSkill(
      id,
      {
        ownerId,
        slot,
        ownerName: scope?.ownerName,
        dungeonName: scope?.dungeonName,
        modeName: scope?.modeName,
      },
      tables,
    )
    if (s) out.push(s)
  }
  return mergeRageFinish(out)
}
