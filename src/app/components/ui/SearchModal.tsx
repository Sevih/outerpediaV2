'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaSearch } from 'react-icons/fa';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { ALL_PAGES } from '@/lib/nav';
import type { CharacterIndexMap } from '@/types/character';


export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Search"
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
    >
      <FaSearch className="text-xs" />
      <span className="hidden text-xs text-zinc-500 lg:inline">Ctrl+K</span>
    </button>
  );
}

export default function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [charIndex, setCharIndex] = useState<CharacterIndexMap | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Load character index on first open
  useEffect(() => {
    if (open && !charIndex) {
      fetch('/api/search-index')
        .then((r) => r.json())
        .then((data: CharacterIndexMap) => setCharIndex(data))
        .catch(() => {});
    }
  }, [open, charIndex]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // Filter results
  const pageResults = useMemo(() => {
    if (!query.trim()) return ALL_PAGES;
    const q = query.toLowerCase();
    return ALL_PAGES.filter((p) => t(p.key).toLowerCase().includes(q));
  }, [query, t]);

  const charResults = useMemo(() => {
    if (!charIndex || !query.trim()) return [];
    const q = query.toLowerCase();
    return Object.values(charIndex)
      .filter((c) => {
        const name = l(c, 'Fullname', lang);
        return name.toLowerCase().includes(q) || c.Fullname.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [charIndex, query, lang]);

  const allResults = useMemo(() => [
    ...pageResults.map((p) => ({ type: 'page' as const, ...p })),
    ...charResults.map((c) => ({ type: 'char' as const, ...c })),
  ], [pageResults, charResults]);

  // Reset selection on results change
  useEffect(() => { setSelectedIdx(0); }, [allResults.length]);

  const navigate = useCallback((idx: number) => {
    const item = allResults[idx];
    if (!item) return;
    if (item.type === 'page') {
      router.push(`/${lang}${item.href}` as never);
    } else {
      router.push(`/${lang}/characters` as never);
    }
    onClose();
  }, [allResults, lang, router, onClose]);

  // Keyboard navigation
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate(selectedIdx);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [allResults.length, selectedIdx, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-zinc-700 px-4 py-3">
          <FaSearch className="shrink-0 text-sm text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {/* Pages */}
          {pageResults.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-semibold text-zinc-500">{t('search.pages')}</p>
              {pageResults.map((page, i) => {
                const idx = i;
                return (
                  <button
                    key={page.href}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedIdx === idx ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                    onClick={() => navigate(idx)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    {t(page.key)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Characters */}
          {charResults.length > 0 && (
            <div className="mt-1">
              <p className="px-2 py-1 text-xs font-semibold text-zinc-500">{t('search.characters')}</p>
              {charResults.map((char, i) => {
                const idx = pageResults.length + i;
                const displayName = l(char, 'Fullname', lang);
                return (
                  <button
                    key={char.slug}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedIdx === idx ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                    onClick={() => navigate(idx)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <div className="relative size-8 shrink-0 overflow-hidden rounded">
                      <Image
                        src={`/images/characters/portrait/CT_${char.slug}.webp`}
                        alt={displayName}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    </div>
                    <span className="flex-1">{displayName}</span>
                    <div className="flex items-center gap-1">
                      <div className="relative size-4">
                        <Image
                          src={`/images/ui/elem/CM_Element_${char.Element}.webp`}
                          alt={char.Element}
                          fill
                          sizes="16px"
                          className="object-contain"
                        />
                      </div>
                      <div className="relative size-4">
                        <Image
                          src={`/images/ui/class/CM_Class_${char.Class}.webp`}
                          alt={char.Class}
                          fill
                          sizes="16px"
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query.trim() && pageResults.length === 0 && charResults.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-zinc-500">
              {t('search.no_results')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
