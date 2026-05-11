import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { GAME_LANGS, DEFAULT_LANG, type GameLang } from '@/lib/i18n/config'
import { buildTooltipMap } from '../_shared/effects/tooltip'
import type { TooltipEntry, EffectTables, BuffRow } from '../_shared/effects/types'
import { classifyEffects } from '../_shared/effects'
import { loadEffectRules } from '../_shared/effects/rules'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')
const EE_PATH = path.join(process.cwd(), 'data', 'equipment', 'ee.json')

const LANG_COLUMNS: Record<GameLang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
}

type Row = Record<string, string>

function loadTable(name: string): Row[] {
  return JSON.parse(fs.readFileSync(path.join(JSON2_DIR, `${name}.json`), 'utf-8'))
}

function indexBy(rows: Row[], key = 'ID', caseInsensitive = false) {
  const map = new Map<string, Row>()
  for (const row of rows) {
    const k = row[key]
    if (k) map.set(caseInsensitive ? k.toUpperCase() : k, row)
  }
  return map
}

function groupBy(rows: Row[], key: string) {
  const map = new Map<string, Row[]>()
  for (const row of rows) {
    const k = row[key]
    if (!k) continue
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(row)
  }
  return map
}

function getText(textMap: Map<string, Row>, id: string): Record<GameLang, string> | null {
  const entry = textMap.get(id) ?? textMap.get(id.toUpperCase())
  if (!entry) return null
  const result = {} as Record<GameLang, string>
  for (const lang of GAME_LANGS) {
    result[lang] = entry[LANG_COLUMNS[lang]] ?? ''
  }
  return result
}

// ── Placeholder resolution ──────────────────────────────────────────

function isPermilleValue(buff: Row): boolean {
  if (buff.ApplyingType === 'OAT_RATE') return true
  const stat = buff.StatType ?? ''
  if (stat.includes('_RATE') || stat.includes('_DMG')) return true
  const type = buff.Type ?? ''
  if (type === 'BT_ADDITIVE_TURN') return true
  if (type.includes('_ENHANCE')) return true
  return false
}

function formatBuffValue(buff: Row): string {
  const rawValue = parseInt(buff.Value ?? '0')
  return isPermilleValue(buff) ? `${Math.abs(rawValue) / 10}%` : String(Math.abs(rawValue))
}

function c(v: string): string {
  return `<color=#28d9ed>${v}</color>`
}

function resolveEEPlaceholders(text: string, buff: Row, buff2?: Row): string {
  const rate = buff.CreateRate ? `${parseInt(buff.CreateRate) / 10}%` : '?'
  const value = formatBuffValue(buff)
  const turn = /^\d+$/.test(buff.TurnDuration ?? '') ? buff.TurnDuration! : '?'
  const value2 = buff2 ? formatBuffValue(buff2) : '?'

  return text
    .replace(/\[\+Value2\]/gi, c(`+${value2}`))
    .replace(/\[-Value2\]/gi, c(`-${value2}`))
    .replace(/\[Value2\]/gi, c(value2))
    .replace(/\[Rate\]/gi, c(rate))
    .replace(/\[\+Value\]/gi, c(`+${value}`))
    .replace(/\[-Value\]/gi, c(`-${value}`))
    .replace(/\[Value\]/gi, c(value))
    .replace(/\[\+Turn\]/gi, c(turn))
    .replace(/\[-Turn\]/gi, c(`-${turn}`))
    .replace(/\[Turn\]/gi, c(turn))
}

// ── Buff finding helpers ────────────────────────────────────────────

function findEEBuff(buffsByID: Map<string, Row[]>, id: string, suffix = ''): Row | undefined {
  return (buffsByID.get(`BID_CEQUIP_${id}${suffix}`) ?? buffsByID.get(`BID_CEQUIP_${id}_1${suffix}`))?.[0]
}

function findEEBuff2(buffsByID: Map<string, Row[]>, id: string, suffix = ''): Row | undefined {
  return buffsByID.get(`BID_CEQUIP_${id}_2${suffix}`)?.[0]
}

function findEEUpgradeBuff(buffsByID: Map<string, Row[]>, id: string): Row | undefined {
  return findEEBuff(buffsByID, id, '_CHANGE')
    ?? buffsByID.get(`BID_CEQUIP_${id}_ADD`)?.[0]
}

function findEEUpgradeBuff2(buffsByID: Map<string, Row[]>, id: string): Row | undefined {
  return findEEBuff2(buffsByID, id, '_CHANGE')
    ?? buffsByID.get(`BID_CEQUIP_${id}_2_ADD`)?.[0]
}

