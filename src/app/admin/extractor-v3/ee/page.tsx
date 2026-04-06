'use client'

import { useState, useEffect, useCallback } from 'react'

interface EEEntry {
  id: string
  name: string
  exists: boolean
}

interface DiffEntry {
  key: string
  type: 'changed' | 'typo'
  extracted: unknown
  existing: unknown
}

interface CompareEntry {
  id: string
  name: string
  status: 'new' | 'ok' | 'diff' | 'typo'
  diffCount: number
  typoCount: number
  diffs: DiffEntry[]
}

const API = '/api/admin/extractor-v3/ee'

function formatValue(val: unknown): string {
  if (val === undefined) return ''
  if (val === null) return 'null'
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function isRichText(key: string) {
  return key.includes('effect') || key.includes('mainStat')
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(<color=[^>]+>[^<]*<\/color>|\\n)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part === '\\n') return <br key={i} />
        const colorMatch = part.match(/^<color=([^>]+)>([^<]*)<\/color>$/)
        if (colorMatch) {
          return <span key={i} style={{ color: colorMatch[1] }}>{colorMatch[2]}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function CellContent({ value, richText }: { value: unknown; richText: boolean }) {
  const str = formatValue(value)
  if (richText && typeof value === 'string') return <RichText text={str} />
  return <span className="whitespace-pre-wrap break-all">{str}</span>
}

function StatusBadge({ entry }: { entry: CompareEntry }) {
  if (entry.status === 'new') return <span className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-400">NEW</span>
  if (entry.status === 'ok') return <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
  return (
    <span className="flex gap-1">
      {entry.diffCount > 0 && (
        <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-[10px] text-yellow-400">{entry.diffCount} diff</span>
      )}
      {entry.typoCount > 0 && (
        <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">{entry.typoCount} typo</span>
      )}
    </span>
  )
}

export default function ExtractorV3EEPage() {
  const [entries, setEntries] = useState<EEEntry[]>([])
  const [compareEntries, setCompareEntries] = useState<CompareEntry[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'diff' | 'typo' | 'new' | 'ok'>('all')
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [compared, setCompared] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [manualRank, setManualRank] = useState('')
  const [manualRank10, setManualRank10] = useState('')

  const loadListAndCompare = useCallback(async () => {
    const listRes = await fetch(`${API}?action=list`)
    const listData = await listRes.json()
    const allEntries: EEEntry[] = listData.entries ?? []
    setEntries(allEntries)
    setLoading(false)

    // Auto-compare on load
    setComparing(true)
    const cmpRes = await fetch(`${API}?action=compare`)
    const cmpData = await cmpRes.json()

    const diffMap = new Map<string, { diffs: DiffEntry[] }>()
    for (const res of (cmpData.results ?? [])) {
      diffMap.set(res.id, { diffs: res.diffs })
    }

    const results: CompareEntry[] = []
    for (const entry of allEntries) {
      const dm = diffMap.get(entry.id)
      if (!entry.exists) {
        results.push({ ...entry, status: 'new', diffCount: 0, typoCount: 0, diffs: [] })
      } else if (!dm) {
        results.push({ ...entry, status: 'ok', diffCount: 0, typoCount: 0, diffs: [] })
      } else {
        const diffCount = dm.diffs.filter((d) => d.type === 'changed').length
        const typoCount = dm.diffs.filter((d) => d.type === 'typo').length
        const status = diffCount > 0 ? 'diff' : typoCount > 0 ? 'typo' : 'ok'
        results.push({ ...entry, status, diffCount, typoCount, diffs: dm.diffs })
      }
    }

    results.sort((a, b) => {
      if (a.diffCount !== b.diffCount) return b.diffCount - a.diffCount
      if (a.typoCount !== b.typoCount) return b.typoCount - a.typoCount
      return a.id.localeCompare(b.id)
    })

    setCompareEntries(results)
    setCompared(true)
    setComparing(false)
  }, [])

  useEffect(() => { loadListAndCompare() }, [loadListAndCompare])

  async function handleCompare() {
    setComparing(true)
    await loadListAndCompare()
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected, manual: { rank: manualRank, rank10: manualRank10 } }),
      })
      await handleCompare()
    } finally {
      setSaving(false)
    }
  }

  const selectedEntry = compared
    ? compareEntries.find((e) => e.id === selected)
    : (selected ? { id: selected, name: entries.find((e) => e.id === selected)?.name ?? selected, status: 'ok' as const, diffCount: 0, typoCount: 0, diffs: [] } : undefined)

  // Load manual fields when selecting an entry
  useEffect(() => {
    if (!selected) return
    fetch(`${API}?action=extract&id=${selected}`)
      .then((r) => r.json())
      .then((data) => {
        setManualRank(String(data.manual?.rank ?? ''))
        setManualRank10(String(data.manual?.rank10 ?? ''))
      })
  }, [selected])

  const displayList = compared ? compareEntries : entries.map((e) => ({
    ...e, status: e.exists ? 'ok' as const : 'new' as const, diffCount: 0, typoCount: 0, diffs: [],
  }))

  const filtered = displayList.filter((e) => {
    if (filter === 'diff' && e.status !== 'diff') return false
    if (filter === 'typo' && e.status !== 'typo') return false
    if (filter === 'new' && e.status !== 'new') return false
    if (filter === 'ok' && e.status !== 'ok') return false
    if (search) {
      const s = search.toLowerCase()
      return e.name.toLowerCase().includes(s) || e.id.includes(s)
    }
    return true
  })

  if (loading) return <div className="flex justify-center py-20 text-zinc-500">Loading...</div>

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Left: EE list */}
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">EE Extractor v3</h1>
          <button
            onClick={handleCompare}
            disabled={comparing}
            className="shrink-0 rounded bg-amber-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-amber-500 disabled:opacity-50"
          >
            {comparing ? 'Comparing...' : 'Compare All'}
          </button>
        </div>
        {compared && (
          <div className="mb-2 flex items-center gap-3 text-xs">
            <span className="text-zinc-500">{entries.length} total</span>
            <span className="text-green-400">{compareEntries.filter((e) => e.status === 'ok').length} ok</span>
            <span className="text-yellow-400">{compareEntries.filter((e) => e.status === 'diff').length} diff</span>
            <span className="text-zinc-400">{compareEntries.filter((e) => e.status === 'typo').length} typo</span>
            <span className="text-blue-400">{compareEntries.filter((e) => e.status === 'new').length} new</span>
          </div>
        )}

        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />

        <div className="mb-3 flex gap-1 text-xs">
          {(['all', 'diff', 'typo', 'new', 'ok'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 ${filter === f ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-800 hover:text-zinc-200 ${
                selected === e.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400'
              }`}
            >
              <span className="w-20 shrink-0 font-mono text-xs text-zinc-600">{e.id}</span>
              <span className="flex-1 truncate font-medium">{e.name}</span>
              <StatusBadge entry={e as CompareEntry} />
            </button>
          ))}
        </div>
      </div>

      {/* Right: Detail panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selected && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Select an EE to view details
          </div>
        )}

        {selected && selectedEntry && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">{selectedEntry.name}</h2>
              <span className="font-mono text-xs text-zinc-600">{selectedEntry.id}</span>
              <StatusBadge entry={selectedEntry} />
            </div>

            {/* Manual fields */}
            <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
              <h3 className="text-sm font-semibold text-zinc-400">Manual Fields</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Rank:</span>
                  <input
                    type="text"
                    value={manualRank}
                    onChange={(e) => setManualRank(e.target.value)}
                    className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Rank +10:</span>
                  <input
                    type="text"
                    value={manualRank10}
                    onChange={(e) => setManualRank10(e.target.value)}
                    className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                  />
                </label>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-green-600/80 px-3 py-1 text-xs font-semibold transition hover:bg-green-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {/* Diffs */}
            {selectedEntry.diffs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-400">
                  {selectedEntry.diffCount} difference{selectedEntry.diffCount !== 1 ? 's' : ''}
                  {selectedEntry.typoCount > 0 && ` · ${selectedEntry.typoCount} typo${selectedEntry.typoCount !== 1 ? 's' : ''}`}
                </h3>

                {/* Changed diffs */}
                {selectedEntry.diffs.filter((d) => d.type === 'changed').length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500">
                        <th className="py-0.5 pr-3 text-left font-medium">Field</th>
                        <th className="py-0.5 pr-3 text-left font-medium">Existing</th>
                        <th className="py-0.5 text-left font-medium">Extracted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntry.diffs.filter((d) => d.type === 'changed').map((d, i) => (
                        <tr key={i} className="border-t border-zinc-800/50">
                          <td className="py-1 pr-3 font-mono text-zinc-400 whitespace-nowrap">{d.key}</td>
                          <td className="py-1 pr-3 bg-red-950/20">
                            <CellContent value={d.existing} richText={isRichText(d.key)} />
                          </td>
                          <td className="py-1 bg-green-950/20">
                            <CellContent value={d.extracted} richText={isRichText(d.key)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Typos (collapsible) */}
                {selectedEntry.diffs.filter((d) => d.type === 'typo').length > 0 && (
                  <details className="rounded-lg border border-zinc-800/50 p-2">
                    <summary className="cursor-pointer text-xs text-zinc-500">
                      {selectedEntry.typoCount} typo{selectedEntry.typoCount !== 1 ? 's' : ''} (whitespace/punctuation)
                    </summary>
                    <table className="mt-2 w-full text-xs">
                      <tbody>
                        {selectedEntry.diffs.filter((d) => d.type === 'typo').map((d, i) => (
                          <tr key={i} className="border-t border-zinc-800/50">
                            <td className="py-1 pr-3 font-mono text-zinc-500 whitespace-nowrap">{d.key}</td>
                            <td className="py-1 pr-3 text-zinc-500">{formatValue(d.existing)}</td>
                            <td className="py-1 text-zinc-500">{formatValue(d.extracted)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            )}

            {selectedEntry.status === 'ok' && (
              <p className="text-sm text-green-400">No differences</p>
            )}

            {selectedEntry.status === 'new' && (
              <div className="space-y-2">
                <p className="text-sm text-blue-400">New EE - not yet in ee.json</p>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded bg-blue-600/80 px-3 py-1 text-xs font-semibold transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Extract & Save'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
