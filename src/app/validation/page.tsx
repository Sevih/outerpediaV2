'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { deepDiff, groupDiffsBySection, type DiffEntry } from './utils'

type CharacterCompare = {
  slug: string
  id: string
  name: string
  v1: Record<string, unknown>
  v2: Record<string, unknown> | null
  v1_ee: Record<string, unknown> | null
  v2_ee: Record<string, unknown> | null
  validated: boolean
}

type Filter = 'all' | 'with-diffs' | 'no-diffs' | 'validated' | 'not-validated'

function DiffBadge({ type, merge }: { type: DiffEntry['type']; merge: DiffEntry['merge'] }) {
  const colors = {
    added: 'bg-green-700 text-green-100',
    removed: 'bg-red-700 text-red-100',
    changed: 'bg-yellow-700 text-yellow-100',
  }
  const mergeLabel = merge === 'v1' ? ' (keep v1)' : ''
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${colors[type]}`}>
      {type}{mergeLabel}
    </span>
  )
}

function parseColorTags(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /<color=(#[0-9a-fA-F]{6})>(.*?)<\/color>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <span key={match.index} style={{ color: match[1] }}>
        {match[2]}
      </span>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

function DiffValue({ label, value }: { label: string; value: unknown }) {
  if (value === undefined) return null
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  const hasColorTags = typeof value === 'string' && value.includes('<color=')
  return (
    <span className="text-xs font-mono">
      <span className="text-neutral-500">{label}: </span>
      <span className="text-neutral-300">
        {hasColorTags ? parseColorTags(raw) : raw}
      </span>
    </span>
  )
}

function CharacterRow({
  char,
  charDiffs,
  eeDiffs,
  onValidate,
}: {
  char: CharacterCompare
  charDiffs: DiffEntry[]
  eeDiffs: DiffEntry[]
  onValidate: (id: string, slug: string) => void
}) {
  const [open, setOpen] = useState(false)
  const totalDiffs = charDiffs.length + eeDiffs.length
  const grouped = useMemo(() => groupDiffsBySection(charDiffs), [charDiffs])
  const eeGrouped = useMemo(() => groupDiffsBySection(eeDiffs), [eeDiffs])

  return (
    <div className="border border-neutral-700 rounded">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-neutral-800 text-left"
      >
        <span className="font-mono text-neutral-500 text-sm w-20">{char.id}</span>
        <span className="font-semibold flex-1">{char.name}</span>
        <span className="text-xs text-neutral-400">({char.slug})</span>

        {totalDiffs > 0 ? (
          <span className="bg-yellow-600 text-white text-xs px-2 py-0.5 rounded">
            {totalDiffs} diff{totalDiffs > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="bg-green-800 text-green-200 text-xs px-2 py-0.5 rounded">
            identical
          </span>
        )}

        {char.validated && (
          <span className="bg-blue-700 text-blue-100 text-xs px-2 py-0.5 rounded">
            validated
          </span>
        )}

        {!char.v2 && (
          <span className="bg-red-800 text-red-200 text-xs px-2 py-0.5 rounded">
            no V2
          </span>
        )}

        <span className="text-neutral-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-neutral-700 space-y-3">
          {/* Character diffs */}
          {charDiffs.length === 0 && (
            <p className="text-sm text-green-400">Character data is identical.</p>
          )}

          {Object.entries(grouped).map(([section, diffs]) => (
            <div key={section}>
              <h4 className="text-sm font-semibold text-neutral-300 mb-1">{section}</h4>
              <div className="space-y-1 ml-3">
                {diffs.map((diff, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <DiffBadge type={diff.type} merge={diff.merge} />
                    <span className="font-mono text-neutral-400 min-w-48 shrink-0">
                      {diff.path}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {diff.type === 'changed' && (
                        <>
                          <DiffValue label="v1" value={diff.v1} />
                          <DiffValue label="v2" value={diff.v2} />
                        </>
                      )}
                      {diff.type === 'added' && <DiffValue label="v2" value={diff.v2} />}
                      {diff.type === 'removed' && <DiffValue label="v1" value={diff.v1} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* EE diffs */}
          {(char.v1_ee || char.v2_ee) && (
            <div className="border-t border-neutral-700 pt-3">
              <h3 className="text-sm font-bold text-purple-300 mb-2">Exclusive Equipment</h3>
              {eeDiffs.length === 0 ? (
                <p className="text-sm text-green-400">EE data is identical.</p>
              ) : (
                Object.entries(eeGrouped).map(([section, diffs]) => (
                  <div key={section}>
                    <h4 className="text-sm font-semibold text-neutral-300 mb-1">{section}</h4>
                    <div className="space-y-1 ml-3">
                      {diffs.map((diff, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <DiffBadge type={diff.type} merge={diff.merge} />
                          <span className="font-mono text-neutral-400 min-w-48 shrink-0">
                            {diff.path}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            {diff.type === 'changed' && (
                              <>
                                <DiffValue label="v1" value={diff.v1} />
                                <DiffValue label="v2" value={diff.v2} />
                              </>
                            )}
                            {diff.type === 'added' && <DiffValue label="v2" value={diff.v2} />}
                            {diff.type === 'removed' && <DiffValue label="v1" value={diff.v1} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Validate button */}
          {char.v2 && (
            <div className="flex gap-2 pt-2 border-t border-neutral-700">
              <button
                onClick={() => onValidate(char.id, char.slug)}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  char.validated
                    ? 'bg-neutral-700 text-neutral-400'
                    : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
              >
                {char.validated ? 'Re-validate' : 'Validate'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ValidationPage() {
  const [characters, setCharacters] = useState<CharacterCompare[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/compare')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCharacters(data.characters)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Compute diffs for all characters
  const diffsMap = useMemo(() => {
    const map = new Map<string, { char: DiffEntry[]; ee: DiffEntry[] }>()
    for (const c of characters) {
      const charDiffs = c.v2 ? deepDiff(c.v1, c.v2) : []
      const eeDiffs = (c.v1_ee || c.v2_ee) ? deepDiff(c.v1_ee, c.v2_ee) : []
      map.set(c.id, { char: charDiffs, ee: eeDiffs })
    }
    return map
  }, [characters])

  const filtered = useMemo(() => {
    return characters.filter(c => {
      const d = diffsMap.get(c.id)
      const hasDiffs = d ? (d.char.length + d.ee.length) > 0 : false

      switch (filter) {
        case 'with-diffs': return hasDiffs
        case 'no-diffs': return !hasDiffs
        case 'validated': return c.validated
        case 'not-validated': return !c.validated
        default: return true
      }
    })
  }, [characters, filter, diffsMap])

  const stats = useMemo(() => {
    let withDiffs = 0
    let validated = 0
    for (const c of characters) {
      const d = diffsMap.get(c.id)
      if (d && (d.char.length + d.ee.length) > 0) withDiffs++
      if (c.validated) validated++
    }
    return { total: characters.length, withDiffs, validated }
  }, [characters, diffsMap])

  const handleValidate = async (id: string, slug: string) => {
    try {
      const res = await fetch('/api/compare/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, slug }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      // Update local state
      setCharacters(prev =>
        prev.map(c => c.id === id ? { ...c, validated: true } : c)
      )
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleValidateAll = async () => {
    if (!confirm(`Validate all ${characters.length} characters?`)) return

    try {
      const res = await fetch('/api/compare/validate-all', {
        method: 'POST',
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      alert(`Validated ${result.count} characters`)
      setCharacters(prev => prev.map(c => ({ ...c, validated: true })))
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-white">
        <p>Loading comparison data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-red-400">
        <p>Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 text-white max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">V1 vs V2 Validation</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {stats.total} characters | {stats.withDiffs} with diffs | {stats.validated} validated
          </p>
        </div>
        <button
          onClick={handleValidateAll}
          className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-medium"
        >
          Validate All
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'with-diffs', 'no-diffs', 'validated', 'not-validated'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {f === 'all' ? 'All' :
             f === 'with-diffs' ? 'With Diffs' :
             f === 'no-diffs' ? 'No Diffs' :
             f === 'validated' ? 'Validated' :
             'Not Validated'}
          </button>
        ))}
        <span className="text-sm text-neutral-500 ml-2 self-center">
          Showing {filtered.length}/{characters.length}
        </span>
      </div>

      {/* Character list */}
      <div className="space-y-1">
        {filtered.map(char => {
          const d = diffsMap.get(char.id) ?? { char: [], ee: [] }
          return (
            <CharacterRow
              key={char.id}
              char={char}
              charDiffs={d.char}
              eeDiffs={d.ee}
              onValidate={handleValidate}
            />
          )
        })}
      </div>
    </div>
  )
}
