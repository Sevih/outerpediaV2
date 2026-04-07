import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  loadEquipTables, extractItems, buildBossMap, buildDiffs, orderKeys, mergeWithExisting,
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

function loadExisting(): Record<string, unknown>[] {
  try { return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) } catch { return [] }
}

function findExisting(existing: Record<string, unknown>[], item: ExtractedItem): number {
  const name = String(item.extracted.name ?? '')
  const cls = item.extracted.class ?? null
  return existing.findIndex((e) => e.name === name && (e.class ?? null) === cls)
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
      ...w.extracted, id: w.id, existsInJson: findExisting(existing, w) >= 0,
    }))
    return NextResponse.json({ total: entries.length, existing: entries.filter((e) => e.existsInJson).length, new: entries.filter((e) => !e.existsInJson).length, entries })
  }

  if (action === 'compare') {
    const results: { id: string; name: string; diffs: ReturnType<typeof buildDiffs> }[] = []
    let ok = 0
    for (const w of items) {
      const idx = findExisting(existing, w)
      if (idx < 0) continue
      const diffs = buildDiffs(w.extracted as Record<string, unknown>, existing[idx])
      if (diffs.length > 0) results.push({ id: w.id, name: String(w.extracted.name ?? ''), diffs })
      else ok++
    }
    return NextResponse.json({ total: existing.length, withDiffs: results.length, ok, results })
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

  let saved = 0; let copied = 0

  for (const id of ids) {
    const w = itemById.get(id); if (!w) continue
    const idx = findExisting(existing, w)
    const merged = idx >= 0 ? mergeWithExisting(w.extracted as Record<string, unknown>, existing[idx]) : w.extracted
    const ordered = orderKeys(merged as Record<string, unknown>, KEY_ORDER)
    if (idx >= 0) existing[idx] = ordered
    else existing.push(ordered)
    if (copyEquipImage(String(w.extracted.image ?? '')) === 'copied') copied++
    if (copyEffectImage(String(w.extracted.effect_icon ?? '')) === 'copied') copied++
    saved++
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  return NextResponse.json({ ok: true, saved, copied })
}