// ── Buff/debuff extraction ──────────────────────────────────────────

const EE_BUFF_BLACKLIST = new Set([
  'BT_DMG', 'BT_DMG_TO_BOSS', 'BT_DMG_CASTER_STAT', 'BT_DMG_CASTER_LOST_HP_RATE',
  'BT_DMG_OWNER_STAT', 'BT_DMG_TARGET_STAT', 'BT_DMG_ENEMY_TEAM_DECREASE', 'BT_DMG_REDUCE',
  'BT_DMG_REDUCE_FINAL', 'BT_STAT_PREMIUM', 'BT_STAT_OWNER_LOST_HP_RATE',
  'BT_GROUP', 'BT_RESOURCE_CHARGE_BUFF_CASTER', 'BT_WG_DMG',
  'BT_HEAL_BASED_CASTER', 'BT_HEAL_BASED_TARGET', 'BT_SHIELD_BASED_TARGET',
  'BT_REVIVAL', 'BT_NONE', 'BT_SECOND_TRIGGER',
])

const EE_OVERRIDES: Record<string, { buff?: string[]; debuff?: string[] }> = {
  '2000047': { buff: ['BT_SHIELD_BASED_CASTER'] },
  '2000060': { buff: ['BT_AP_CHARGE'] },
  '2000083': { buff: ['BT_AP_CHARGE'] },
  '2000093': { buff: ['BT_AP_CHARGE'] },
}

function extractEEBuffDebuff(
  buffTemplet: Row[],
  id: string,
  tooltipMap?: Map<string, TooltipEntry>,
): { buff: string[]; debuff: string[] } {
  // Collect every BuffTemplet row whose BuffID belongs to this EE. The
  // shared classifier expects an `EffectTables.buffsByID` map keyed by
  // BuffID, so we build a one-off table from the subset.
  const prefix = `BID_CEQUIP_${id}`
  const relevant = buffTemplet.filter((r) => r.BuffID?.startsWith(prefix) && !r.BuffID.includes('old'))
  const buffIds = Array.from(new Set(relevant.map((r) => r.BuffID!)))
  const eeBuffsByID = new Map<string, Row[]>()
  for (const r of relevant) {
    const k = r.BuffID!
    let arr = eeBuffsByID.get(k)
    if (!arr) {
      arr = []
      eeBuffsByID.set(k, arr)
    }
    arr.push(r)
  }

  const tables: EffectTables = {
    buffsByID: eeBuffsByID as Map<string, BuffRow[]>,
    tooltipMap: tooltipMap ?? new Map(),
  }

  // EE-specific row filter: drop blacklisted types, _ENHANCE modifiers,
  // BT_DMG_* rows, the always-on ST_ACCURACY passive, and permanent /
  // on-skill-finish / passive-create BT_STAT rows. Matches the
  // exclusions the old hand-rolled extractor enforced.
  const rowFilter = (row: BuffRow): boolean => {
    const type = row.Type ?? ''
    const stat = row.StatType ?? ''
    if (EE_BUFF_BLACKLIST.has(type)) return false
    if (type === 'BT_STAT' && stat === 'ST_ACCURACY') return false
    if (type.includes('_ENHANCE')) return false
    if (type.startsWith('BT_DMG_')) return false
    if (
      type === 'BT_STAT' &&
      (row.TurnDuration === '-1' ||
        row.BuffRemoveType === 'ON_SKILL_FINISH' ||
        row.BuffCreateType === 'PASSIVE')
    ) {
      return false
    }
    // Force known EE debuff types onto the debuff side via `extraDebuffs`
    // is handled outside the filter; here we just keep the row alive.
    return true
  }

  // Tooltip discovery: the classifier's main `buffTypeLabel` only
  // consults a row's `ToolTipID` when the icon contains "Interruption".
  // EE variant DOTs (e.g. `IG_Buff_Dot_Poison02` → CORROSIVE_POISON)
  // surface their tooltip name through the separate `tooltipIds`
  // discovery path — collect every non-interruption row tooltip so the
  // shared classifier can turn them into wiki-ready labels.
  const tooltipIds = new Set<string>()
  for (const r of relevant) {
    if (!rowFilter(r as BuffRow)) continue
    const tt = r.ToolTipID
    if (!tt) continue
    if ((r.IconName ?? '').includes('Interruption')) continue
    tooltipIds.add(tt)
  }

  const { buffs, debuffs } = classifyEffects(buffIds, {
    ownerId: id,
    skillType: 'EE',
    tables,
    rowFilter,
    tooltipIds: [...tooltipIds],
    // Every EE row is hand-curated by the game; labels that the
    // skill-level blacklist suppresses as noise (e.g. `BT_SEAL_COUNTER`,
    // `BT_BURN_ENHANCE`) are in fact the real effects we want to surface.
    skipLabelBlacklist: true,
  })

  const buffOut = new Set(buffs)
  const debuffOut = new Set(debuffs)

  // Legacy hardcoded overrides.
  const legacy = EE_OVERRIDES[id]
  if (legacy) {
    if (legacy.buff) legacy.buff.forEach((b) => buffOut.add(b))
    if (legacy.debuff) legacy.debuff.forEach((d) => debuffOut.add(d))
  }

  // JSON-curated override: look up `ee:<id>` in the shared
  // `forced-overrides.json`. The inner `'*'` entry carries the usual
  // ForcedOverride shape (buff / debuff / removeBuff / removeDebuff /
  // clear_buff / clear_debuff).
  const rules = loadEffectRules()
  const eeOverride = rules.forcedOverrides[`ee:${id}`]?.['*']
  if (eeOverride) {
    if (eeOverride.clearBuff) buffOut.clear()
    if (eeOverride.clearDebuff) debuffOut.clear()
    for (const b of eeOverride.buff ?? []) buffOut.add(b)
    for (const d of eeOverride.debuff ?? []) debuffOut.add(d)
    for (const b of eeOverride.removeBuff ?? []) buffOut.delete(b)
    for (const d of eeOverride.removeDebuff ?? []) debuffOut.delete(d)
  }

  return { buff: [...buffOut], debuff: [...debuffOut] }
}

