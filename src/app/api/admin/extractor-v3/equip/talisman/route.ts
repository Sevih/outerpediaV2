import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  loadEquipTables, extractTalismans, buildDiffs, orderKeys, mergeWithExisting,
  devGuard, copyEquipImage, copyEffectImage,
} from '../lib'

const JSON_PATH = path.join(process.cwd(), 'data', 'equipment', 'talisman.json')

const KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'type', 'rarity', 'image',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon', 'level', 'source', 'boss', 'mode',
]

function loadExisting(): Record<string, unknown>[] {
  try { return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) } catch { return [] }
}

export async function GET(req: NextRequest) {
  const blocked = devGuard(); if (blocked) return blocked
  const action = req.nextUrl.searchParams.get('action') ?? 'list'
  const t = loadEquipTables()
  const talismans = extractTalismans(t)
  const existing = loadExisting()

  if (action === 'list') {
    const existingNames = new Set(existing.map((e) => String(e.name ?? '')))
    const entries = talismans.map((item) => ({
      ...item.extracted, id: item.id, existsInJson: existingNames.has(String(item.extracted.name ?? '')),
    }))
    return NextResponse.json({ total: entries.length, existing: entries.filter((e) => e.existsInJson).length, new: entries.filter((e) => !e.existsInJson).length, entries })
  }

  if (action === 'compare') {
    const existingByName = new Map<string, Record<string, unknown>>()
    for (const entry of existing) existingByName.set(String(entry.name ?? ''), entry)

    const results: { id: string; name: string; diffs: ReturnType<typeof buildDiffs> }[] = []
    let ok = 0
    for (const item of talismans) {
      const name = String(item.extracted.name ?? '')
      const prev = existingByName.get(name)
      if (!prev) continue
      const diffs = buildDiffs(item.extracted as Record<string, unknown>, prev)
      if (diffs.length > 0) results.push({ id: item.id, name, diffs })
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
  const talismans = extractTalismans(t)
  const talismanById = new Map(talismans.map((item) => [item.id, item]))
  const existing = loadExisting()

  let saved = 0; let copied = 0

  for (const id of ids) {
    const item = talismanById.get(id); if (!item) continue
    const name = String(item.extracted.name ?? '')
    const idx = existing.findIndex((e) => String(e.name ?? '') === name)
    const merged = idx >= 0 ? mergeWithExisting(item.extracted as Record<string, unknown>, existing[idx]) : item.extracted
    const ordered = orderKeys(merged as Record<string, unknown>, KEY_ORDER)
    if (idx >= 0) existing[idx] = ordered
    else existing.push(ordered)
    if (copyEquipImage(String(item.extracted.image ?? '')) === 'copied') copied++
    if (copyEffectImage(String(item.extracted.effect_icon ?? '')) === 'copied') copied++
    saved++
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  return NextResponse.json({ ok: true, saved, copied })
}
