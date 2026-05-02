'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import CharacterPortrait from '@/app/components/character/CharacterPortrait'
import { FilterSearch, FilterPill, IconFilterGroup } from '@/app/components/ui/FilterPills'
import { useI18n } from '@/lib/contexts/I18nContext'
import { l } from '@/lib/i18n/localize'
import { ELEMENTS, CLASSES, RARITIES, type RarityType } from '@/types/enums'
import type { DamageCalcCharSummary } from '@/lib/data/damage-calc'
import type { Lang } from '@/lib/i18n/config'

/**
 * Character picker modal — minimal, scoped to the damage calculator.
 *
 * The site's main `CharacterPicker` consumes the heavier `CharacterListEntry`
 * shape (rank/role/buff/debuff metadata for filtering by effect). The damage
 * calc only needs name + element + class + rarity — a slim picker keeps the
 * bundle tight and avoids forcing the bake to mirror the site's full char
 * schema. Filter UI mirrors `CharactersPageClient` so the operator gets a
 * consistent feel across the site.
 */

interface Props {
  chars: DamageCalcCharSummary[]
  selectedId?: string | null
  lang: Lang
  onPick: (charId: string) => void
  onClose: () => void
}

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim()
}

/** Multi-select toggle — auto-clears when every option ends up selected. */
function toggleArray<T>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  value: T,
  allValues?: readonly T[],
) {
  setter(prev => {
    const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    return allValues && next.length === allValues.length ? [] : next
  })
}

export default function CharPickerModal({ chars, selectedId, lang, onPick, onClose }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [elementFilter, setElementFilter] = useState<string[]>([])
  const [classFilter, setClassFilter] = useState<string[]>([])
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([])
  const backdropRef = useRef<HTMLDivElement>(null)

  // Pre-index search names across all 4 langs once per char list change.
  // Querying is hot (every keystroke) so the cost belongs upfront.
  const indexed = useMemo(() => {
    return chars.map(c => ({
      char: c,
      searchNames: [c.name, c.name_jp, c.name_kr, c.name_zh, c.id, c.slug]
        .filter((s): s is string => !!s)
        .map(norm),
      displayName: l(c, 'name', lang),
    }))
  }, [chars, lang])

  const filtered = useMemo(() => {
    const q = norm(query)
    const elemSet = new Set(elementFilter)
    const classSet = new Set(classFilter)
    const raritySet = new Set(rarityFilter)
    return indexed
      .filter(({ char, searchNames }) => {
        if (q && !searchNames.some(name => name.includes(q))) return false
        if (elemSet.size && !elemSet.has(char.element)) return false
        if (classSet.size && !classSet.has(char.class)) return false
        if (raritySet.size && !raritySet.has(char.rarity as RarityType)) return false
        return true
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [indexed, query, elementFilter, classFilter, rarityFilter])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ELEMENTS_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...ELEMENTS.map(v => ({ name: v, value: v as string })),
  ], [t])

  const CLASSES_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...CLASSES.map(v => ({ name: v, value: v as string })),
  ], [t])

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-2 py-6 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">{t('common.search')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 border-b border-zinc-800 p-3">
          <FilterSearch
            value={query}
            onChange={setQuery}
            placeholder={t('search.placeholder')}
          />

          {/* Rarity */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-wide text-zinc-300">{t('filters.rarity')}</p>
            <div className="flex justify-center gap-2">
              <FilterPill
                active={rarityFilter.length === 0}
                onClick={() => setRarityFilter([])}
                className="h-8 px-3"
              >
                {t('common.all')}
              </FilterPill>
              {RARITIES.map(r => (
                <FilterPill
                  key={r}
                  active={rarityFilter.includes(r)}
                  onClick={() => toggleArray(setRarityFilter, r, RARITIES)}
                  className="h-8 px-3"
                >
                  <div className="flex items-center -space-x-1">
                    {Array.from({ length: r }, (_, i) => (
                      <Image
                        key={i}
                        src="/images/ui/star/CM_icon_star_y.webp"
                        alt="star"
                        width={16}
                        height={16}
                        style={{ width: 16, height: 16 }}
                      />
                    ))}
                  </div>
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Elements + Classes */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-6">
            <IconFilterGroup
              label={t('filters.elements')}
              items={ELEMENTS_UI}
              filter={elementFilter}
              onToggle={v => toggleArray(setElementFilter, v, ELEMENTS as readonly string[])}
              onReset={() => setElementFilter([])}
              imagePath={v => `/images/ui/elem/CM_Element_${v}.webp`}
            />
            <IconFilterGroup
              label={t('filters.classes')}
              items={CLASSES_UI}
              filter={classFilter}
              onToggle={v => toggleArray(setClassFilter, v, CLASSES as readonly string[])}
              onReset={() => setClassFilter([])}
              imagePath={v => `/images/ui/class/CM_Class_${v}.webp`}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">No characters match.</div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {filtered.map(({ char, displayName }) => (
                <li key={char.id}>
                  <button
                    type="button"
                    onClick={() => { onPick(char.id); onClose() }}
                    className={`group flex w-full flex-col items-center gap-1 rounded border p-1 transition-colors ${
                      selectedId === char.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
                    }`}
                  >
                    <CharacterPortrait
                      id={char.id}
                      name={displayName}
                      size="sm"
                      showIcons
                      showStars
                    />
                    <span className="line-clamp-2 text-center text-[10px] leading-tight text-zinc-300">
                      {displayName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
          {filtered.length} / {chars.length} characters
        </div>
      </div>
    </div>
  )
}