// ── MainStat extraction ─────────────────────────────────────────────

const OPPOSITE_ELEMENT: Record<string, string> = {
  EARTH: 'WATER', WATER: 'FIRE', FIRE: 'EARTH', LIGHT: 'DARK', DARK: 'LIGHT',
}

function extractMainStat(
  itemOptionByGroup: Map<string, Row[]>,
  buffsByID: Map<string, Row[]>,
  characters: Map<string, Row>,
  itemTempletMap: Map<string, Row>,
  textSystemMap: Map<string, Row>,
  id: string,
): Record<string, string> {
  // Get EE item to find MainOptionGroupID
  const item = itemTempletMap.get(id)
  if (!item?.MainOptionGroupID) return {}

  // Get character element for opposite element
  const charId = item.CharacterLimit ?? id
  const char = characters.get(charId)
  if (!char) return {}
  const raw = (char.Element ?? '').replace('CET_', '').replace('CCT_', '')
  const enemyElem = OPPOSITE_ELEMENT[raw]
  if (!enemyElem) return {}

  // Find ItemOptionTemplet rows via GroupID
  const optRows = itemOptionByGroup.get(item.MainOptionGroupID) ?? []

  // Get BuffIDs from option rows
  for (const r of optRows) {
    const bid = r.BuffID ?? ''
    if (!bid) continue

    const entries = buffsByID.get(bid)
    if (!entries) continue
    for (const br of entries) {
      const t = br.Type ?? ''
      const st = br.StatType ?? ''
      const tt = br.TargetType ?? ''

      let base: string
      if (t.startsWith('BT_DMG')) base = `SYS_${t}_`
      else if (st.startsWith('ST_')) base = `SYS_STAT_${st.slice(3)}_`
      else continue

      let middle: string
      if (tt === 'ME') middle = 'TARGET_'
      else if (tt === 'ENEMY_TEAM') middle = 'OWNER_'
      else continue

      const sysKey = `${base}${middle}${enemyElem}`
      const texts = textSystemMap.get(sysKey)
      if (texts) {
        const result: Record<string, string> = {}
        for (const lang of GAME_LANGS) {
          const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
          result[`mainStat${suffix}`] = (texts[LANG_COLUMNS[lang]] ?? '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
        }
        return result
      }
    }
  }

  return {}
}

// ── Deep diff (same approach as character extractor) ────────────────

interface DiffEntry {
  key: string
  type: 'changed' | 'typo'
  extracted: unknown
  existing: unknown
}

function deepDiffs(
  extracted: Record<string, unknown>,
  existing: Record<string, unknown>,
  prefix: string,
  out: DiffEntry[]
) {
  const normalize = (v: unknown) => JSON.stringify(v)
    .replace(/\s+/g, '')
    .replace(/[，,]/g, ',')
    .replace(/[：:]/g, ':')
    .replace(/[（(]/g, '(')
    .replace(/[）)]/g, ')')
    .replace(/[！!]/g, '!')
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/[~\uFF5E]/g, '~')
    .replace(/\.\.\./g, '\u2026').replace(/\u2026/g, '...')
    .replace(/[？?]/g, '?')
    .replace(/[％%]/g, '%')
    .replace(/[；;]/g, ';')
    .replace(/[＋+]/g, '+')

  for (const key of Object.keys(extracted)) {
    const ext = extracted[key]
    const cur = existing[key]
    if (cur === undefined) continue

    if (typeof ext === 'object' && ext !== null && !Array.isArray(ext) &&
        typeof cur === 'object' && cur !== null && !Array.isArray(cur)) {
      deepDiffs(ext as Record<string, unknown>, cur as Record<string, unknown>, prefix ? `${prefix}.${key}` : key, out)
      continue
    }

    const extStr = JSON.stringify(ext)
    const curStr = JSON.stringify(cur)
    if (extStr === curStr) continue

    const type = normalize(ext) === normalize(cur) ? 'typo' as const : 'changed' as const
    out.push({ key: prefix ? `${prefix}.${key}` : key, type, extracted: ext, existing: cur })
  }
}

