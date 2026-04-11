import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { listMonsters } from './lib/base'
import { searchMonstersByName } from './lib/localization'
import { extractMonster, stripInternalFields } from './lib/extract'

const BOSS_DIR = path.join(process.cwd(), 'data', 'boss')

// "Boss-candidate" monster types. Includes CT_MONSTER because some
// wiki-tracked bosses (e.g. Skyward Tower entries) are typed as plain
// CT_MONSTER in MonsterTemplet.
const BOSS_TYPES = [
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_NAMED_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
  'CT_MONSTER',
]

// ── Boss ID conventions ──────────────────────────────────────────────
//
// Files in data/boss/ use these naming patterns (all reversible):
//   <monsterId>                    standard boss
//   <monsterId>S<parentId>         summon (minion) of a parent boss
//   <monsterId>@<dungeonId>        variant scoped to a specific dungeon
//   <monsterId>-<n>                FROZEN ARCHIVE (e.g. pre-nerf snapshot)
//   <monsterId>-<x>-<n>            FROZEN ARCHIVE with multi-suffix
//
// Archived files MUST NEVER be touched by the extractor — not by compare,
// not by save, not by typo fix. They are user-curated historical records.
//
// Files like 'index' / 'temp' are misc legacy files, also skipped.

type ParsedBossId = {
  raw: string
  monsterId: string
  parentId: string | null // for summons (S pattern)
  variantDungeonId: string | null // for location variants (@ pattern)
  isMisc: boolean // 'index' / 'temp' legacy files
  isArchived: boolean // versioned snapshot, never touch
}

function parseBossId(raw: string): ParsedBossId {
  if (raw === 'index' || raw === 'temp') {
    return { raw, monsterId: '', parentId: null, variantDungeonId: null, isMisc: true, isArchived: false }
  }
  // Versioned snapshot suffix `<id>-N` / `<id>-X-N`: frozen archive.
  if (raw.includes('-')) {
    return {
      raw,
      monsterId: raw.split('-')[0],
      parentId: null,
      variantDungeonId: null,
      isMisc: false,
      isArchived: true,
    }
  }
  // Variant scoped to a specific dungeon: `<monsterId>@<dungeonId>`
  if (raw.includes('@')) {
    const [monsterId, variantDungeonId = null] = raw.split('@')
    return { raw, monsterId, parentId: null, variantDungeonId, isMisc: false, isArchived: false }
  }
  // Summon spawned by a parent boss: `<monsterId>S<parentId>`
  if (raw.includes('S')) {
    const [monsterId, parentId = null] = raw.split('S')
    return { raw, monsterId, parentId, variantDungeonId: null, isMisc: false, isArchived: false }
  }
  return { raw, monsterId: raw, parentId: null, variantDungeonId: null, isMisc: false, isArchived: false }
}

/** True if the file should be completely ignored by all extractor actions. */
function isUntouchable(parsed: ParsedBossId): boolean {
  return parsed.isMisc || parsed.isArchived
}

// ── Wiki-format helpers ──────────────────────────────────────────────

const PRESERVE_FIELDS = ['IncludeSurname'] as const

