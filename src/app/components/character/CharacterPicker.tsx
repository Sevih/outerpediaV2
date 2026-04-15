'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import type { CharacterListEntry } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { ELEMENTS, CLASSES } from '@/types/enums';
import { l } from '@/lib/i18n/localize';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { FilterSearch } from '@/app/components/ui/FilterPills';

export function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim();
}

export function getSearchableNames(char: CharacterListEntry, langs: readonly Lang[]): string[] {
  return [
    ...langs.map(lang => norm(l(char, 'Fullname', lang))).filter(Boolean),
    norm(char.ID),
    norm(char.slug),
  ];
}

export interface CharacterPickerLabels {
  title?: string;
  searchPlaceholder?: string;
  all?: string;
  empty?: string;
}

const DEFAULT_LABELS: Required<CharacterPickerLabels> = {
  title: 'Pick a character',
  searchPlaceholder: 'Search',
  all: 'All',
  empty: 'No characters found.',
};

export function CharacterPicker({
  characters,
  excludeIds,
  lang = 'en',
  labels,
  onPick,
  onClose,
}: {
  characters: CharacterListEntry[];
  excludeIds?: Set<string>;
  lang?: Lang;
  labels?: CharacterPickerLabels;
  onPick: (char: CharacterListEntry) => void;
  onClose: () => void;
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const [query, setQuery] = useState('');
  const [elementFilter, setElementFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const indexed = useMemo(() =>
    characters.map(char => ({
      ...char,
      searchNames: getSearchableNames(char, LANGS),
      displayName: l(char, 'Fullname', lang),
    })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
  [characters, lang]);

  const filtered = useMemo(() => {
    const q = norm(query);
    return indexed.filter(char => {
      if (excludeIds?.has(char.ID)) return false;
      if (q && !char.searchNames.some(name => name.includes(q))) return false;
      if (elementFilter && char.Element !== elementFilter) return false;
      if (classFilter && char.Class !== classFilter) return false;
      return true;
    });
  }, [indexed, query, elementFilter, classFilter, excludeIds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-8 md:pt-16 overflow-y-auto"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-4xl rounded-xl bg-zinc-900 p-4 md:p-6 shadow-2xl mx-2 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-100">{L.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <FilterSearch value={query} onChange={setQuery} placeholder={L.searchPlaceholder} />

        {/* Element filter */}
        <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
          <button
            type="button"
            onClick={() => setElementFilter(null)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${!elementFilter ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            {L.all}
          </button>
          {ELEMENTS.map(el => (
            <button
              key={el}
              type="button"
              onClick={() => setElementFilter(prev => prev === el ? null : el)}
              className={`rounded-md p-1.5 transition ${elementFilter === el ? 'bg-zinc-600 ring-1 ring-zinc-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            >
              <Image src={`/images/ui/elem/CM_Element_${el}.webp`} alt={el} width={20} height={20} />
            </button>
          ))}
        </div>

        {/* Class filter */}
        <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
          {CLASSES.map(cl => (
            <button
              key={cl}
              type="button"
              onClick={() => setClassFilter(prev => prev === cl ? null : cl)}
              className={`rounded-md p-1.5 transition ${classFilter === cl ? 'bg-zinc-600 ring-1 ring-zinc-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            >
              <Image src={`/images/ui/class/CM_Class_${cl}.webp`} alt={cl} width={20} height={20} />
            </button>
          ))}
        </div>

        {/* Character grid */}
        <div className="mt-4 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map(char => (
            <button
              key={char.ID}
              type="button"
              onClick={() => onPick(char)}
              className="flex flex-col items-center gap-0.5 hover:opacity-80 transition rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <CharacterPortrait
                id={char.ID}
                name={char.displayName}
                element={char.Element}
                classType={char.Class}
                size={{ base: 'sm', md: 'md' }}
                showIcons
              />
              <span className="text-[9px] md:text-[11px] text-zinc-400 truncate max-w-12 md:max-w-16 leading-tight">{char.displayName}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-500 py-8">{L.empty}</p>
        )}
      </div>
    </div>
  );
}