// Manual fields not extracted
const MANUAL_FIELDS = new Set(['rank', 'rank10'])

function buildDiffs(extracted: Record<string, unknown>, existing: Record<string, unknown> | null): DiffEntry[] {
  if (!existing) return []
  const diffs: DiffEntry[] = []
  deepDiffs(extracted, existing, '', diffs)
  return diffs.filter((d) => !MANUAL_FIELDS.has(d.key))
}

// ── Key ordering ────────────────────────────────────────────────────

const EE_KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'mainStat', 'mainStat_jp', 'mainStat_kr', 'mainStat_zh',
  'effect', 'effect_jp', 'effect_kr', 'effect_zh',
  'effect10', 'effect10_jp', 'effect10_kr', 'effect10_zh',
  'icon_effect',
  'buff', 'debuff',
  'rank', 'rank10',
]

function orderKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {}
  for (const key of EE_KEY_ORDER) {
    if (key in obj) ordered[key] = obj[key]
  }
  for (const key of Object.keys(obj)) {
    if (!(key in ordered)) ordered[key] = obj[key]
  }
  return ordered
}

// ── Load all tables once ────────────────────────────────────────────

interface Tables {
  itemTemplet: Row[]
  itemTempletMap: Map<string, Row>
  textItem: Map<string, Row>
  textSkill: Map<string, Row>
  textSystemMap: Map<string, Row>
  buffTemplet: Row[]
  buffsByID: Map<string, Row[]>
  tooltipMap: Map<string, TooltipEntry>
  itemOptionByGroup: Map<string, Row[]>
  characters: Map<string, Row>
}

function loadAllTables(): Tables {
  const itemTemplet = loadTable('ItemTemplet')
  const itemTempletMap = indexBy(itemTemplet)
  const textItem = indexBy(loadTable('TextItem'), 'ID', true)
  const textSkill = indexBy(loadTable('TextSkill'), 'ID', true)
  const textSystemMap = indexBy(loadTable('TextSystem'))
  const buffTemplet = loadTable('BuffTemplet')
  const buffsByID = groupBy(buffTemplet, 'BuffID')
  const tooltipMap = buildTooltipMap(loadTable('BuffToolTipTemplet'), textSystemMap)
  const itemOptionByGroup = groupBy(loadTable('ItemOptionTemplet'), 'GroupID')
  const characters = indexBy(loadTable('CharacterTemplet'))

  return { itemTemplet, itemTempletMap, textItem, textSkill, textSystemMap, buffTemplet, buffsByID, tooltipMap, itemOptionByGroup, characters }
}

// ── Extract single EE ───────────────────────────────────────────────

function extractEE(id: string, t: Tables): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Name
  const nameTexts = getText(t.textItem, `ITEM_C_EQUIP_${id}_NAME`)
  for (const lang of GAME_LANGS) {
    const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
    result[`name${suffix}`] = (nameTexts?.[lang] ?? '').trim()
  }

  // MainStat
  const mainStat = extractMainStat(t.itemOptionByGroup, t.buffsByID, t.characters, t.itemTempletMap, t.textSystemMap, id)
  Object.assign(result, mainStat)

  // Effect descriptions
  const descTexts = getText(t.textSkill, `UO_CEQUIP_${id}_DESC`)
  const upgradeDescTexts = getText(t.textSkill, `UO_CEQUIP_${id}_UPGRADE_DESC`)

  const baseBuff = findEEBuff(t.buffsByID, id)
  const changeBuff = findEEUpgradeBuff(t.buffsByID, id)
  const baseBuff2 = findEEBuff2(t.buffsByID, id)
  const changeBuff2 = findEEUpgradeBuff2(t.buffsByID, id)

  if (descTexts) {
    for (const lang of GAME_LANGS) {
      const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
      const raw = (descTexts[lang] ?? '').trim()
      result[`effect${suffix}`] = baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw
    }
  }

  if (upgradeDescTexts) {
    for (const lang of GAME_LANGS) {
      const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
      const raw = (upgradeDescTexts[lang] ?? '').trim()
      result[`effect10${suffix}`] = changeBuff
        ? resolveEEPlaceholders(raw, changeBuff, changeBuff2)
        : (baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw)
    }
  }

  result.icon_effect = 'TI_Icon_UO_Accessary_07'

  // Buff/debuff
  const { buff, debuff } = extractEEBuffDebuff(t.buffTemplet, id, t.tooltipMap)
  result.buff = buff
  result.debuff = debuff

  return result
}

