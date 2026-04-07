'use client'

import { useState, useEffect, useCallback } from 'react'

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
  existsInJson: boolean
}

interface Props {
  title: string
  apiBase: string
}

function formatValue(val: unknown): string {
  if (val === undefined) return ''
  if (val === null) return 'null'
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function isRichText(key: string) {
  return key.includes('effect') && !key.includes('icon')
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(<color=[^>]+>[^<]*<\/color>|\\n)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part === '\\n') return <br key={i} />
        const m = part.match(/^<color=([^>]+)>([^<]*)<\/color>$/)
        if (m) return <span key={i} style={{ color: m[1] }}>{m[2]}</span>
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
      {entry.diffCount > 0 && <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-[10px] text-yellow-400">{entry.diffCount} diff</span>}
      {entry.typoCount > 0 && <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">{entry.typoCount} typo</span>}
    </span>
  )
}

export default function EquipPage({ title, apiBase }: Props) {
  const [entries, setEntries] = useState<CompareEntry[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'diff' | 'typo' | 'new' | 'ok'>('all')
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [compared, setCompared] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const loadAndCompare = useCallback(async () => {
    setComparing(true)
    try {
      const [listRes, cmpRes] = await Promise.all([
        fetch(`${apiBase}?action=list`),
        fetch(`${apiBase}?action=compare`),
      ])
      const listData = await listRes.json()
      const cmpData = await cmpRes.json()

      const listEntries: { id: string; name: string; existsInJson: boolean }[] = listData.entries ?? []
      const diffMap = new Map<string, { diffs: DiffEntry[] }>()
      for (const res of (cmpData.results ?? [])) {
        diffMap.set(res.id, { diffs: res.diffs })
      }

      const results: CompareEntry[] = listEntries.map((e) => {
        const dm = diffMap.get(e.id)
        if (!e.existsInJson) return { ...e, status: 'new' as const, diffCount: 0, typoCount: 0, diffs: [] }
        if (!dm) return { ...e, status: 'ok' as const, diffCount: 0, typoCount: 0, diffs: [] }
        const diffCount = dm.diffs.filter((d) => d.type === 'changed').length
        const typoCount = dm.diffs.filter((d) => d.type === 'typo').length
        const status = diffCount > 0 ? 'diff' as const : typoCount > 0 ? 'typo' as const : 'ok' as const
        return { ...e, status, diffCount, typoCount, diffs: dm.diffs }
      })

      results.sort((a, b) => {
        if (a.diffCount !== b.diffCount) return b.diffCount - a.diffCount
        if (a.typoCount !== b.typoCount) return b.typoCount - a.typoCount
        return a.id.localeCompare(b.id)
      })

      setEntries(results)
      setCompared(true)
    } finally {
      setLoading(false)
      setComparing(false)
    }
  }, [apiBase])

  useEffect(() => { loadAndCompare() }, [loadAndCompare])

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected }),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveMessage({ text: `Error: ${err.error ?? 'Unknown'}`, type: 'error' })
        return
      }
      const data = await res.json()
      setSaveMessage({
        text: data.copied > 0 ? `Saved + ${data.copied} image(s) copied` : 'Saved (images exist)',
        type: data.copied > 0 ? 'success' : 'info',
      })
      await loadAndCompare()
    } catch (e) {
      setSaveMessage({ text: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const selectedEntry = entries.find((e) => e.id === selected)

  const filtered = entries.filter((e) => {
    if (filter === 'diff' && e.status !== 'diff') return false
    if (filter === 'typo' && e.status !== 'typo') return false
    if (filter === 'new' && e.status !== 'new') return false
    if (filter === 'ok' && e.status !== 'ok') return false
    if (search) {
      const s = search.toLowerCase()
      return String(e.name ?? '').toLowerCase().includes(s) || e.id.includes(s)
    }
    return true
  })

  if (loading) return <div className="flex justify-center py-20 text-zinc-500">Loading...</div>

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{title}</h1>
          <button onClick={loadAndCompare} disabled={comparing} className="shrink-0 rounded bg-amber-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-amber-500 disabled:opacity-50">
            {comparing ? 'Comparing...' : 'Compare All'}
          </button>
        </div>
        {compared && (
          <div className="mb-2 flex items-center gap-3 text-xs">
            <span className="text-zinc-500">{entries.length} total</span>
            <span className="text-green-400">{entries.filter((e) => e.status === 'ok').length} ok</span>
            <span className="text-yellow-400">{entries.filter((e) => e.status === 'diff').length} diff</span>
            <span className="text-zinc-400">{entries.filter((e) => e.status === 'typo').length} typo</span>
            <span className="text-blue-400">{entries.filter((e) => e.status === 'new').length} new</span>
          </div>
        )}
        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="mb-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none" />
        <div className="mb-3 flex gap-1 text-xs">
          {(['all', 'diff', 'typo', 'new', 'ok'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 ${filter === f ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filtered.map((e) => (
            <button key={e.id} onClick={() => { setSelected(e.id); setSaveMessage(null) }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-800 hover:text-zinc-200 ${selected === e.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400'}`}>
              <span className="flex-1 truncate font-medium">{String(e.name ?? e.id)}</span>
              <StatusBadge entry={e} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selected && <div className="flex items-center justify-center h-full text-zinc-600">Select an item to view details</div>}

        {selected && selectedEntry && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">{String(selectedEntry.name ?? '')}</h2>
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
                <h3 className="text-sm font-semibold text-zinc-400">
                  {selectedEntry.diffCount} difference{selectedEntry.diffCount !== 1 ? 's' : ''}
                  {selectedEntry.typoCount > 0 && ` · ${selectedEntry.typoCount} typo${selectedEntry.typoCount !== 1 ? 's' : ''}`}
                </h3>
                {selectedEntry.diffs.filter((d) => d.type === 'changed').length > 0 && (
                  <table className="w-full text-xs">
                    <thead><tr className="text-zinc-500"><th className="py-0.5 pr-3 text-left font-medium">Field</th><th className="py-0.5 pr-3 text-left font-medium">Existing</th><th className="py-0.5 text-left font-medium">Extracted</th></tr></thead>
                    <tbody>
                      {selectedEntry.diffs.filter((d) => d.type === 'changed').map((d, i) => (
                        <tr key={i} className="border-t border-zinc-800/50">
                          <td className="py-1 pr-3 font-mono text-zinc-400 whitespace-nowrap">{d.key}</td>
                          <td className="py-1 pr-3 bg-red-950/20"><CellContent value={d.existing} richText={isRichText(d.key)} /></td>
                          <td className="py-1 bg-green-950/20"><CellContent value={d.extracted} richText={isRichText(d.key)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {selectedEntry.diffs.filter((d) => d.type === 'typo').length > 0 && (
                  <details className="rounded-lg border border-zinc-800/50 p-2">
                    <summary className="cursor-pointer text-xs text-zinc-500">{selectedEntry.typoCount} typo{selectedEntry.typoCount !== 1 ? 's' : ''}</summary>
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

            {selectedEntry.status === 'ok' && <p className="text-sm text-green-400">No differences</p>}
            {selectedEntry.status === 'new' && (
              <p className="text-sm text-blue-400">New item — click Save to extract</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
