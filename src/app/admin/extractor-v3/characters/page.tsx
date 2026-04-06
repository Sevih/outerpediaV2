'use client'

import { useState, useEffect, useCallback } from 'react'

interface CharEntry {
  id: string
  name: string
  name_kr: string
  element: string
  class: string
  rarity: number
}

interface CompareEntry extends CharEntry {
  status: 'new' | 'ok' | 'diff' | 'typo'
  diffCount: number
  typoCount: number
}

interface CompareResult {
  total: number
  ok: number
  diff: number
  typo: number
  new: number
  characters: CompareEntry[]
}

interface DiffEntry {
  key: string
  type: 'changed' | 'missing_existing' | 'missing_extracted' | 'typo'
  extracted: unknown
  existing: unknown
}

interface ManualFields {
  rank?: string
  rank_pvp?: string
  role?: string
  skill_priority?: Record<string, { prio: number }>
  video?: string
  tags?: string[]
}

interface DetailResult {
  extracted: Record<string, unknown>
  existing: Record<string, unknown> | null
  diffs: DiffEntry[]
  manual: ManualFields
}

const API = '/api/admin/extractor-v3'

const CLASS_ICON: Record<string, string> = {
  DEFENDER: 'Defender',
  ATTACKER: 'Striker',
  RANGER: 'Ranger',
  MAGE: 'Mage',
  PRIEST: 'Healer',
}

function elemIcon(element: string) {
  const name = element.charAt(0).toUpperCase() + element.slice(1).toLowerCase()
  return `/images/ui/elem/CM_Element_${name}.webp`
}

function classIcon(cls: string) {
  return `/images/ui/class/CM_Class_${CLASS_ICON[cls] ?? cls}.webp`
}

