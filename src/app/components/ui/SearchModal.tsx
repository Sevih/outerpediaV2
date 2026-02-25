'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaSearch } from 'react-icons/fa';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l, lRec } from '@/lib/i18n/localize';
import { ALL_PAGES } from '@/lib/nav';
import { FILTER } from '@/lib/theme';
import type { CharacterIndexMap } from '@/types/character';
import type { SearchExtras, EquipmentSearchItem } from '@/app/api/search-index/extras/route';


export function SearchTrigger({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      onClick={onClick}
      aria-label={t('common.search')}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
    >
      <FaSearch className="text-xs" />
      <span className="hidden text-xs text-zinc-500 lg:inline">Ctrl+K</span>
    </button>
  );
}

const EQUIP_TYPE_LABELS: Record<EquipmentSearchItem['type'], string> = {
  weapon: 'Weapon',
  amulet: 'Accessory',
  talisman: 'Talisman',
  set: 'Set',
  ee: 'EE',
};

function getEquipImage(item: EquipmentSearchItem): string {
  if (item.type === 'set') return `/images/equipment/${item.image}.webp`;
  if (item.type === 'ee') return `/images/ui/effect/${item.image}.webp`;
  return `/images/equipment/${item.image}.webp`;
}

export default function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lang, t, href: buildHref } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [charIndex, setCharIndex] = useState<CharacterIndexMap | null>(null);
  const [extras, setExtras] = useState<SearchExtras | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevResultsLen, setPrevResultsLen] = useState(0);

  // Reset state when modal opens (adjust-state-during-render pattern)
  if (open && !prevOpen) {
    setPrevOpen(true);
    setQuery('');
    setSelectedIdx(0);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Load search data on first open
  useEffect(() => {
    if (open && !charIndex) {
      fetch('/api/search-index')
        .then((r) => r.json())
        .then((data: CharacterIndexMap) => setCharIndex(data))
        .catch(() => {});
    }
    if (open && !extras) {
      fetch('/api/search-index/extras')
        .then((r) => r.json())
        .then((data: SearchExtras) => setExtras(data))
        .catch(() => {});
    }
  }, [open, charIndex, extras]);

  // Focus input on open
  useEffect(() => {
    if (open) {
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
    return Object.entries(charIndex)
      .filter(([id, c]) => {
        const name = l(c, 'Fullname', lang);
        return name.toLowerCase().includes(q) || c.Fullname.toLowerCase().includes(q)
          || id.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
      })
      .slice(0, 8)
      .map(([id, c]) => ({ ...c, _id: id }));
  }, [charIndex, query, lang]);

  const equipResults = useMemo(() => {
    if (!extras || !query.trim()) return [];
    const q = query.toLowerCase();
    return extras.equipment
      .filter((e) => {
        const localizedName = l(e, 'name', lang);
        return localizedName.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
          || e.slug.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [extras, query, lang]);

  const guideResults = useMemo(() => {
    if (!extras || !query.trim()) return [];
    const q = query.toLowerCase();
    return extras.guides
      .filter((g) => {
        const localizedTitle = lRec(g.title, lang);
        return localizedTitle.toLowerCase().includes(q)
          || (g.title.en ?? '').toLowerCase().includes(q)
          || g.slug.toLowerCase().includes(q);
      })
      .slice(0, 5);
  }, [extras, query, lang]);

  type ResultItem =
    | { type: 'page'; key: string; href: string }
    | { type: 'char'; _id: string; slug: string; [k: string]: unknown }
    | { type: 'equip'; slug: string; [k: string]: unknown }
    | { type: 'guide'; slug: string; category: string; [k: string]: unknown };

  const allResults = useMemo<ResultItem[]>(() => [
    ...pageResults.map((p) => ({ type: 'page' as const, ...p })),
    ...charResults.map((c) => ({ type: 'char' as const, ...c })),
    ...equipResults.map((e) => ({ ...e, type: 'equip' as const })),
    ...guideResults.map((g) => ({ type: 'guide' as const, ...g })),
  ], [pageResults, charResults, equipResults, guideResults]);

  // Reset selection on results change (adjust-state-during-render pattern)
  if (allResults.length !== prevResultsLen) {
    setPrevResultsLen(allResults.length);
    setSelectedIdx(0);
  }

  const navigate = useCallback((idx: number) => {
    const item = allResults[idx];
    if (!item) return;
    if (item.type === 'page') {
      router.push(buildHref(item.href) as never);
    } else if (item.type === 'char') {
      router.push(buildHref(`/characters/${item.slug}`) as never);
    } else if (item.type === 'equip') {
      router.push(buildHref(`/equipments/${item.slug}`) as never);
    } else if (item.type === 'guide') {
      router.push(buildHref(`/guides/${item.category}/${item.slug}`) as never);
    }
    onClose();
  }, [allResults, buildHref, router, onClose]);

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

  const charOffset = pageResults.length;
  const equipOffset = charOffset + charResults.length;
  const guideOffset = equipOffset + equipResults.length;

  const hasNoResults = query.trim()
    && pageResults.length === 0
    && charResults.length === 0
    && equipResults.length === 0
    && guideResults.length === 0;

  return createPortal(
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
                      selectedIdx === idx ? `${FILTER.active} text-white` : `text-zinc-300 ${FILTER.hover}`
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
                const idx = charOffset + i;
                const displayName = l(char, 'Fullname', lang);
                return (
                  <button
                    key={char.slug}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedIdx === idx ? `${FILTER.active} text-white` : `text-zinc-300 ${FILTER.hover}`
                    }`}
                    onClick={() => navigate(idx)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <CharacterPortrait id={char._id} name={displayName} size="xs" className="shrink-0" />
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

          {/* Equipment */}
          {equipResults.length > 0 && (
            <div className="mt-1">
              <p className="px-2 py-1 text-xs font-semibold text-zinc-500">{t('search.equipment')}</p>
              {equipResults.map((equip, i) => {
                const idx = equipOffset + i;
                const displayName = l(equip, 'name', lang);
                return (
                  <button
                    key={equip.slug}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedIdx === idx ? `${FILTER.active} text-white` : `text-zinc-300 ${FILTER.hover}`
                    }`}
                    onClick={() => navigate(idx)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <div className="relative size-6 shrink-0">
                      <Image
                        src={getEquipImage(equip)}
                        alt=""
                        fill
                        sizes="24px"
                        className="object-contain"
                      />
                    </div>
                    <span className="flex-1">{displayName}</span>
                    <span className="text-xs text-zinc-500">{EQUIP_TYPE_LABELS[equip.type]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Guides */}
          {guideResults.length > 0 && (
            <div className="mt-1">
              <p className="px-2 py-1 text-xs font-semibold text-zinc-500">{t('search.guides')}</p>
              {guideResults.map((guide, i) => {
                const idx = guideOffset + i;
                const displayTitle = lRec(guide.title, lang);
                return (
                  <button
                    key={guide.slug}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedIdx === idx ? `${FILTER.active} text-white` : `text-zinc-300 ${FILTER.hover}`
                    }`}
                    onClick={() => navigate(idx)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <div className="relative size-6 shrink-0">
                      <Image
                        src={guide.categoryIcon}
                        alt=""
                        fill
                        sizes="24px"
                        className="object-contain"
                      />
                    </div>
                    <span className="flex-1">{displayTitle}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {hasNoResults && (
            <p className="px-3 py-4 text-center text-sm text-zinc-500">
              {t('search.no_results')}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
