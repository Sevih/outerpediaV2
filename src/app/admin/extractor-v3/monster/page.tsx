'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API = '/api/admin/extractor-v3/monster'

// ── Types ───────────────────────────────────────────────────────────

type DiffKind = 'value' | 'typo' | 'missing-existing' | 'missing-extracted' | 'asset-missing'
interface DiffEntry {
  path: string
  extracted: unknown
  existing: unknown
  kind: DiffKind
}

interface CompareEntry {
  id: string
  name: string
  status: 'new' | 'ok' | 'diff' | 'typo' | 'asset' | 'missing'
  diffCount: number
  typoCount: number
  assetCount: number
  diffs: DiffEntry[]
  modes: string[]
}

interface SearchHit {
  id: string
  name: string
  type: string | null
  existsLocally: boolean
  /** Set when the search matched a location (mode/dungeon/area). */
  matchedDungeon?: { id: string; name: string; mode: string }
}

interface MonsterLocation {
  mode: string
  modeLabel: string
  dungeonId: string
  dungeonName: string | null
  areaName: string | null
  position: number
  slot: number
  level: number
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatValue(val: unknown): string {
  if (val === undefined) return ''
  if (val === null) return 'null'
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

// Apply a value to an object via a dotted path. Supports array indices via
// `[N]` notation. Used to patch typo-only fields without touching siblings.
//   setByPath(obj, 'location.mode.jp', 'X')
//   setByPath(obj, 'skills[0].name.zh', 'X')
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts: (string | number)[] = []
  for (const seg of path.split('.')) {
    const m = seg.match(/^([^\[]+)((?:\[\d+\])*)$/)
    if (!m) {
      parts.push(seg)
      continue
    }
    parts.push(m[1])
    const idx = m[2]
    if (idx) {
      for (const n of idx.matchAll(/\[(\d+)\]/g)) parts.push(parseInt(n[1], 10))
    }
  }
  let cur: unknown = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return
    cur = (cur as Record<string | number, unknown>)[parts[i]]
  }
  if (cur == null || typeof cur !== 'object') return
  ;(cur as Record<string | number, unknown>)[parts[parts.length - 1]] = value
}

function StatusBadge({ entry }: { entry: CompareEntry }) {
  if (entry.status === 'new') return <span className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-400">NEW</span>
  if (entry.status === 'ok') return <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
  if (entry.status === 'missing') return <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">MISSING</span>
  return (
    <span className="flex gap-1">
      {entry.diffCount > 0 && <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-[10px] text-yellow-400">{entry.diffCount} diff</span>}
      {entry.typoCount > 0 && <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">{entry.typoCount} typo</span>}
      {entry.assetCount > 0 && <span className="rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] text-purple-300">{entry.assetCount} asset</span>}
    </span>
  )
}

// ── Compare tab ─────────────────────────────────────────────────────

function CompareTab() {
  const [entries, setEntries] = useState<CompareEntry[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'diff' | 'typo' | 'asset' | 'new' | 'ok' | 'missing'>('all')
  const [expandedModes, setExpandedModes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [extractedCache, setExtractedCache] = useState<Map<string, unknown>>(new Map())
  const [fixingTypos, setFixingTypos] = useState(false)
  const [fixingModes, setFixingModes] = useState(false)
  const [fixingAssets, setFixingAssets] = useState(false)

  const loadAndCompare = useCallback(async () => {
    setComparing(true)
    try {
      const res = await fetch(`${API}?action=compare`)
      const data = await res.json()
      const results: CompareEntry[] = (data.results ?? []).map((r: { id: string; name: string; status?: string; diffs: DiffEntry[]; modes?: string[] }) => {
        const modes = r.modes ?? []
        if (r.status === 'missing') {
          return { id: r.id, name: r.name, status: 'missing' as const, diffCount: 0, typoCount: 0, assetCount: 0, diffs: [], modes }
        }
        const diffCount = r.diffs.filter((d) => d.kind === 'value' || d.kind === 'missing-existing' || d.kind === 'missing-extracted').length
        const typoCount = r.diffs.filter((d) => d.kind === 'typo').length
        const assetCount = r.diffs.filter((d) => d.kind === 'asset-missing').length
        const status =
          diffCount > 0 ? ('diff' as const)
          : typoCount > 0 ? ('typo' as const)
          : assetCount > 0 ? ('asset' as const)
          : ('ok' as const)
        return { id: r.id, name: r.name, status, diffCount, typoCount, assetCount, diffs: r.diffs, modes }
      })
      results.sort((a, b) => {
        if (a.diffCount !== b.diffCount) return b.diffCount - a.diffCount
        if (a.typoCount !== b.typoCount) return b.typoCount - a.typoCount
        if (a.assetCount !== b.assetCount) return b.assetCount - a.assetCount
        return a.name.localeCompare(b.name)
      })
      setEntries(results)
    } finally {
      setLoading(false)
      setComparing(false)
    }
  }, [])

  useEffect(() => {
    loadAndCompare()
  }, [loadAndCompare])

  async function handleFixAllTypos() {
    const withTypos = entries.filter((e) => e.typoCount > 0)
    if (withTypos.length === 0) return
    setFixingTypos(true)
    setSaveMessage({ text: `Fixing typos in ${withTypos.length} entry(ies)...`, type: 'info' })
    let fixedEntries = 0
    let fixedTypos = 0
    let failed = 0
    for (const e of withTypos) {
      try {
        // Re-fetch existing + fresh diffs (the cached compare data may be stale)
        const cmpRes = await fetch(`${API}?action=compare-one&id=${e.id}`)
        const cmpData = await cmpRes.json()
        if (!cmpRes.ok || !cmpData.existing) {
          failed++
          continue
        }
        const existing = cmpData.existing as Record<string, unknown>
        const typoDiffs: DiffEntry[] = (cmpData.diffs ?? []).filter((d: DiffEntry) => d.kind === 'typo')
        if (typoDiffs.length === 0) continue
        for (const t of typoDiffs) {
          setByPath(existing, t.path, t.extracted)
          fixedTypos++
        }
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: e.id, data: existing }),
        })
        if (res.ok) fixedEntries++
        else failed++
      } catch {
        failed++
      }
    }
    setSaveMessage({
      text:
        failed > 0
          ? `Fixed ${fixedTypos} typo(s) in ${fixedEntries} entry(ies) (${failed} failed)`
          : `Fixed ${fixedTypos} typo(s) in ${fixedEntries} entry(ies)`,
      type: failed > 0 ? 'error' : 'success',
    })
    setFixingTypos(false)
    await loadAndCompare()
  }

  async function handleFixAllModes() {
    const withModeDiffs = entries.filter((e) =>
      e.diffs.some((d) => d.path.startsWith('location.mode.'))
    )
    if (withModeDiffs.length === 0) return
    setFixingModes(true)
    setSaveMessage({ text: `Fixing modes in ${withModeDiffs.length} entry(ies)...`, type: 'info' })
    let fixedEntries = 0
    let fixedFields = 0
    let failed = 0
    for (const e of withModeDiffs) {
      try {
        const cmpRes = await fetch(`${API}?action=compare-one&id=${e.id}`)
        const cmpData = await cmpRes.json()
        if (!cmpRes.ok || !cmpData.existing) {
          failed++
          continue
        }
        const existing = cmpData.existing as Record<string, unknown>
        const modeDiffs: DiffEntry[] = (cmpData.diffs ?? []).filter((d: DiffEntry) =>
          d.path.startsWith('location.mode.')
        )
        if (modeDiffs.length === 0) continue
        for (const m of modeDiffs) {
          setByPath(existing, m.path, m.extracted)
          fixedFields++
        }
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: e.id, data: existing }),
        })
        if (res.ok) fixedEntries++
        else failed++
      } catch {
        failed++
      }
    }
    setSaveMessage({
      text:
        failed > 0
          ? `Fixed ${fixedFields} mode field(s) in ${fixedEntries} entry(ies) (${failed} failed)`
          : `Fixed ${fixedFields} mode field(s) in ${fixedEntries} entry(ies)`,
      type: failed > 0 ? 'error' : 'success',
    })
    setFixingModes(false)
    await loadAndCompare()
  }

  async function handleFixAllAssets() {
    const withAssetDiffs = entries.filter((e) => e.assetCount > 0)
    if (withAssetDiffs.length === 0) return
    setFixingAssets(true)
    setSaveMessage({ text: `Copying assets for ${withAssetDiffs.length} entry(ies)...`, type: 'info' })
    let totalCopied = 0
    let totalMissingSource = 0
    let failed = 0
    for (const e of withAssetDiffs) {
      try {
        const res = await fetch(`${API}?action=copy-assets&id=${e.id}`)
        const data = await res.json()
        if (!res.ok) { failed++; continue }
        totalCopied += (data.copied as string[] | undefined)?.length ?? 0
        totalMissingSource += (data.missingSource as string[] | undefined)?.length ?? 0
      } catch {
        failed++
      }
    }
    setSaveMessage({
      text:
        failed > 0 || totalMissingSource > 0
          ? `Copied ${totalCopied} asset(s), ${totalMissingSource} source missing${failed > 0 ? `, ${failed} failed` : ''}`
          : `Copied ${totalCopied} asset(s)`,
      type: failed > 0 || totalMissingSource > 0 ? 'error' : 'success',
    })
    setFixingAssets(false)
    await loadAndCompare()
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setSaveMessage(null)
    try {
      // Re-extract before save to get the freshest data
      const exRes = await fetch(`${API}?action=extract&id=${selected}`)
      const exData = await exRes.json()
      if (!exRes.ok) {
        setSaveMessage({ text: `Error: ${exData.error ?? 'extract failed'}`, type: 'error' })
        return
      }
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected, data: exData.extracted }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveMessage({ text: `Error: ${data.error ?? 'save failed'}`, type: 'error' })
        return
      }
      setSaveMessage({ text: 'Saved', type: 'success' })
      await loadAndCompare()
    } catch (e) {
      setSaveMessage({ text: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const selectedEntry = entries.find((e) => e.id === selected)

  // Lazily fetch extracted JSON for the selected entry (for preview)
  useEffect(() => {
    if (!selected || extractedCache.has(selected)) return
    fetch(`${API}?action=extract&id=${selected}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.extracted) {
          setExtractedCache((prev) => new Map(prev).set(selected, d.extracted))
        }
      })
      .catch(() => {})
  }, [selected, extractedCache])

  const filtered = entries.filter((e) => {
    if (filter === 'diff') {
      if (e.diffCount === 0) return false
    } else if (filter === 'typo') {
      if (e.typoCount === 0) return false
    } else if (filter === 'asset') {
      if (e.assetCount === 0) return false
    } else if (filter !== 'all') {
      if (e.status !== filter) return false
    }
    if (search) {
      const s = search.toLowerCase()
      return e.name.toLowerCase().includes(s) || e.id.includes(s)
    }
    return true
  })

  // Group filtered entries by mode (a boss can appear in several groups).
  // Bosses with no mode go to "Unmapped".
  const UNMAPPED = '(Unmapped)'
  const grouped = new Map<string, CompareEntry[]>()
  for (const e of filtered) {
    const labels = e.modes.length > 0 ? e.modes : [UNMAPPED]
    for (const label of labels) {
      let arr = grouped.get(label)
      if (!arr) {
        arr = []
        grouped.set(label, arr)
      }
      arr.push(e)
    }
  }
  // Sort: groups with diffs first, then alphabetical
  const groupList = Array.from(grouped.entries())
    .map(([label, items]) => ({
      label,
      items: items.sort((a, b) => {
        if (a.diffCount !== b.diffCount) return b.diffCount - a.diffCount
        return a.name.localeCompare(b.name)
      }),
      diffCount: items.filter((i) => i.diffCount > 0).length,
      typoCount: items.filter((i) => i.typoCount > 0).length,
      assetCount: items.filter((i) => i.assetCount > 0).length,
      missingCount: items.filter((i) => i.status === 'missing').length,
      okCount: items.filter((i) => i.status === 'ok').length,
    }))
    .sort((a, b) => {
      if (a.diffCount !== b.diffCount) return b.diffCount - a.diffCount
      return a.label.localeCompare(b.label)
    })

  function toggleMode(label: string) {
    setExpandedModes((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // While searching, auto-expand all groups so the user sees the matches.
  // Otherwise the expand state is purely controlled by user clicks.
  const visibleExpanded = search
    ? new Set(groupList.map((g) => g.label))
    : expandedModes

  if (loading) return <div className="flex justify-center py-20 text-zinc-500">Loading...</div>

  return (
    <div className="flex gap-6 h-[calc(100vh-150px)]">
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Existing bosses</h2>
          <div className="flex shrink-0 gap-1">
            {entries.filter((e) => e.typoCount > 0).length > 0 && (
              <button
                onClick={handleFixAllTypos}
                disabled={fixingTypos || comparing}
                className="rounded bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-600 disabled:opacity-50"
                title="Re-save every entry whose only diffs are typos"
              >
                {fixingTypos ? 'Fixing...' : 'Fix all typos'}
              </button>
            )}
            {entries.some((e) => e.diffs.some((d) => d.path.startsWith('location.mode.'))) && (
              <button
                onClick={handleFixAllModes}
                disabled={fixingModes || comparing}
                className="rounded bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-600 disabled:opacity-50"
                title="Patch every location.mode field with the extracted value"
              >
                {fixingModes ? 'Fixing...' : 'Fix all modes'}
              </button>
            )}
            {entries.some((e) => e.assetCount > 0) && (
              <button
                onClick={handleFixAllAssets}
                disabled={fixingAssets || comparing}
                className="rounded bg-purple-700/80 px-2.5 py-1 text-xs font-semibold text-purple-100 transition hover:bg-purple-600 disabled:opacity-50"
                title="Copy every missing boss asset (portrait, ATB, skill icons) from datamine"
              >
                {fixingAssets ? 'Copying...' : 'Fix all assets'}
              </button>
            )}
            <button
              onClick={loadAndCompare}
              disabled={comparing}
              className="rounded bg-amber-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-amber-500 disabled:opacity-50"
            >
              {comparing ? 'Comparing...' : 'Compare All'}
            </button>
          </div>
        </div>
        <div className="mb-2 flex items-center gap-3 text-xs">
          <span className="text-zinc-500">{entries.length} total</span>
          <span className="text-green-400">{entries.filter((e) => e.status === 'ok').length} ok</span>
          <span className="text-yellow-400">{entries.filter((e) => e.diffCount > 0).length} diff</span>
          <span className="text-zinc-400">{entries.filter((e) => e.typoCount > 0).length} typo</span>
          <span className="text-purple-300">{entries.filter((e) => e.assetCount > 0).length} asset</span>
          <span className="text-blue-400">{entries.filter((e) => e.status === 'new').length} new</span>
          <span className="text-red-400">{entries.filter((e) => e.status === 'missing').length} missing</span>
        </div>
        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="mb-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none" />
        <div className="mb-3 flex gap-1 text-xs">
          {(['all', 'diff', 'typo', 'asset', 'new', 'ok', 'missing'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 ${filter === f ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 space-y-1">
          {groupList.map((g) => {
            const open = visibleExpanded.has(g.label)
            return (
              <div key={g.label}>
                <button
                  onClick={() => toggleMode(g.label)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-semibold text-zinc-200 hover:bg-zinc-800/60"
                >
                  <span className={`text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                  <span className="flex-1 truncate">{g.label}</span>
                  <span className="text-xs text-zinc-500">{g.items.length}</span>
                  {g.diffCount > 0 && <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-[10px] text-yellow-400">{g.diffCount}</span>}
                  {g.typoCount > 0 && <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">{g.typoCount}</span>}
                  {g.assetCount > 0 && <span className="rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] text-purple-300">{g.assetCount}</span>}
                  {g.missingCount > 0 && <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">{g.missingCount}</span>}
                </button>
                {open && (
                  <div className="ml-4 border-l border-zinc-800 pl-2 space-y-0.5">
                    {g.items.map((e) => (
                      <button
                        key={`${g.label}:${e.id}`}
                        onClick={() => { setSelected(e.id); setSaveMessage(null) }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-zinc-800 hover:text-zinc-200 ${selected === e.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400'}`}
                      >
                        <span className="flex-1 truncate">{e.name}</span>
                        <StatusBadge entry={e} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selected && <div className="flex items-center justify-center h-full text-zinc-600">Select a boss to view details</div>}

        {selected && selectedEntry && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold">{selectedEntry.name}</h3>
              <span className="font-mono text-xs text-zinc-600">{selectedEntry.id}</span>
              <StatusBadge entry={selectedEntry} />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving}
                className="rounded bg-green-600/80 px-3 py-1 text-xs font-semibold transition hover:bg-green-500 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              {saveMessage && (
                <span className={`text-xs ${saveMessage.type === 'error' ? 'text-red-400' : saveMessage.type === 'success' ? 'text-green-400' : 'text-zinc-400'}`}>
                  {saveMessage.text}
                </span>
              )}
            </div>

            {selectedEntry.diffs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-400">
                  {selectedEntry.diffCount} difference{selectedEntry.diffCount !== 1 ? 's' : ''}
                  {selectedEntry.typoCount > 0 && ` · ${selectedEntry.typoCount} typo${selectedEntry.typoCount !== 1 ? 's' : ''}`}
                  {selectedEntry.assetCount > 0 && ` · ${selectedEntry.assetCount} asset${selectedEntry.assetCount !== 1 ? 's' : ''}`}
                </h4>
                {selectedEntry.diffs.filter((d) => d.kind !== 'typo' && d.kind !== 'asset-missing').length > 0 && (
                  <table className="w-full text-xs">
                    <thead><tr className="text-zinc-500"><th className="py-0.5 pr-3 text-left font-medium">Field</th><th className="py-0.5 pr-3 text-left font-medium">Existing</th><th className="py-0.5 text-left font-medium">Extracted</th></tr></thead>
                    <tbody>
                      {selectedEntry.diffs.filter((d) => d.kind !== 'typo' && d.kind !== 'asset-missing').map((d, i) => (
                        <tr key={i} className="border-t border-zinc-800/50">
                          <td className="py-1 pr-3 font-mono text-zinc-400 whitespace-nowrap">{d.path}</td>
                          <td className="py-1 pr-3 bg-red-950/20 whitespace-pre-wrap break-all">{formatValue(d.existing)}</td>
                          <td className="py-1 bg-green-950/20 whitespace-pre-wrap break-all">{formatValue(d.extracted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {selectedEntry.diffs.filter((d) => d.kind === 'typo').length > 0 && (
                  <details className="rounded border border-zinc-800/50 p-1.5">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                      {selectedEntry.typoCount} typo{selectedEntry.typoCount !== 1 ? 's' : ''} (punctuation / whitespace)
                    </summary>
                    <div className="ml-4 mt-1 space-y-0.5 text-[11px] text-zinc-600 font-mono">
                      {selectedEntry.diffs.filter((d) => d.kind === 'typo').map((d, i) => (
                        <div key={i}>{d.path}</div>
                      ))}
                    </div>
                  </details>
                )}
                {selectedEntry.diffs.filter((d) => d.kind === 'asset-missing').length > 0 && (
                  <details open className="rounded border border-purple-800/40 p-1.5">
                    <summary className="cursor-pointer text-xs text-purple-300 hover:text-purple-200">
                      {selectedEntry.assetCount} missing asset{selectedEntry.assetCount !== 1 ? 's' : ''}
                    </summary>
                    <div className="ml-4 mt-1 space-y-0.5 text-[11px] text-zinc-500 font-mono">
                      {selectedEntry.diffs.filter((d) => d.kind === 'asset-missing').map((d, i) => (
                        <div key={i} className="break-all">
                          <span className="text-purple-300">{d.path}</span>
                          <div className="text-zinc-600">src: {formatValue(d.extracted)}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {selectedEntry.diffs.length === 0 && <p className="text-sm text-green-400">No differences</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Create tab ──────────────────────────────────────────────────────

function CreateTab() {
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'name' | 'location'>('name')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null)
  const [extractedFiltered, setExtractedFiltered] = useState<Record<string, unknown> | null>(null)
  const [availableLocations, setAvailableLocations] = useState<MonsterLocation[]>([])
  const [chosenDungeon, setChosenDungeon] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`${API}?action=search&q=${encodeURIComponent(query)}&mode=${searchMode}`)
        const data = await res.json()
        setHits(data.items ?? [])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [query, searchMode])

  async function loadExtracted(id: string, preselectDungeonId?: string) {
    setSelected(id)
    setExtracted(null)
    setExtractedFiltered(null)
    setAvailableLocations([])
    // Pre-select the dungeon when the hit came from a location-mode search
    // so the user doesn't have to re-pick it in the dropdown afterwards.
    setChosenDungeon(preselectDungeonId ?? null)
    setSummonedBy('')
    setSaveMessage(null)
    const res = await fetch(`${API}?action=extract&id=${id}`)
    const data = await res.json()
    if (data.extracted) setExtracted(data.extracted)
    if (Array.isArray(data.locations)) setAvailableLocations(data.locations)
  }

  // When chosenDungeon changes, re-extract with the filter
  useEffect(() => {
    if (!selected || !chosenDungeon) {
      setExtractedFiltered(null)
      return
    }
    fetch(`${API}?action=extract&id=${selected}&dungeonId=${chosenDungeon}`)
      .then((r) => r.json())
      .then((d) => setExtractedFiltered(d.extracted ?? null))
      .catch(() => {})
  }, [selected, chosenDungeon])

  // Summon mode: the selected monster is invoked by another boss.
  // Stored separately because it needs its own search input.
  const [summonedBy, setSummonedBy] = useState<string>('')

  // Save id is suggested automatically:
  //   - default: the monster id
  //   - if "summoned by" is set: <id>S<parentId>
  //   - if a specific dungeon is chosen AND the file already exists: <id>@<dungeonId>
  //   These three modifiers can in theory combine but in practice users pick one;
  //   the precedence is summon > variant > base.
  const selectedHit = hits.find((h) => h.id === selected)
  const suggestedSaveId = (() => {
    if (!selected) return ''
    if (summonedBy.trim()) return `${selected}S${summonedBy.trim()}`
    if (chosenDungeon && selectedHit?.existsLocally) return `${selected}@${chosenDungeon}`
    return selected
  })()
  const [saveIdOverride, setSaveIdOverride] = useState<string | null>(null)
  // Reset the override whenever the suggested id changes (new selection / dungeon / parent).
  useEffect(() => {
    setSaveIdOverride(null)
  }, [suggestedSaveId])
  const finalSaveId = saveIdOverride ?? suggestedSaveId

  async function handleSave() {
    if (!selected || !extracted || !finalSaveId) return
    const baseData = (extractedFiltered ?? extracted) as Record<string, unknown>
    // Stamp the composite id so the saved file matches its filename.
    // Also stamp `summoned_by` when a parent boss is set.
    const dataToSave: Record<string, unknown> = { ...baseData, id: finalSaveId }
    if (summonedBy.trim()) dataToSave.summoned_by = summonedBy.trim()
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: finalSaveId, data: dataToSave }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveMessage({ text: `Error: ${data.error ?? 'save failed'}`, type: 'error' })
        return
      }
      setSaveMessage({ text: `Saved → ${data.path}`, type: 'success' })
    } catch (e) {
      setSaveMessage({ text: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const dungeonOptions = Array.from(
    new Map(availableLocations.map((l) => [l.dungeonId, l])).values()
  )

  return (
    <div className="flex gap-6 h-[calc(100vh-150px)]">
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <h2 className="mb-3 text-lg font-bold">Search monster</h2>
        <div className="mb-2 flex gap-1 text-xs">
          {(['name', 'location'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSearchMode(m)}
              className={`rounded px-2 py-1 ${searchMode === m ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {m === 'name' ? 'By name / id' : 'By location'}
            </button>
          ))}
        </div>
        <input
          type="text"
          autoFocus
          autoComplete="off"
          suppressHydrationWarning
          placeholder={searchMode === 'location' ? 'Type a mode / dungeon / area...' : 'Type a name (en) or id...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <div className="mb-2 text-xs text-zinc-500">
          {searching ? 'Searching...' : `${hits.length} hit${hits.length !== 1 ? 's' : ''}`}
        </div>
        <div className="overflow-y-auto flex-1 space-y-0.5">
          {hits.map((h) => (
            <button
              key={h.id + (h.matchedDungeon?.id ?? '')}
              onClick={() => loadExtracted(h.id, h.matchedDungeon?.id)}
              className={`flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-800 hover:text-zinc-200 ${selected === h.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400'}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate">{h.name}</span>
                <span className="font-mono text-[10px] text-zinc-600">{h.id}</span>
                {h.existsLocally && <span className="rounded bg-green-900/30 px-1 py-0.5 text-[9px] text-green-400">EXISTS</span>}
              </div>
              {h.matchedDungeon && (
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span className="rounded bg-purple-900/30 px-1 py-0.5 text-purple-300">{h.matchedDungeon.mode}</span>
                  <span className="truncate">{h.matchedDungeon.name || `Dungeon ${h.matchedDungeon.id}`}</span>
                  <span className="font-mono text-zinc-600">@{h.matchedDungeon.id}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selected && <div className="flex items-center justify-center h-full text-zinc-600">Search and select a monster</div>}

        {selected && !extracted && <div className="text-zinc-500">Loading...</div>}

        {selected && extracted && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold">{(extracted.Name as { en?: string } | undefined)?.en ?? selected}</h3>
              <span className="font-mono text-xs text-zinc-600">{selected}</span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{String(extracted.type ?? '')}</span>
            </div>

            {dungeonOptions.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">
                  Found in {dungeonOptions.length} location{dungeonOptions.length !== 1 ? 's' : ''} — pick one to scope (optional):
                </label>
                <select
                  value={chosenDungeon ?? ''}
                  onChange={(e) => setChosenDungeon(e.target.value || null)}
                  className="w-full max-w-2xl rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                >
                  <option value="">All locations ({dungeonOptions.length} dungeons, {availableLocations.length} spawns)</option>
                  {dungeonOptions.map((l) => (
                    <option key={l.dungeonId} value={l.dungeonId}>
                      [{l.modeLabel}] {l.dungeonName ?? l.dungeonId} {l.areaName ? `— ${l.areaName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">
                Summoned by <span className="font-normal text-zinc-600">(parent boss id, if this is a minion)</span>
              </label>
              <input
                type="text"
                value={summonedBy}
                onChange={(e) => setSummonedBy(e.target.value)}
                placeholder="e.g. 407600850"
                className="w-full max-w-md rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">
                Save as id <span className="font-normal text-zinc-600">(suggested: {suggestedSaveId})</span>
              </label>
              <input
                type="text"
                value={finalSaveId}
                onChange={(e) => setSaveIdOverride(e.target.value)}
                className="w-full max-w-md rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm focus:border-zinc-500 focus:outline-none"
              />
              {chosenDungeon && selectedHit?.existsLocally && finalSaveId === selected && (
                <p className="text-xs text-amber-400">
                  ⚠ This will overwrite the existing entry. Add `@{chosenDungeon}` to save as a variant.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving || !finalSaveId}
                className="rounded bg-green-600/80 px-3 py-1 text-xs font-semibold transition hover:bg-green-500 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              {saveMessage && (
                <span className={`text-xs ${saveMessage.type === 'error' ? 'text-red-400' : saveMessage.type === 'success' ? 'text-green-400' : 'text-zinc-400'}`}>
                  {saveMessage.text}
                </span>
              )}
            </div>

            <pre className="rounded bg-zinc-950 p-3 text-[10px] text-zinc-300 overflow-x-auto max-h-[60vh]">
              {JSON.stringify(extractedFiltered ?? extracted, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page shell with tabs ────────────────────────────────────────────

function MonsterPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const tab = (params.get('tab') === 'create' ? 'create' : 'compare') as 'create' | 'compare'

  const setTab = (t: 'create' | 'compare') => {
    const sp = new URLSearchParams(params.toString())
    sp.set('tab', t)
    router.replace(`?${sp.toString()}`)
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Monster extractor v3</h1>
        <div className="flex gap-1 rounded border border-zinc-800 p-0.5">
          <button
            onClick={() => setTab('compare')}
            className={`rounded px-3 py-1 text-xs font-semibold ${tab === 'compare' ? 'bg-blue-600/30 text-blue-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Compare
          </button>
          <button
            onClick={() => setTab('create')}
            className={`rounded px-3 py-1 text-xs font-semibold ${tab === 'create' ? 'bg-blue-600/30 text-blue-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Create
          </button>
        </div>
      </div>

      {tab === 'compare' ? <CompareTab /> : <CreateTab />}
    </div>
  )
}

export default function MonsterPage() {
  return (
    <Suspense fallback={<div className="p-4 text-zinc-500">Loading...</div>}>
      <MonsterPageInner />
    </Suspense>
  )
}
