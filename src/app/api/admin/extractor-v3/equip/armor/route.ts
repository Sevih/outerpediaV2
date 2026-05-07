import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  loadEquipTables, extractSets, buildDiffs, orderKeys, mergeWithExisting,
  devGuard, copyEffectImage,
} from '../lib'

const JSON_PATH = path.join(process.cwd(), 'data', 'equipment', 'sets.json')

const KEY_ORDER = [
  'id',
  'name', 'name_jp', 'name_kr', 'name_zh',
  'rarity', 'set_icon',
  'effect_2_1', 'effect_2_1_jp', 'effect_2_1_kr', 'effect_2_1_zh',
  'effect_4_1', 'effect_4_1_jp', 'effect_4_1_kr', 'effect_4_1_zh',
  'effect_2_4', 'effect_2_4_jp', 'effect_2_4_kr', 'effect_2_4_zh',
  'effect_4_4', 'effect_4_4_jp', 'effect_4_4_kr', 'effect_4_4_zh',
  'class', 'source', 'boss', 'image_prefix',
]

function loadExisting(): Record<string, unknown>[] {
  try { return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) } catch { return [] }
}

export async function GET(req: NextRequest) {
  const blocked = devGuard(); if (blocked) return blocked
  const action = req.nextUrl.searchParams.get('action') ?? 'list'
  const t = loadEquipTables()
  const sets = extractSets(t)
  const existing = loadExisting()

  if (action === 'list') {
    const existingNames = new Set(existing.map((e) => String(e.name ?? '')))
    const entries = sets.map((s) => ({
      ...s.extracted, id: s.id, existsInJson: existingNames.has(String(s.extracted.name ?? '')),
    }))
    return NextResponse.json({ total: entries.length, existing: entries.filter((e) => e.existsInJson).length, new: entries.filter((e) => !e.existsInJson).length, entries })
  }

  if (action === 'compare') {
    const existingByName = new Map<string, Record<string, unknown>>()
    for (const entry of existing) existingByName.set(String(entry.name ?? ''), entry)

    const results: { id: string; name: string; diffs: ReturnType<typeof buildDiffs> }[] = []
    let ok = 0
    for (const s of sets) {
      const name = String(s.extracted.name ?? '')
      const prev = existingByName.get(name)
      if (!prev) continue
      const diffs = buildDiffs(s.extracted as Record<string, unknown>, prev)
      if (diffs.length > 0) results.push({ id: s.id, name, diffs })
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
  const sets = extractSets(t)
  const setById = new Map(sets.map((s) => [s.id, s]))
  const existing = loadExisting()

  let saved = 0; let copied = 0

  for (const id of ids) {
    const s = setById.get(id); if (!s) continue
    const name = String(s.extracted.name ?? '')
    const idx = existing.findIndex((e) => String(e.name ?? '') === name)
    const merged = idx >= 0 ? mergeWithExisting(s.extracted as Record<string, unknown>, existing[idx]) : s.extracted
    const ordered = orderKeys(merged as Record<string, unknown>, KEY_ORDER)
    if (idx >= 0) existing[idx] = ordered
    else existing.push(ordered)
    if (copyEffectImage(String(s.extracted.set_icon ?? '')) === 'copied') copied++
    saved++
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  return NextResponse.json({ ok: true, saved, copied })
}