// BuffImmune and StatBuffImmune are compared as a single combined set —
// we don't care which field holds which value, only that every entry in
// the game data is present somewhere in the saved file.
function csvToSet(v: unknown): Set<string> {
  if (typeof v !== 'string' || !v) return new Set()
  return new Set(v.split(',').map((s) => s.trim()).filter(Boolean))
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function mergeWithExisting(
  wiki: Record<string, unknown>,
  existing: Record<string, unknown> | null
): Record<string, unknown> {
  if (!existing) return wiki
  const out = { ...wiki }
  for (const key of PRESERVE_FIELDS) {
    if (key in existing) out[key] = existing[key]
  }
  // Preserve existing BuffImmune/StatBuffImmune split when the combined
  // set matches, so shuffling values between the two fields doesn't
  // surface as a diff and doesn't get reverted on save.
  const wikiUnion = new Set<string>([
    ...csvToSet(wiki.BuffImmune),
    ...csvToSet(wiki.StatBuffImmune),
  ])
  const existingUnion = new Set<string>([
    ...csvToSet(existing.BuffImmune),
    ...csvToSet(existing.StatBuffImmune),
  ])
  if (setsEqual(wikiUnion, existingUnion)) {
    if ('BuffImmune' in existing) out.BuffImmune = existing.BuffImmune
    if ('StatBuffImmune' in existing) out.StatBuffImmune = existing.StatBuffImmune
  }
  // Same idea for per-skill buff/debuff arrays: order doesn't matter,
  // only set membership. Preserve the existing order when the sets match.
  if (Array.isArray(out.skills) && Array.isArray(existing.skills)) {
    const wikiSkills = out.skills as Record<string, unknown>[]
    const existingSkills = existing.skills as Record<string, unknown>[]
    for (let i = 0; i < wikiSkills.length && i < existingSkills.length; i++) {
      const ws = wikiSkills[i]
      const es = existingSkills[i]
      if (!ws || !es) continue
      for (const key of ['buff', 'debuff'] as const) {
        const wArr = Array.isArray(ws[key]) ? (ws[key] as string[]) : []
        const eArr = Array.isArray(es[key]) ? (es[key] as string[]) : []
        if (setsEqual(new Set(wArr), new Set(eArr))) {
          if (key in es) wikiSkills[i] = { ...ws, [key]: eArr }
          else {
            const { [key]: _drop, ...rest } = ws
            void _drop
            wikiSkills[i] = rest
          }
        }
      }
    }
  }
  return out
}

// ── Helpers ─────────────────────────────────────────────────────────

// Summons (`<id>S<parent>`) inherit their location from the parent boss.
// The whole point of the `S` suffix is that the same child monster
// (e.g. Deformed Inferior Core 404400450) is shared across many parent
// stages — its own spawn rows would otherwise pick the wrong stage.
function inheritParentLocation(
  raw: ReturnType<typeof extractMonster>,
  parentId: string | null,
  dungeonId?: string
): void {
  if (!raw || !parentId) return
  const parent = extractMonster(parentId, dungeonId ? { dungeonId } : undefined)
  if (!parent) return
  raw.location = parent.location
  raw.level = parent.level
  raw._allLocations = parent._allLocations
}

function readBossFile(id: string): Record<string, unknown> | null {
  const p = path.join(BOSS_DIR, `${id}.json`)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function dictEn(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const dict = value as Record<string, unknown>
    const en = dict.en ?? dict.English ?? dict.EN
    if (typeof en === 'string') return en
  }
  return null
}

function pickName(
  extracted: Record<string, unknown> | null,
  existing: Record<string, unknown> | null,
  id: string
): string {
  return dictEn(extracted?.Name) ?? dictEn(existing?.Name) ?? id
}

function listBossFiles(): string[] {
  if (!fs.existsSync(BOSS_DIR)) return []
  return fs
    .readdirSync(BOSS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
}

// ── Diff helpers ────────────────────────────────────────────────────

type DiffEntry = {
  path: string
  extracted: unknown
  existing: unknown
  kind: 'value' | 'typo' | 'missing-existing' | 'missing-extracted'
}

// CJK fullwidth → halfwidth punctuation. Most diffs across JP/KR/ZH that
// look like "real" changes are actually just the translator using fullwidth
// punctuation in one revision and halfwidth in the next.
// CJK punctuation not covered by Unicode NFKC normalize. NFKC handles
// full-width ASCII (FF01-FF5E) → half-width, half-width katakana → full,
// and most compatibility variants automatically. The table below covers
// the long-tail: smart quotes, ideographic punctuation, Japanese brackets,
// dashes, ellipsis, etc.
const EXTRA_PUNCT: Record<string, string> = {
  '\u2018': "'", // ‘
  '\u2019': "'", // ’
  '\u201C': '"', // “
  '\u201D': '"', // ”
  '\u201A': ',', // ‚
  '\u201E': '"', // „
  '\u2026': '...', // …
  '\u2013': '-', // – (en dash)
  '\u2014': '-', // — (em dash)
  '\u2212': '-', // − (minus)
  '\u3000': ' ', // full-width space
  '\u3001': ',', // 、 (ideographic comma)
  '\u3002': '.', // 。 (ideographic full stop)
  '\u300C': '"', // 「
  '\u300D': '"', // 」
  '\u300E': '"', // 『
  '\u300F': '"', // 』
  '\u3010': '[', // 【
  '\u3011': ']', // 】
  '\u3014': '[', // 〔
  '\u3015': ']', // 〕
  '\u3008': '<', // 〈
  '\u3009': '>', // 〉
  '\u300A': '<', // 《
  '\u300B': '>', // 》
  '\u301C': '~', // 〜 (wave dash)
  '\u30FB': '.', // ・ (katakana middle dot)
  '\uFF64': ',', // ､ (halfwidth ideographic comma, outside FF5E range)
  '\uFF65': '.', // ･ (halfwidth katakana middle dot, outside FF5E range)
}

const EXTRA_PUNCT_RE = new RegExp(`[${Object.keys(EXTRA_PUNCT).join('')}]`, 'g')

// Unicode ranges for CJK / Kana / Hangul — whitespace between two such
// characters is typography, not semantics, so we collapse it away when
// normalizing for typo detection.
const CJK_CLASS =
  '[\\u3040-\\u309F\\u30A0-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7AF\\uF900-\\uFAFF]'
const CJK_SPACE_RE = new RegExp(`(${CJK_CLASS})\\s+(${CJK_CLASS})`, 'g')

function normalize(s: string): string {
  let out = s
    .normalize('NFKC')
    .replace(EXTRA_PUNCT_RE, (c) => EXTRA_PUNCT[c] ?? c)
    // Strip markup-only differences so typo detection ignores them:
    //   - <color=...>...</color> and any other XML-ish tag
    //   - literal `\n` escape sequences and real newlines
    .replace(/<[^>]+>/g, '')
    .replace(/\\n/g, ' ')
    // Drop whitespace around common punctuation (spaces before/after
    // colons, commas, etc. are stylistic noise).
    .replace(/\s*([:,.;!?])\s*/g, '$1')
    .replace(/\s+/g, ' ')
  // Collapse whitespace between adjacent CJK characters. Run twice so
  // overlapping matches get handled (e.g. `가 나 다` → `가나다`).
  out = out.replace(CJK_SPACE_RE, '$1$2').replace(CJK_SPACE_RE, '$1$2')
  return out.trim()
}

function classifyDiff(extracted: unknown, existing: unknown): DiffEntry['kind'] {
  if (extracted == null && existing != null) return 'missing-extracted'
  if (extracted != null && existing == null) return 'missing-existing'
  if (typeof extracted === 'string' && typeof existing === 'string') {
    if (normalize(extracted) === normalize(existing)) return 'typo'
  }
  return 'value'
}

function buildDiffs(
  extracted: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  basePath = ''
): DiffEntry[] {
  if (!existing) return []
  const diffs: DiffEntry[] = []
  const keys = new Set([...Object.keys(extracted), ...Object.keys(existing)])
  for (const k of keys) {
    const p = basePath ? `${basePath}.${k}` : k
    const e = extracted[k]
    const x = existing[k]
    if (e === x) continue
    if (e != null && x != null && typeof e === 'object' && typeof x === 'object' && !Array.isArray(e) && !Array.isArray(x)) {
      diffs.push(...buildDiffs(e as Record<string, unknown>, x as Record<string, unknown>, p))
      continue
    }
    if (Array.isArray(e) && Array.isArray(x)) {
      // Effect lists (buff/debuff/removeBuff/removeDebuff) are unordered
      // sets — ignore element order, only treat membership as a real diff.
      // When the set is identical but ordering differs, emit a single
      // typo-kind diff at the list path so curators can normalize order.
      const keyName = k as string
      const isEffectList =
        (keyName === 'buff' || keyName === 'debuff' || keyName === 'removeBuff' || keyName === 'removeDebuff') &&
        e.every((v) => typeof v === 'string') &&
        x.every((v) => typeof v === 'string')
      if (isEffectList) {
        const es = e as string[]
        const xs = x as string[]
        const eSet = new Set(es)
        const xSet = new Set(xs)
        const setsEqual = eSet.size === xSet.size && [...eSet].every((v) => xSet.has(v))
        if (setsEqual) {
          if (JSON.stringify(es) !== JSON.stringify(xs)) {
            diffs.push({ path: p, extracted: es, existing: xs, kind: 'typo' })
          }
          continue
        }
        // Otherwise fall through to per-index diffing so missing/added
        // elements are reported individually.
      }
      const max = Math.max(e.length, x.length)
      for (let i = 0; i < max; i++) {
        const ei = e[i]
        const xi = x[i]
        if (ei === xi) continue
        if (
          ei != null &&
          xi != null &&
          typeof ei === 'object' &&
          typeof xi === 'object' &&
          !Array.isArray(ei) &&
          !Array.isArray(xi)
        ) {
          diffs.push(
            ...buildDiffs(ei as Record<string, unknown>, xi as Record<string, unknown>, `${p}[${i}]`)
          )
        } else if (JSON.stringify(ei) !== JSON.stringify(xi)) {
          diffs.push({ path: `${p}[${i}]`, extracted: ei, existing: xi, kind: classifyDiff(ei, xi) })
        }
      }
      continue
    }
    if (JSON.stringify(e) !== JSON.stringify(x)) {
      diffs.push({ path: p, extracted: e, existing: x, kind: classifyDiff(e, x) })
    }
  }
  return diffs
}

// ── GET ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    // ─── action=list — existing files + count of NEW boss candidates ─
    if (action === 'list') {
      const existingIds = new Set(listBossFiles().filter((id) => !isUntouchable(parseBossId(id))))
      const items = Array.from(existingIds).map((rawId) => {
        const parsed = parseBossId(rawId)
        const existing = readBossFile(rawId)
        const extracted = extractMonster(parsed.monsterId)
        const name = pickName(extracted as Record<string, unknown> | null, existing, rawId)
        return { id: rawId, name, existsInJson: true }
      })
      items.sort((a, b) => a.name.localeCompare(b.name))

      // "new" count: boss-candidates from game data that have at least one
      // supported location and aren't tracked locally yet.
      const trackedMonsterIds = new Set(
        Array.from(existingIds).map((r) => parseBossId(r).monsterId).filter(Boolean)
      )
      let newCount = 0
      for (const m of listMonsters({ types: BOSS_TYPES })) {
        if (trackedMonsterIds.has(m.ID)) continue
        const ex = extractMonster(m.ID)
        if (ex && (ex._allLocations?.length ?? 0) > 0) newCount++
      }

      return NextResponse.json({ items, entries: items, new: newCount })
    }

    // ─── action=search — for the CREATE flow ────────────────────────
    if (action === 'search') {
      const q = (searchParams.get('q') ?? '').trim()
      if (!q) return NextResponse.json({ items: [] })

      const monsters = listMonsters({ types: BOSS_TYPES })
      const hits = searchMonstersByName(monsters, q)

      // Enrich with type so the UI can group/badge results
      const byId = new Map(monsters.map((m) => [m.ID, m]))
      const items = hits.map((h) => ({
        id: h.id,
        name: h.name,
        type: byId.get(h.id)?.Type ?? null,
        existsLocally: fs.existsSync(path.join(BOSS_DIR, `${h.id}.json`)),
      }))
      return NextResponse.json({ items })
    }

    // ─── action=extract — full extraction for one monster ───────────
    if (action === 'extract') {
      const rawId = searchParams.get('id')
      if (!rawId) return NextResponse.json({ error: 'missing id' }, { status: 400 })
      const parsed = parseBossId(rawId)
      if (isUntouchable(parsed)) {
        return NextResponse.json({ error: 'archived or misc file' }, { status: 400 })
      }
      // Explicit ?dungeonId= overrides the variant suffix from the id.
      const dungeonId = searchParams.get('dungeonId') ?? parsed.variantDungeonId ?? undefined
      const raw = extractMonster(parsed.monsterId, dungeonId ? { dungeonId } : undefined)
      if (!raw) return NextResponse.json({ error: 'not found' }, { status: 404 })
      inheritParentLocation(raw, parsed.parentId, dungeonId)
      const existing = readBossFile(rawId)
      const merged = mergeWithExisting(stripInternalFields(raw), existing) as Record<string, unknown>
      merged.id = rawId // preserve composite id in saved file
      if (parsed.parentId) merged.summoned_by = parsed.parentId
      return NextResponse.json({ extracted: merged, locations: raw._allLocations ?? [] })
    }

    // ─── action=compare-one — extracted + existing + diffs (single id) ─
    if (action === 'compare-one') {
      const rawId = searchParams.get('id')
      if (!rawId) return NextResponse.json({ error: 'missing id' }, { status: 400 })
      const parsed = parseBossId(rawId)
      if (isUntouchable(parsed)) {
        return NextResponse.json({ error: 'archived or misc file' }, { status: 400 })
      }
      const raw = extractMonster(
        parsed.monsterId,
        parsed.variantDungeonId ? { dungeonId: parsed.variantDungeonId } : undefined
      )
      if (!raw) return NextResponse.json({ error: 'not found' }, { status: 404 })
      inheritParentLocation(raw, parsed.parentId, parsed.variantDungeonId ?? undefined)
      const existing = readBossFile(rawId)
      const extracted = mergeWithExisting(stripInternalFields(raw), existing) as Record<string, unknown>
      extracted.id = rawId
      if (parsed.parentId) extracted.summoned_by = parsed.parentId
      const diffs = buildDiffs(extracted, existing)
      return NextResponse.json({ extracted, existing, diffs })
    }

    // ─── action=compare — diff every existing data/boss/*.json ──────
    if (action === 'compare') {
      const ids = listBossFiles().filter((id) => !isUntouchable(parseBossId(id)))
      const results = ids.map((rawId) => {
        const parsed = parseBossId(rawId)
        const existing = readBossFile(rawId)

        const raw = extractMonster(
          parsed.monsterId,
          parsed.variantDungeonId ? { dungeonId: parsed.variantDungeonId } : undefined
        )
        inheritParentLocation(raw, parsed.parentId, parsed.variantDungeonId ?? undefined)
        const extracted = raw
          ? (mergeWithExisting(stripInternalFields(raw), existing) as Record<string, unknown>)
          : null
        if (extracted) {
          extracted.id = rawId
          if (parsed.parentId) extracted.summoned_by = parsed.parentId
        }
        const name = pickName(extracted, existing, rawId)

        if (!extracted || !raw) {
          return { id: rawId, name, status: 'missing' as const, diffs: [] as DiffEntry[], modes: [] as string[] }
        }
        // For summon entries, inherit modes from the parent boss as well.
        const allLocs = raw._allLocations ?? []
        const modeSet = new Set(allLocs.map((l) => l.modeLabel).filter(Boolean))
        if (parsed.parentId) {
          const parent = extractMonster(parsed.parentId)
          for (const l of parent?._allLocations ?? []) {
            if (l.modeLabel) modeSet.add(l.modeLabel)
          }
        }
        const diffs = buildDiffs(extracted, existing)
        return { id: rawId, name, status: 'ok' as const, diffs, modes: Array.from(modeSet) }
      })
      const withDiffs = results.filter((r) => r.diffs.length > 0).length
      const ok = results.length - withDiffs
      return NextResponse.json({ total: results.length, ok, withDiffs, results })
    }

    // ─── action=compare-by-mode — dashboard breakdown ───────────────
    if (action === 'compare-by-mode') {
      const ids = listBossFiles()
      const byMode: Record<
        string,
        { total: number; ok: number; withDiffs: number; diffs: { file: string; name: string }[] }
      > = {}
      for (const rawId of ids) {
        const parsed = parseBossId(rawId)
        if (isUntouchable(parsed)) continue
        const raw = extractMonster(
          parsed.monsterId,
          parsed.variantDungeonId ? { dungeonId: parsed.variantDungeonId } : undefined
        )
        if (!raw) continue
        inheritParentLocation(raw, parsed.parentId, parsed.variantDungeonId ?? undefined)
        const existing = readBossFile(rawId)
        const extracted = mergeWithExisting(stripInternalFields(raw), existing) as Record<string, unknown>
        extracted.id = rawId
        if (parsed.parentId) extracted.summoned_by = parsed.parentId
        const diffs = buildDiffs(extracted, existing)
        const name = pickName(extracted, existing, rawId)
        const labels = new Set<string>(
          (raw._allLocations ?? []).map((l) => l.modeLabel).filter(Boolean)
        )
        if (parsed.parentId) {
          const parent = extractMonster(parsed.parentId)
          for (const l of parent?._allLocations ?? []) {
            if (l.modeLabel) labels.add(l.modeLabel)
          }
        }
        if (labels.size === 0) labels.add('Unmapped')
        for (const label of labels) {
          if (!byMode[label]) byMode[label] = { total: 0, ok: 0, withDiffs: 0, diffs: [] }
          byMode[label].total++
          if (diffs.length > 0) {
            byMode[label].withDiffs++
            byMode[label].diffs.push({ file: `${rawId}.json`, name })
          } else {
            byMode[label].ok++
          }
        }
      }
      return NextResponse.json({ byMode })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── POST — save a monster JSON ──────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; data?: Record<string, unknown> }
    if (!body.id || !body.data) {
      return NextResponse.json({ error: 'missing id or data' }, { status: 400 })
    }
    if (isUntouchable(parseBossId(body.id))) {
      return NextResponse.json({ error: 'archived files are read-only' }, { status: 403 })
    }
    if (!fs.existsSync(BOSS_DIR)) fs.mkdirSync(BOSS_DIR, { recursive: true })
    const filePath = path.join(BOSS_DIR, `${body.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(body.data, null, 2) + '\n', 'utf-8')
    return NextResponse.json({ ok: true, path: `data/boss/${body.id}.json` })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
