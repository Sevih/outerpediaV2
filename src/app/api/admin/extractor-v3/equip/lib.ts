import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang } from '@/lib/i18n/config'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')
const DATAMINE_SPRITE = path.join(process.cwd(), 'datamine', 'extracted_astudio', 'assets', 'editor', 'resources', 'sprite', 'at_thumbnailitemruntime')
const EQUIP_IMG_DIR = path.join(process.cwd(), 'public', 'images', 'equipment')
const EFFECT_IMG_DIR = path.join(process.cwd(), 'public', 'images', 'ui', 'effect')

export const LANG_COLUMNS: Record<Lang, string> = {
  en: 'English', jp: 'Japanese', kr: 'Korean', zh: 'China_Simplified',
}

export type Row = Record<string, string>

export function loadTable(name: string): Row[] {
  return JSON.parse(fs.readFileSync(path.join(JSON2_DIR, `${name}.json`), 'utf-8'))
}

export function indexBy(rows: Row[], key = 'ID') {
  const map = new Map<string, Row>()
  for (const row of rows) { const k = row[key]; if (k) map.set(k, row) }
  return map
}

export function groupBy(rows: Row[], key: string) {
  const map = new Map<string, Row[]>()
  for (const row of rows) { const k = row[key]; if (!k) continue; if (!map.has(k)) map.set(k, []); map.get(k)!.push(row) }
  return map
}

// Get localized text from a text table indexed by ID
function getLangTexts(entry: Row | undefined): Record<Lang, string> | null {
  if (!entry) return null
  const r = {} as Record<Lang, string>
  for (const lang of LANGS) r[lang] = entry[LANG_COLUMNS[lang]] ?? ''
  return r
}

export function expandLang(prefix: string, texts: Record<Lang, string> | null): Record<string, string | null> {
  const r: Record<string, string | null> = {}
  for (const lang of LANGS) {
    const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
    r[`${prefix}${suffix}`] = texts?.[lang]?.trim() ?? null
  }
  return r
}

// ── Placeholder resolution ──────────────────────────────────────────

function isPermille(buff: Row): boolean {
  if (buff.ApplyingType === 'OAT_RATE') return true
  const st = buff.StatType ?? ''
  if (st.includes('_RATE') || st.includes('_DMG')) return true
  const t = buff.Type ?? ''
  if (t === 'BT_ADDITIVE_TURN' || t.includes('_ENHANCE')) return true
  return false
}

function fmtValue(buff: Row): string {
  const v = parseInt(buff.Value ?? '0')
  return isPermille(buff) ? `${Math.abs(v) / 10}%` : String(Math.abs(v))
}

function fmtTurn(buff: Row): string {
  return /^\d+$/.test(buff.TurnDuration ?? '') ? buff.TurnDuration! : '?'
}

function c(v: string) { return `<color=#28d9ed>${v}</color>` }

function findBuff(buffsByID: Map<string, Row[]>, buffIdStr: string, level: number, index = 0): Row | undefined {
  const ids = buffIdStr.split(',').map((s) => s.trim())
  const targetId = index === 0 ? ids[0] : (ids[index] ?? `${ids[0]}_${index + 1}`)
  return buffsByID.get(targetId)?.find((r) => r.Level === String(level))
}