function formatValue(val: unknown): string {
  if (val === undefined) return ''
  if (val === null) return 'null'
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

// Check if a diff key likely contains game text with <color> tags
function isRichText(key: string) {
  return key.includes('true_desc_levels') || key.includes('transcend') || key.includes('enhancement')
}

// Render a string interpreting <color=#hex>...</color> and \n
function RichText({ text }: { text: string }) {
  // Replace literal \n with real newlines
  const normalized = text.replace(/\\n/g, '\n')

  // Split by <color=...>...</color> tags
  const parts: { text: string; color?: string }[] = []
  let remaining = normalized
  const regex = /<color=(#[0-9a-fA-F]+)>([\s\S]*?)<\/color>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: remaining.slice(lastIndex, match.index) })
    }
    parts.push({ text: match[2], color: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < remaining.length) {
    parts.push({ text: remaining.slice(lastIndex) })
  }

  return (
    <span className="whitespace-pre-wrap wrap-break-word">
      {parts.map((p, i) =>
        p.color
          ? <span key={i} style={{ color: p.color }}>{p.text}</span>
          : <span key={i}>{p.text}</span>
      )}
    </span>
  )
}

export default function ExtractorV3Page() {
  const [characters, setCharacters] = useState<CompareEntry[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'new' | 'diff' | 'typo' | 'ok'>('all')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, ok: 0, diff: 0, typo: 0, new: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [manual, setManual] = useState<ManualFields>({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const loadCompare = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}?action=compare`)
      const data: CompareResult = await res.json()
      setCharacters(data.characters)
      setStats({ total: data.total, ok: data.ok, diff: data.diff, typo: data.typo, new: data.new })
    } catch (e) {
      console.error('Compare failed:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadCompare() }, [loadCompare])

  const loadDetail = async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const res = await fetch(`${API}?action=extract&id=${id}`)
      const data: DetailResult = await res.json()
      setDetail(data)
      setManual(data.manual ?? {})
    } catch (e) {
      console.error('Extract failed:', e)
    }
    setDetailLoading(false)
  }

  const filtered = characters.filter((c) => {
    if (filter === 'diff' && c.diffCount === 0) return false
    if (filter === 'typo' && c.typoCount === 0) return false
    if (filter === 'ok' && c.status !== 'ok') return false
    if (filter === 'new' && c.status !== 'new') return false
    if (search) {
      const s = search.toLowerCase()
      return c.id.includes(s) || c.name.toLowerCase().includes(s) || c.name_kr.includes(s)
    }
    return true
  }).sort((a, b) => {
    // Diff first (most diffs on top), then typo-only (most on top), then by ID
    const aHasDiff = a.diffCount > 0 ? 0 : a.typoCount > 0 ? 1 : 2
    const bHasDiff = b.diffCount > 0 ? 0 : b.typoCount > 0 ? 1 : 2
    if (aHasDiff !== bHasDiff) return aHasDiff - bHasDiff
    if (a.diffCount !== b.diffCount) return b.diffCount - a.diffCount
    if (a.typoCount !== b.typoCount) return b.typoCount - a.typoCount
    return parseInt(a.id) - parseInt(b.id)
  })

  const charEntry = characters.find((c) => c.id === selectedId)

  return (
    <div className="flex h-screen">
      {/* Left panel — Character list */}
      <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800 space-y-2">
          <h1 className="text-lg font-bold">Extractor V3</h1>
          <div className="flex gap-2 text-xs">
            <span className="text-zinc-400">{stats.total} total</span>
            <span className="text-green-400">{stats.ok} ok</span>
            <span className="text-yellow-400">{stats.diff} diff</span>
            <span className="text-zinc-400">{stats.typo} typo</span>
            <span className="text-blue-400">{stats.new} new</span>
          </div>
          <input
            type="text"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded bg-zinc-800 px-2 py-1 text-sm outline-none"
          />
          <div className="flex gap-1">
            {(['all', 'diff', 'typo', 'new', 'ok'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-2 py-0.5 text-xs ${
                  filter === f ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-3 text-sm text-zinc-500">Loading...</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => loadDetail(c.id)}
                className={`w-full text-left px-3 py-1.5 text-sm border-b border-zinc-800/50 hover:bg-zinc-800/50 ${
                  selectedId === c.id ? 'bg-zinc-800' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-500">{c.id}</span>
                  <StatusBadge status={c.status} diffCount={c.diffCount} typoCount={c.typoCount} />
                </div>
                <div className="truncate">{c.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <img src={elemIcon(c.element)} alt={c.element} className="size-4" />
                  <img src={classIcon(c.class)} alt={c.class} className="size-4" />
                  {Array.from({ length: c.rarity }, (_, i) => (
                    <img key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="★" className="size-3" />
                  ))}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel — Detail / Compare */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedId ? (
          <p className="text-zinc-500">Select a character</p>
        ) : detailLoading ? (
          <p className="text-zinc-500">Extracting...</p>
        ) : detail ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">
              {detail.extracted.Fullname as string} ({detail.extracted.ID as string})
            </h2>

            {/* Manual fields + Save */}
            <ManualFieldsForm
              manual={manual}
              onChange={setManual}
              skills={detail.extracted.skills as Record<string, { SkillType: string }> | undefined}
            />
            <button
              onClick={async () => {
                setSaving(true)
                setSaveMessage(null)
                try {
                  const res = await fetch(API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: selectedId, manual }),
                  })
                  if (!res.ok) {
                    const err = await res.json()
                    setSaveMessage({ text: `Error: ${err.error ?? 'Unknown'}`, type: 'error' })
                    return
                  }
                  const data = await res.json()
                  const img = data.images
                  if (img?.copied > 0) {
                    setSaveMessage({ text: `Saved + ${img.copied} image(s) copied${img.missing > 0 ? `, ${img.missing} missing` : ''}`, type: 'success' })
                  } else if (img?.missing > 0) {
                    setSaveMessage({ text: `Saved (${img.missing} image(s) missing in datamine)`, type: 'error' })
                  } else {
                    setSaveMessage({ text: 'Saved (all images exist)', type: 'info' })
                  }
                  await loadCompare()
                  if (selectedId) await loadDetail(selectedId)
                } catch (e) {
                  setSaveMessage({ text: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, type: 'error' })
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saveMessage && (
              <span className={`text-xs ${saveMessage.type === 'error' ? 'text-red-400' : saveMessage.type === 'success' ? 'text-green-400' : 'text-zinc-400'}`}>
                {saveMessage.text}
              </span>
            )}

            {charEntry?.status === 'ok' && (
              <p className="text-sm text-green-400">No diffs with existing data</p>
            )}

            {charEntry?.status === 'new' && (
              <div className="space-y-2">
                <p className="text-sm text-blue-400">New character (no existing file)</p>
                <pre className="rounded bg-zinc-900 p-3 text-xs overflow-x-auto max-h-[70vh] overflow-y-auto">
                  {JSON.stringify(detail.extracted, null, 2)}
                </pre>
              </div>
            )}

            {(charEntry?.status === 'diff' || charEntry?.status === 'typo') && detail.diffs.length > 0 && (
              <DiffPanel diffs={detail.diffs} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

const RANKS = ['', 'S', 'A', 'B', 'C', 'D', 'E'] as const
const ROLES = ['', 'dps', 'support', 'sustain'] as const
const SKILL_LABELS: Record<string, string> = {
  SKT_FIRST: 'First',
  SKT_SECOND: 'Second',
  SKT_ULTIMATE: 'Ultimate',
}

function ManualFieldsForm({
  manual,
  onChange,
  skills,
}: {
  manual: ManualFields
  onChange: (m: ManualFields) => void
  skills?: Record<string, { SkillType: string }>
}) {
  const update = (key: string, value: unknown) => {
    onChange({ ...manual, [key]: value || undefined })
  }

  const hasTag = (tag: string) => manual.tags?.includes(tag) ?? false
  const toggleTag = (tag: string) => {
    const current = manual.tags ?? []
    const next = hasTag(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    onChange({ ...manual, tags: next.length ? next : undefined })
  }

  // Build skill priority from extracted skills
  const skillTypes = skills
    ? Object.keys(skills).filter((k) => SKILL_LABELS[k])
    : ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE']

  const updatePrio = (skillType: string, prio: number) => {
    const label = SKILL_LABELS[skillType]
    if (!label) return
    const sp = { ...manual.skill_priority }
    if (prio === 0) {
      delete sp[label]
    } else {
      sp[label] = { prio }
    }
    onChange({ ...manual, skill_priority: Object.keys(sp).length ? sp : undefined })
  }

  return (
    <div className="rounded border border-zinc-800 p-3 space-y-3">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Manual fields</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs text-zinc-500">Rank PvE</span>
          <select
            value={manual.rank ?? ''}
            onChange={(e) => update('rank', e.target.value)}
            className="w-full rounded bg-zinc-800 px-2 py-1 text-sm outline-none"
          >
            {RANKS.map((r) => <option key={r} value={r}>{r || '-'}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-zinc-500">Rank PvP</span>
          <select
            value={manual.rank_pvp ?? ''}
            onChange={(e) => update('rank_pvp', e.target.value)}
            className="w-full rounded bg-zinc-800 px-2 py-1 text-sm outline-none"
          >
            {RANKS.map((r) => <option key={r} value={r}>{r || '-'}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-zinc-500">Role</span>
          <select
            value={manual.role ?? ''}
            onChange={(e) => update('role', e.target.value)}
            className="w-full rounded bg-zinc-800 px-2 py-1 text-sm outline-none"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r || '-'}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-zinc-500">Video (YT ID)</span>
          <input
            type="text"
            value={manual.video ?? ''}
            onChange={(e) => update('video', e.target.value)}
            placeholder="dQw4w9WgXcQ"
            className="w-full rounded bg-zinc-800 px-2 py-1 text-sm outline-none"
          />
        </label>
      </div>
      <div className="space-y-1">
        <span className="text-xs text-zinc-500">Skill Priority</span>
        <div className="flex gap-3">
          {skillTypes.map((st) => {
            const label = SKILL_LABELS[st]
            if (!label) return null
            const current = manual.skill_priority?.[label]?.prio ?? 0
            return (
              <label key={st} className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400">{label}</span>
                <select
                  value={current}
                  onChange={(e) => updatePrio(st, parseInt(e.target.value))}
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs outline-none"
                >
                  <option value={0}>-</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">Tags</span>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={hasTag('free')}
            onChange={() => toggleTag('free')}
            className="rounded"
          />
          <span className="text-zinc-400">free</span>
        </label>
      </div>
    </div>
  )
}

function DiffPanel({ diffs }: { diffs: DiffEntry[] }) {
  const [typoOpen, setTypoOpen] = useState(false)
  const typos = diffs.filter((d) => d.type === 'typo')
  const realDiffs = diffs.filter((d) => d.type !== 'typo')

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400">
        {realDiffs.length} difference{realDiffs.length !== 1 ? 's' : ''}
        {typos.length > 0 && <span className="text-zinc-500"> · {typos.length} typo</span>}
      </p>

      {typos.length > 0 && (
        <button
          onClick={() => setTypoOpen(!typoOpen)}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <span className={`transition-transform ${typoOpen ? 'rotate-90' : ''}`}>&#9654;</span>
          {typos.length} typo{typos.length !== 1 ? 's' : ''} (punctuation / whitespace)
        </button>
      )}
      {typoOpen && (
        <div className="ml-4 text-xs text-zinc-600 space-y-0.5">
          {typos.map((d) => (
            <div key={d.key} className="font-mono">{d.key}</div>
          ))}
        </div>
      )}

      {realDiffs.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="py-1.5 pr-3 text-left font-medium w-40">Field</th>
              <th className="py-1.5 pr-3 text-left font-medium">Existing</th>
              <th className="py-1.5 text-left font-medium">Extracted</th>
            </tr>
          </thead>
          <tbody>
            {realDiffs.map((d) => (
              <DiffRow key={d.key} diff={d} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CellContent({ value, diffKey }: { value: string; diffKey: string }) {
  if (!value) return <span className="text-zinc-600">-</span>
  if (isRichText(diffKey) && typeof value === 'string') return <RichText text={value} />
  return <span className="whitespace-pre-wrap wrap-break-word">{value}</span>
}

function DiffRow({ diff }: { diff: DiffEntry }) {
  const typeColors: Record<string, string> = {
    changed: 'text-yellow-400',
    missing_existing: 'text-blue-400',
    missing_extracted: 'text-red-400',
    typo: 'text-zinc-500',
  }

  const typeLabels: Record<string, string> = {
    changed: '',
    missing_existing: 'NEW',
    missing_extracted: 'MISSING',
    typo: 'TYPO',
  }

  const label = typeLabels[diff.type]

  if (diff.type === 'typo') {
    return (
      <tr className="border-b border-zinc-800/50 align-top">
        <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-zinc-500">
          {diff.key}
        </td>
        <td colSpan={2} className="py-1.5 text-zinc-500 italic text-xs">
          whitespace difference
        </td>
      </tr>
    )
  }

  const existingStr = formatValue(diff.existing)
  const extractedStr = formatValue(diff.extracted)
  const isLong = existingStr.length > 80 || extractedStr.length > 80

  return (
    <tr className="border-b border-zinc-800/50 align-top">
      <td className={`py-1.5 pr-3 font-mono whitespace-nowrap ${typeColors[diff.type]}`}>
        {diff.key}
        {label && <span className="ml-1 text-[10px] opacity-70">({label})</span>}
      </td>
      {isLong ? (
        <td colSpan={2} className="py-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-red-950/30 p-2 text-sm max-h-60 overflow-y-auto">
              <CellContent value={existingStr} diffKey={diff.key} />
            </div>
            <div className="rounded bg-green-950/30 p-2 text-sm max-h-60 overflow-y-auto">
              <CellContent value={extractedStr} diffKey={diff.key} />
            </div>
          </div>
        </td>
      ) : (
        <>
          <td className="py-1.5 pr-3 rounded bg-red-950/20">
            <CellContent value={existingStr} diffKey={diff.key} />
          </td>
          <td className="py-1.5 rounded bg-green-950/20">
            <CellContent value={extractedStr} diffKey={diff.key} />
          </td>
        </>
      )}
    </tr>
  )
}

function StatusBadge({ status, diffCount, typoCount }: { status: string; diffCount: number; typoCount: number }) {
  if (status === 'ok') {
    return <span className="rounded px-1.5 py-0.5 text-[10px] bg-green-900/50 text-green-400">ok</span>
  }
  if (status === 'new') {
    return <span className="rounded px-1.5 py-0.5 text-[10px] bg-blue-900/50 text-blue-400">new</span>
  }
  return (
    <div className="flex gap-1">
      {diffCount > 0 && (
        <span className="rounded px-1.5 py-0.5 text-[10px] bg-yellow-900/50 text-yellow-400">
          {diffCount} diff
        </span>
      )}
      {typoCount > 0 && (
        <span className="rounded px-1.5 py-0.5 text-[10px] bg-zinc-700/50 text-zinc-400">
          {typoCount} typo
        </span>
      )}
    </div>
  )
}
