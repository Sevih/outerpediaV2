import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  loadEquipTables, extractItems, buildBossMap, buildDiffs, orderKeys,
  devGuard, copyEquipImage, copyEffectImage,
  type ExtractedItem,
} from '../lib'

const JSON_PATH = path.join(process.cwd(), 'data', 'equipment', 'weapon.json')

const CFG = {
  itemSubType: 'ITS_EQUIP_WEAPON',
  typeName: 'weapon',
  effectPrefixes: ['UO_WEAPON_', 'UO_EVENT_'],
}

const KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'type', 'rarity', 'image',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon', 'class', 'source', 'boss', 'level',
]

function loadExisting(): Record<string, Record<string, unknown>> {
  try { return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) } catch { return {} }
}

function findExistingKey(existing: Record<string, Record<string, unknown>>, item: ExtractedItem): string | undefined {
  const name = String(item.extracted.name ?? '')
  const cls = String(item.extracted.class ?? '')
  for (const [key, entry] of Object.entries(existing)) {
    if (entry.name === name && (entry.class ?? '') === (cls || null)) return key
  }
  return undefined
}

export async function GET(req: NextRequest) {
  const blocked = devGuard(); if (blocked) return blocked
  const action = req.nextUrl.searchParams.get('action') ?? 'list'
  const t = loadEquipTables()
  const bossMap = buildBossMap(t, 'DM_RAID_2')
  const items = extractItems(CFG, t, bossMap)
  const existing = loadExisting()

  if (action === 'list') {
    const entries = items.map((w) => ({
      ...w.extracted, id: w.id, existsInJson: !!findExistingKey(existing, w),
    }))
    return NextResponse.json({ total: entries.length, existing: entries.filter((e) => e.existsInJson).length, new: entries.filter((e) => !e.existsInJson).length, entries })
  }

  if (action === 'compare') {
    const results: { id: string; name: string; diffs: ReturnType<typeof buildDiffs> }[] = []
    let ok = 0
    for (const w of items) {
      const key = findExistingKey(existing, w)
      if (!key) continue
      const diffs = buildDiffs(w.extracted as Record<string, unknown>, existing[key])
      if (diffs.length > 0) results.push({ id: w.id, name: String(w.extracted.name ?? ''), diffs })
      else ok++
    }
    return NextResponse.json({ total: Object.keys(existing).length, withDiffs: results.length, ok, results })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const blocked = devGuard(); if (blocked) return blocked
  const body = await req.json()
  const ids: string[] = body.ids ?? (body.id ? [body.id] : [])
  if (!ids.length) return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 })

  const t = loadEquipTables()
  const bossMap = buildBossMap(t, 'DM_RAID_2')
  const items = extractItems(CFG, t, bossMap)
  const itemById = new Map(items.map((w) => [w.id, w]))
  const existing = loadExisting()

  let maxKey = Math.max(-1, ...Object.keys(existing).map(Number).filter((n) => !isNaN(n)))
  let saved = 0; let copied = 0

  for (const id of ids) {
    const w = itemById.get(id); if (!w) continue
    const key = findExistingKey(existing, w) ?? String(++maxKey)
    existing[key] = orderKeys(w.extracted as Record<string, unknown>, KEY_ORDER)
    if (copyEquipImage(String(w.extracted.image ?? '')) === 'copied') copied++
    if (copyEffectImage(String(w.extracted.effect_icon ?? '')) === 'copied') copied++
    saved++
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  return NextResponse.json({ ok: true, saved, copied })
}