export function resolvePlaceholders(text: string, buffsByID: Map<string, Row[]>, buffIdStr: string, level: number): string {
  const b = findBuff(buffsByID, buffIdStr, level, 0)
  const b2 = findBuff(buffsByID, buffIdStr, level, 1)
  const b4 = findBuff(buffsByID, buffIdStr, level, 3)
  const b5 = findBuff(buffsByID, buffIdStr, level, 4)

  const rate = b?.CreateRate ? `${parseInt(b.CreateRate) / 10}%` : '?'
  const val = b ? fmtValue(b) : '?'
  const turn = b ? fmtTurn(b) : '?'
  const val2 = b2 ? fmtValue(b2) : '?'
  const turn2 = b2 ? fmtTurn(b2) : '?'
  const val4 = b4 ? fmtValue(b4) : '?'
  const val5 = b5 ? fmtValue(b5) : '?'

  return text
    .replace(/\[\+Value5\]/gi, c(`+${val5}`))
    .replace(/\[-Value5\]/gi, c(`-${val5}`))
    .replace(/\[Value5\]/gi, c(val5))
    .replace(/\[\+Value4\]/gi, c(`+${val4}`))
    .replace(/\[-Value4\]/gi, c(`-${val4}`))
    .replace(/\[Value4\]/gi, c(val4))
    .replace(/\[\+Value2\]/gi, c(`+${val2}`))
    .replace(/\[-Value2\]/gi, c(`-${val2}`))
    .replace(/\[Value2\]/gi, c(val2))
    .replace(/\[RATE\]/gi, c(rate))
    .replace(/\[Rate1?\]/g, c(rate))
    .replace(/\[\+Value\]/gi, c(`+${val}`))
    .replace(/\[-Value\]/gi, c(`-${val}`))
    .replace(/\[Value\]/gi, c(val))
    .replace(/\[\+Turn1?\]/gi, c(turn))
    .replace(/\[-Turn\]/gi, c(`-${turn}`))
    .replace(/\[Turn2\]/gi, c(turn2))
    .replace(/\[Turn\]/gi, c(turn))
}

export function getMaxLevel(buffsByID: Map<string, Row[]>, buffIdStr: string): number {
  const id = buffIdStr.split(',')[0].trim()
  const entries = buffsByID.get(id)
  if (!entries?.length) return 1
  return Math.max(...entries.map((r) => parseInt(r.Level) || 1))
}

// ── Class resolution ────────────────────────────────────────────────
// JSON2 uses ClassLimit (not TrustLevelLimit)

export function classFromRow(row: Row, textSystemMap: Map<string, Row>): string | null {
  const raw = row.ClassLimit ?? ''
  if (!raw || raw === 'CCT_NONE') return null
  const sysKey = `SYS_CLASS_${raw.replace('CCT_', '')}`
  const entry = textSystemMap.get(sysKey)
  return entry?.[LANG_COLUMNS[DEFAULT_LANG]] ?? null
}

export function resolveRarity(row: Row, textSystemMap: Map<string, Row>): string {
  const grade = row.ItemGrade ?? ''
  const key = `SYS_ITEM_GRADE_${grade.replace('IG_', '')}`
  const entry = textSystemMap.get(key)
  return (entry?.[LANG_COLUMNS[DEFAULT_LANG]] ?? grade).toLowerCase()
}

// ── Stat extraction (accessories) ───────────────────────────────────

const STAT_KEY: Record<string, string> = {
  ST_ATK: 'ATK', ST_DEF: 'DEF', ST_HP: 'HP',
  ST_BUFF_CHANCE: 'EFF', ST_BUFF_RESIST: 'RES', ST_SPEED: 'SPD',
  ST_CRITICAL_RATE: 'CHC', ST_CRITICAL_DMG_RATE: 'CHD',
  ST_PIERCE_POWER_RATE: 'PEN%', ST_VAMPIRIC: 'LS',
  ST_DMG_BOOST: 'DMG UP%', ST_DMG_REDUCE_RATE: 'DMG RED%',
  ST_E_CRI_DMG_REDUCE: 'CDMG RED%',
}

export function extractMainStats(itemOptionByGroup: Map<string, Row[]>, subOptId: string): string[] | null {
  const opts = itemOptionByGroup.get(subOptId)
  if (!opts?.length) return null
  const stats: string[] = []
  for (const opt of opts) {
    const base = STAT_KEY[opt.StatType]
    if (!base) continue
    const key = opt.ApplyingType === 'OAT_RATE' && !base.includes('%') ? `${base}%` : base
    if (!stats.includes(key)) stats.push(key)
  }
  return stats.length > 0 ? stats : null
}

// ── Image copy ──────────────────────────────────────────────────────

export function copyEquipImage(name: string): 'copied' | 'exists' | 'missing' {
  if (!name) return 'missing'
  const dst = path.join(EQUIP_IMG_DIR, `${name}.png`)
  if (fs.existsSync(dst)) return 'exists'
  const src = path.join(DATAMINE_SPRITE, `${name}.png`)
  if (!fs.existsSync(src)) return 'missing'
  fs.mkdirSync(EQUIP_IMG_DIR, { recursive: true })
  fs.copyFileSync(src, dst)
  return 'copied'
}

