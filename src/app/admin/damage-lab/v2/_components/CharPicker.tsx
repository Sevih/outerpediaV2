'use client'

import Image from 'next/image'
import { useMemo, useRef, useState, useEffect } from 'react'
import type { CharSummary } from '../_state/types'

interface CharPickerProps {
  catalog: CharSummary[]
  selectedId: string
  onSelect: (charId: string) => void
}

const ELEMENTS: ('all' | CharSummary['element'])[] = ['all', 'Earth', 'Water', 'Fire', 'Light', 'Dark']

/**
 * Class label → icon-file token.
 * Striker (in-game label) → CM_Class_Striker.webp.
 * Healer / Priest fold to Healer (file convention).
 */
const CLASS_ICON: Record<string, string> = {
  Attacker: 'Striker',
  Striker: 'Striker',
  Mage: 'Mage',
  Ranger: 'Ranger',
  Defender: 'Defender',
  Priest: 'Healer',
  Healer: 'Healer',
}

export function CharPicker({ catalog, selectedId, onSelect }: CharPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [elemFilter, setElemFilter] = useState<typeof ELEMENTS[number]>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = catalog.find(c => c.id === selectedId)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter(c => {
      if (elemFilter !== 'all' && c.element !== elemFilter) return false
      if (q && !c.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [catalog, query, elemFilter])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition-colors ${
          open
            ? 'border-blue-600 bg-zinc-900 text-zinc-100'
            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
        }`}
      >
        {selected ? (
          <>
            <ElementIcon element={selected.element} size={16} />
            <ClassIcon classLabel={selected.class} size={16} />
            <span className="flex-1 truncate font-medium">{selected.name}</span>
            <span className="text-[10px] text-zinc-600">{selected.id}</span>
          </>
        ) : (
          <span className="flex-1 text-zinc-500">— Pick a character —</span>
        )}
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full space-y-2 rounded border border-zinc-700 bg-zinc-950 p-2 shadow-lg">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search character..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              suppressHydrationWarning
              autoFocus
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <select
              value={elemFilter}
              onChange={e => setElemFilter(e.target.value as typeof ELEMENTS[number])}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
            >
              {ELEMENTS.map(el => (
                <option key={el} value={el}>{el === 'all' ? 'All elements' : el}</option>
              ))}
            </select>
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto rounded border border-zinc-800 bg-zinc-900">
            {filtered.length === 0 && (
              <div className="p-2 text-xs text-zinc-500">No matches.</div>
            )}
            {filtered.map(c => {
              const active = c.id === selectedId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs transition-colors ${
                    active
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <ElementIcon element={c.element} size={16} />
                  <ClassIcon classLabel={c.class} size={16} />
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <span className="shrink-0 text-[10px] text-zinc-600">{c.id}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ElementIcon({ element, size = 16 }: { element: string; size?: number }) {
  if (!element) return null
  return (
    <Image
      src={`/images/ui/elem/CM_Element_${element}.webp`}
      alt={element}
      width={size}
      height={size}
      className="shrink-0"
      unoptimized
    />
  )
}

export function ClassIcon({ classLabel, size = 16 }: { classLabel: string; size?: number }) {
  const token = CLASS_ICON[classLabel] ?? classLabel
  if (!token) return null
  return (
    <Image
      src={`/images/ui/class/CM_Class_${token}.webp`}
      alt={classLabel}
      width={size}
      height={size}
      className="shrink-0"
      unoptimized
    />
  )
}