// ── Load existing ee.json ───────────────────────────────────────────

function loadExisting(): Record<string, Record<string, unknown>> {
  try {
    return JSON.parse(fs.readFileSync(EE_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

// ── Handlers ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = req.nextUrl.searchParams.get('action') ?? 'list'
  const t = loadAllTables()

  switch (action) {
    case 'list': {
      const existing = loadExisting()
      const eeItems = t.itemTemplet.filter((r) => r.ItemSubType === 'ITS_EQUIP_EXCLUSIVE')

      const entries = eeItems.map((row) => {
        const id = row.ID
        const nameTexts = getText(t.textItem, `ITEM_C_EQUIP_${id}_NAME`)
        const name = nameTexts?.en ?? id
        const exists = id in existing
        return { id, name, exists }
      })

      return NextResponse.json({
        total: entries.length,
        existing: entries.filter((e) => e.exists).length,
        new: entries.filter((e) => !e.exists).length,
        entries,
      })
    }

    case 'extract': {
      const id = req.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const existing = loadExisting()
      const prev = existing[id] ?? null
      const extracted = extractEE(id, t)
      const diffs = buildDiffs(extracted, prev)
      const manual: Record<string, unknown> = {}
      if (prev) {
        for (const key of MANUAL_FIELDS) {
          if (key in prev) manual[key] = prev[key]
        }
      }
      return NextResponse.json({ id, extracted, existing: prev, diffs, manual })
    }

    case 'compare': {
      const existing = loadExisting()
      const eeItems = t.itemTemplet.filter((r) => r.ItemSubType === 'ITS_EQUIP_EXCLUSIVE')

      const results: { id: string; name: string; diffs: DiffEntry[] }[] = []
      let ok = 0

      for (const row of eeItems) {
        const id = row.ID
        const prev = existing[id]
        if (!prev) continue

        const extracted = extractEE(id, t)
        const diffs = buildDiffs(extracted, prev)

        if (diffs.length > 0) {
          results.push({ id, name: String(prev.name ?? id), diffs })
        } else {
          ok++
        }
      }

      return NextResponse.json({
        total: Object.keys(existing).length,
        withDiffs: results.length,
        ok,
        results,
      })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    id: string
    manual: Record<string, unknown>
  }
  const { id, manual = {} } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const t = loadAllTables()
  const existing = loadExisting()
  const prev = existing[id] ?? {}

  const extracted = extractEE(id, t)

  // Merge manual fields: from body, fallback to existing
  for (const key of MANUAL_FIELDS) {
    const val = manual[key] ?? prev[key]
    if (val !== undefined) extracted[key] = val
  }

  const entry = orderKeys(extracted)

  // Trim all string values
  for (const [k, v] of Object.entries(entry)) {
    if (typeof v === 'string') entry[k] = v.trim()
  }

  existing[id] = entry

  // Sort by ID
  const sorted: Record<string, Record<string, unknown>> = {}
  for (const k of Object.keys(existing).sort()) {
    sorted[k] = existing[k]
  }

  fs.writeFileSync(EE_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf-8')

  // Copy EE icon if missing
  const eeImages = copyEEIcon(id)

  return NextResponse.json({ success: true, id, images: eeImages })
}

// ── Image copy ──────────────────────────────────────────────────────

function copyEEIcon(id: string): { copied: boolean } {
  const src = [process.cwd(), 'datamine', 'extracted_astudio', 'assets', 'editor', 'resources', 'sprite', 'at_thumbnailitemruntime', `TI_Equipment_EX_${id}.png`].join(path.sep)
  const dst = path.join(process.cwd(), 'public', 'images', 'characters', 'ee', `${id}.png`)
  if (fs.existsSync(dst)) return { copied: false }
  if (!fs.existsSync(src)) return { copied: false }
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
  return { copied: true }
}