export function copyEffectImage(name: string): 'copied' | 'exists' | 'missing' {
  if (!name) return 'missing'
  const dst = path.join(EFFECT_IMG_DIR, `${name}.png`)
  if (fs.existsSync(dst)) return 'exists'
  const src = path.join(DATAMINE_SPRITE, `${name}.png`)
  if (!fs.existsSync(src)) return 'missing'
  fs.mkdirSync(EFFECT_IMG_DIR, { recursive: true })
  fs.copyFileSync(src, dst)
  return 'copied'
}

// ── Key ordering ────────────────────────────────────────────────────

export function orderKeys(obj: Record<string, unknown>, keyOrder: string[]): Record<string, unknown> {
  const ordered: Record<string, unknown> = {}
  for (const key of keyOrder) { if (key in obj) ordered[key] = obj[key] }
  for (const key of Object.keys(obj)) { if (!(key in ordered)) ordered[key] = obj[key] }
  return ordered
}

// ── Deep diff ───────────────────────────────────────────────────────

export interface DiffEntry {
  key: string
  type: 'changed' | 'typo'
  extracted: unknown
  existing: unknown
}

export function buildDiffs(extracted: Record<string, unknown>, existing: Record<string, unknown>): DiffEntry[] {
  const diffs: DiffEntry[] = []
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
    const extStr = JSON.stringify(ext)
    const curStr = JSON.stringify(cur)
    if (extStr === curStr) continue
    const type = normalize(ext) === normalize(cur) ? 'typo' as const : 'changed' as const
    diffs.push({ key, type, extracted: ext, existing: cur })
  }
  return diffs
}

// ── Shared tables ───────────────────────────────────────────────────

export interface EquipTables {
  itemTemplet: Row[]
  textItemMap: Map<string, Row>   // indexed by ID
  textSkillMap: Map<string, Row>  // indexed by ID
  textSystemMap: Map<string, Row> // indexed by ID
  optById: Map<string, Row>      // ItemSpecialOptionTemplet by ID
  buffsByID: Map<string, Row[]>  // BuffTemplet grouped by BuffID
  itemOptionByGroup: Map<string, Row[]> // ItemOptionTemplet grouped by GroupID
  dungeonData: Row[]
  rewardData: Row[]
  rewardGroupData: Row[]
  spawnData: Row[]
  productData: Row[]
  itemCraftData: Row[]
}

export function loadEquipTables(): EquipTables {
  const itemTemplet = loadTable('ItemTemplet')
  const textItemMap = indexBy(loadTable('TextItem'))           // by ID
  const textSkillMap = indexBy(loadTable('TextSkill'))         // by ID
  const textSystemMap = indexBy(loadTable('TextSystem'))       // by ID
  const optById = indexBy(loadTable('ItemSpecialOptionTemplet')) // by ID
  const buffsByID = groupBy(loadTable('BuffTemplet'), 'BuffID')
  const itemOptionByGroup = groupBy(loadTable('ItemOptionTemplet'), 'GroupID')
  const dungeonData = loadTable('DungeonTemplet')
  const rewardData = loadTable('RewardTemplet')
  const rewardGroupData = loadTable('RewardGroupTemplet')
  const spawnData = loadTable('DungeonSpawnTemplet')
  const productData = loadTable('ProductTemplet')
  const itemCraftData = loadTable('ItemCraftRewardTemplet')

  return {
    itemTemplet, textItemMap, textSkillMap, textSystemMap, optById,
    buffsByID, itemOptionByGroup, dungeonData, rewardData, rewardGroupData,
    spawnData, productData, itemCraftData,
  }
}

// ── Shared boss mapping logic ───────────────────────────────────────

export function buildBossMap(t: EquipTables, dungeonMode: string): Map<string, string | string[]> {
  const spawnToBoss: Record<string, string> = {}
  for (const s of t.spawnData) {
    if (s.HPLineCount) spawnToBoss[s.HPLineCount] = s.ID0 || s.ID3
  }

  const rewardToGroups: Record<string, string[]> = {}
  for (const r of t.rewardData) {
    if (r.RandomGroupID) rewardToGroups[r.ID] = r.RandomGroupID.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const itemToBoss = new Map<string, string | string[]>()
  for (const d of t.dungeonData) {
    if (d.DungeonMode !== dungeonMode) continue
    const name = t.textSystemMap.get(d.SeasonFullName)?.[LANG_COLUMNS[DEFAULT_LANG]] ?? ''
    if (!name.includes('Stage 13')) continue

    const spawnId = d.SpawnID_Pos0 || d.SpawnID_Pos1 || d.SpawnID_Pos2
    const bossId = spawnId ? spawnToBoss[spawnId] : undefined
    if (!bossId) continue

    const groups = rewardToGroups[d.RewardID] ?? []
    for (const gid of groups) {
      for (const r of t.rewardGroupData) {
        if (r.GroupID === gid && r.Type === 'RIT_ITEM') {
          itemToBoss.set(r.TypeID, bossId)
        }
      }
    }
  }

  // Irregular boss mappings
  const IRREGULAR: Record<string, string[]> = {
    '7003001': ['51202001', '51202002'],
    '7003002': ['51202003', '51202004'],
  }
  for (const [groupId, bossIds] of Object.entries(IRREGULAR)) {
    for (const r of t.rewardGroupData) {
      if (r.GroupID === groupId && r.Type === 'RIT_ITEM') {
        itemToBoss.set(r.TypeID, bossIds)
      }
    }
  }

  return itemToBoss
}

// ── Source detection ────────────────────────────────────────────────

export function detectSource(id: string, t: EquipTables): string | null {
  const eventIds = new Set<string>()
  for (const p of t.productData) {
    if (p.ProductGoodsType === 'PGT_ITEM' && p.ProductCategory?.startsWith('PC_EVENT')) {
      eventIds.add(p.ProductGoodsID)
    }
  }
  for (const craft of t.itemCraftData) {
    if (craft.ID === id) {
      const prod = t.productData.find((p) => p.ID === craft.GroupID)
      if (prod?.ProductCategory?.startsWith('PC_EVENT')) return 'Event Shop'
      if (prod?.ProductLevel === 'PC_ADVENTURE_LICENSE') return 'Adventure License'
      const siblings = t.itemCraftData.filter((c) => c.GroupID === craft.GroupID)
      if (siblings.some((s) => eventIds.has(s.ID))) return 'Event Shop'
    }
  }
  for (const p of t.productData) {
    if (p.ProductGoodsType !== 'PGT_ITEM' || p.ProductGoodsID !== id) continue
    if (p.ProductCategory?.startsWith('PC_EVENT')) return 'Event Shop'
    if (p.ProductLevel === 'PC_ADVENTURE_LICENSE') return 'Adventure License'
  }
  return null
}

// ── Shared extraction: weapon-like items (weapon, accessory) ────────

export interface ExtractedItem {
  id: string
  extracted: Record<string, unknown>
}

export interface ItemConfig {
  itemSubType: string
  typeName: string
  effectPrefixes: string[]
  withMainStats?: boolean
}

export function extractItems(cfg: ItemConfig, t: EquipTables, bossMap: Map<string, string | string[]>): ExtractedItem[] {
  const all = t.itemTemplet.filter((r) =>
    r.ItemSubType === cfg.itemSubType && (r.ItemGrade === 'IG_UNIQUE' || r.ItemGrade === 'IG_RARE') && parseInt(r.BasicStar ?? '0') >= 5
  )

  // Dedup: highest star per name+class
  const bestNC = new Map<string, Row>()
  for (const row of all) {
    const nameEntry = t.textItemMap.get(row.NameID)
    const name = nameEntry?.[LANG_COLUMNS[DEFAULT_LANG]] ?? row.ID
    const cls = classFromRow(row, t.textSystemMap)
    const k = `${name}|${cls}`
    const ex = bestNC.get(k)
    if (!ex || parseInt(row.BasicStar ?? '0') > parseInt(ex.BasicStar ?? '0')) bestNC.set(k, row)
  }

  const results: ExtractedItem[] = []

  for (const row of bestNC.values()) {
    const id = row.ID
    const nameTexts = getLangTexts(t.textItemMap.get(row.NameID))
    const cls = classFromRow(row, t.textSystemMap)
    const star = parseInt(row.BasicStar ?? '1')

    // Find effect via UniqueOptionID → ItemSpecialOptionTemplet
    const effectOpt = row.UniqueOptionID ? t.optById.get(row.UniqueOptionID.split(',')[0].trim()) : undefined

    const effectNameTexts = effectOpt ? getLangTexts(t.textSkillMap.get(effectOpt.NameID)) : null
    const descID = effectOpt?.DescID ?? effectOpt?.CustomCraftDescID
    const descTexts = descID ? getLangTexts(t.textSkillMap.get(descID)) : null
    const buffIdStr = effectOpt?.BuffID ?? ''
    const maxLevel = buffIdStr ? getMaxLevel(t.buffsByID, buffIdStr) : 1

    const extracted: Record<string, unknown> = {
      ...expandLang('name', nameTexts),
      type: cfg.typeName,
      rarity: resolveRarity(row, t.textSystemMap),
      image: row.IconName ?? '',
      ...expandLang('effect_name', effectNameTexts),
      effect_icon: effectOpt?.IconName ?? null,
      class: cls,
      level: star,
    }

    // Boss / source
    if (row.ItemGrade === 'IG_UNIQUE') {
      const boss = bossMap.get(id) ?? null
      if (boss) {
        extracted.boss = boss
      } else {
        const source = detectSource(id, t)
        if (source) { extracted.source = source; extracted.boss = null }
      }
    }

    // MainStats (accessories)
    if (cfg.withMainStats) {
      const subOptId = row.SubOptionGroupID?.split(',')[0]?.trim()
      if (subOptId) {
        const stats = extractMainStats(t.itemOptionByGroup, subOptId)
        if (stats) extracted.mainStats = stats
      }
    }

    // Effect descriptions
    for (const lang of LANGS) {
      const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
      if (descTexts && buffIdStr) {
        const raw = (descTexts[lang] ?? '').trim()
        extracted[`effect_desc1${suffix}`] = resolvePlaceholders(raw, t.buffsByID, buffIdStr, 1)
        extracted[`effect_desc4${suffix}`] = resolvePlaceholders(raw, t.buffsByID, buffIdStr, maxLevel)
      } else {
        extracted[`effect_desc1${suffix}`] = null
        extracted[`effect_desc4${suffix}`] = null
      }
    }

    results.push({ id, extracted })
  }

  results.sort((a, b) => parseInt(a.id) - parseInt(b.id))
  return results
}

// ── Shared armor set extraction ─────────────────────────────────────

function isPermilleStat(statType: string, applyingType: string): boolean {
  if (applyingType === 'OAT_RATE') return true
  if (statType.includes('_RATE') || statType.includes('_DMG') || statType === 'ST_VAMPIRIC') return true
  return false
}

function resolveStatEffect(statType: string, applyingType: string, rawValue: string, textSystemMap: Map<string, Row>): Record<Lang, string | null> {
  if (!statType || statType === 'ST_NONE' || !rawValue || rawValue === 'OAT_NONE') {
    const r = {} as Record<Lang, string | null>
    for (const lang of LANGS) r[lang] = null
    return r
  }
  const sysKey = `SYS_STAT_${statType.slice(3)}`
  const entry = textSystemMap.get(sysKey)
  const num = parseInt(rawValue)
  const fmtd = isNaN(num) ? '' : isPermilleStat(statType, applyingType) ? `${num / 10}%` : String(num)
  const r = {} as Record<Lang, string | null>
  for (const lang of LANGS) {
    const name = entry?.[LANG_COLUMNS[lang]] ?? statType
    r[lang] = `${name} +${fmtd}`
  }
  return r
}

function resolveSetEffect(row: Row, piece: '2P' | '4P', t: EquipTables): Record<Lang, string | null> {
  const optType = row[`OptionType_${piece}`] ?? ''
  if (optType === 'IOT_STAT') {
    const rawValue = row[`OptionValue_${piece}`] ?? ''
    return resolveStatEffect(row[`StatType_${piece}`] ?? '', row[`ApplyingType_${piece}`] ?? '', rawValue, t.textSystemMap)
  }
  if (optType === 'IOT_BUFF') {
    const descIds = (row.DescID ?? row.CustomCraftDescID ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const index = piece === '4P' && (row.OptionType_2P ?? '') === 'IOT_BUFF' ? 1 : 0
    const descId = descIds[index]
    if (!descId) { const r = {} as Record<Lang, string | null>; for (const lang of LANGS) r[lang] = null; return r }
    const texts = getLangTexts(t.textSkillMap.get(descId))
    const r = {} as Record<Lang, string | null>
    for (const lang of LANGS) r[lang] = texts?.[lang] ?? null
    return r
  }
  const r = {} as Record<Lang, string | null>
  for (const lang of LANGS) r[lang] = null
  return r
}

function expandEffectLang(prefix: string, langMap: Record<Lang, string | null>): Record<string, string | null> {
  const r: Record<string, string | null> = {}
  r[prefix] = langMap[DEFAULT_LANG]
  for (const lang of SUFFIX_LANGS) r[`${prefix}_${lang}`] = langMap[lang]
  return r
}

function nullLangMap(): Record<Lang, string | null> {
  const r = {} as Record<Lang, string | null>
  for (const lang of LANGS) r[lang] = null
  return r
}

export function extractSets(t: EquipTables): ExtractedItem[] {
  const allOpts = Array.from(t.optById.values())
  const setEntries = allOpts.filter((r) => (r.NameID ?? '').startsWith('ST_Set_'))

  const byGroup = new Map<string, { tier0?: Row; tier4?: Row }>()
  for (const row of setEntries) {
    const g = byGroup.get(row.GroupID) ?? {}
    if (row.Level === '1') g.tier0 = row
    else if (row.Level === '2') g.tier4 = row
    byGroup.set(row.GroupID, g)
  }

  // Boss map: armor GroupID → boss
  const spawnToBoss: Record<string, string> = {}
  for (const s of t.spawnData) { if (s.HPLineCount) spawnToBoss[s.HPLineCount] = s.ID0 || s.ID3 }
  const rewardById: Record<string, Row> = {}
  for (const r of t.rewardData) { if (r.ID) rewardById[r.ID] = r }
  const itemById = indexBy(t.itemTemplet)

  const groupToBoss = new Map<string, string>()
  for (const d of t.dungeonData) {
    if (d.DungeonMode !== 'DM_RAID_1') continue
    const name = t.textSystemMap.get(d.SeasonFullName)?.[LANG_COLUMNS[DEFAULT_LANG]] ?? ''
    if (!name.includes('Stage 13')) continue
    const bossId = spawnToBoss[d.SpawnID_Pos2] ?? spawnToBoss[d.SpawnID_Pos0] ?? spawnToBoss[d.SpawnID_Pos1]
    if (!bossId) continue
    const reward = rewardById[d.RewardID]
    if (!reward?.RandomGroupID) continue
    for (const gid of reward.RandomGroupID.split(',').map((s) => s.trim())) {
      for (const r of t.rewardGroupData) {
        if (r.GroupID !== gid || r.Type !== 'RIT_ITEM') continue
        const item = itemById.get(r.TypeID)
        // Extract set GroupID from NameID: ITEM_HELMET_M_7S_NAME → 7
        const match = item?.NameID?.match(/_(\d+)S_NAME$/)
        if (match) groupToBoss.set(match[1], bossId)
      }
    }
  }

  const rarity = (t.textSystemMap.get('SYS_ITEM_GRADE_UNIQUE')?.[LANG_COLUMNS[DEFAULT_LANG]] ?? 'Legendary').toLowerCase()
  const results: ExtractedItem[] = []

  for (const [groupId, { tier0, tier4 }] of Array.from(byGroup)) {
    if (!tier0) continue
    const nameTexts = getLangTexts(t.textItemMap.get(tier0.NameID))
    const boss = groupToBoss.get(groupId) ?? null

    const extracted: Record<string, unknown> = {
      ...expandLang('name', nameTexts),
      rarity,
      set_icon: tier0.IconName ?? '',
      ...expandEffectLang('effect_2_1', resolveSetEffect(tier0, '2P', t)),
      ...expandEffectLang('effect_4_1', resolveSetEffect(tier0, '4P', t)),
      ...expandEffectLang('effect_2_4', tier4 ? resolveSetEffect(tier4, '2P', t) : nullLangMap()),
      ...expandEffectLang('effect_4_4', tier4 ? resolveSetEffect(tier4, '4P', t) : nullLangMap()),
      class: null,
      boss,
      image_prefix: '06',
    }
    if (!boss) extracted.source = null

    results.push({ id: groupId, extracted })
  }

  results.sort((a, b) => parseInt(a.id) - parseInt(b.id))
  return results
}

// ── Shared talisman extraction ──────────────────────────────────────

export function extractTalismans(t: EquipTables): ExtractedItem[] {
  const all = t.itemTemplet.filter((r) => r.ItemSubType === 'ITS_EQUIP_OOPARTS')

  // Dedup: highest star per NameID
  const best = new Map<string, Row>()
  for (const row of all) {
    const k = row.NameID ?? row.ID
    const ex = best.get(k)
    if (!ex || parseInt(row.BasicStar ?? '0') > parseInt(ex.BasicStar ?? '0')) best.set(k, row)
  }

  const results: ExtractedItem[] = []

  for (const row of best.values()) {
    const id = row.ID
    const nameTexts = getLangTexts(t.textItemMap.get(row.NameID))

    const enchantIds = (row.ItemEnchantCostRate ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const baseOpt = enchantIds[0] ? t.optById.get(enchantIds[0]) : undefined
    const upgradedOpt = enchantIds[1] ? t.optById.get(enchantIds[1]) : undefined

    const effectNameTexts = baseOpt ? getLangTexts(t.textSkillMap.get(baseOpt.NameID)) : null
    const baseBuffId = baseOpt?.BuffID ?? ''
    const type = baseBuffId.includes('_AP_') ? 'AP' : 'CP'

    const extracted: Record<string, unknown> = {
      ...expandLang('name', nameTexts),
      type,
      rarity: resolveRarity(row, t.textSystemMap),
      image: row.IconName ?? '',
      ...expandLang('effect_name', effectNameTexts),
    }

    // Base effect (level 1)
    if (baseOpt) {
      const descID = baseOpt.CustomCraftDescID ?? baseOpt.DescID
      const descTexts = descID ? getLangTexts(t.textSkillMap.get(descID)) : null
      const buffId = baseOpt.BuffID ?? ''
      for (const lang of LANGS) {
        const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
        if (descTexts && buffId && buffId !== 'OAT_NONE') {
          extracted[`effect_desc1${suffix}`] = resolvePlaceholders((descTexts[lang] ?? '').trim(), t.buffsByID, buffId, 1)
        } else {
          extracted[`effect_desc1${suffix}`] = null
        }
      }
    } else {
      for (const lang of LANGS) { const s = lang === DEFAULT_LANG ? '' : `_${lang}`; extracted[`effect_desc1${s}`] = null }
    }

    // Upgraded effect
    if (upgradedOpt?.BuffID && upgradedOpt.BuffID !== 'OAT_NONE') {
      const descID = upgradedOpt.CustomCraftDescID ?? upgradedOpt.DescID
      const descTexts = descID ? getLangTexts(t.textSkillMap.get(descID)) : null
      const buffId = upgradedOpt.BuffID
      const maxLvl = getMaxLevel(t.buffsByID, buffId)
      for (const lang of LANGS) {
        const suffix = lang === DEFAULT_LANG ? '' : `_${lang}`
        if (descTexts && buffId) {
          extracted[`effect_desc4${suffix}`] = resolvePlaceholders((descTexts[lang] ?? '').trim(), t.buffsByID, buffId, maxLvl)
        } else {
          extracted[`effect_desc4${suffix}`] = null
        }
      }
    } else {
      for (const lang of LANGS) { const s = lang === DEFAULT_LANG ? '' : `_${lang}`; extracted[`effect_desc4${s}`] = null }
    }

    extracted.effect_icon = baseOpt?.IconName ?? null
    extracted.level = row.BasicStar ?? '1'
    extracted.source = null
    extracted.boss = null
    extracted.mode = null

    results.push({ id, extracted })
  }

  results.sort((a, b) => parseInt(a.id) - parseInt(b.id))
  return results
}

// ── Guards ──────────────────────────────────────────────────────────

export function devGuard() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
