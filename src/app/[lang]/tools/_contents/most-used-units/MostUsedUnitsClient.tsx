'use client';

import { useEffect, useDeferredValue, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import type { RarityType } from '@/types/enums';
import { ELEMENTS, CLASSES, RARITIES } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { LANGS } from '@/lib/i18n/config';
import { encodeFilters, decodeFilters, isEmptyPayload, type FilterPayload } from '@/lib/filter-url';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { FilterPill, FilterSearch, IconFilterGroup } from '@/app/components/ui/FilterPills';
import type { TranslationKey } from '@/i18n/locales/en';
import type { MostUsedEntry, GuideTitleMap, MostUsedCharacter } from './index';

const GUIDE_CATEGORIES = [
  'world-boss',
  'joint-challenge',
  'guild-raid',
  'adventure',
  'adventure-license',
  'special-request',
  'irregular-extermination',
  'skyward-tower',
] as const;

type Props = {
  characters: MostUsedCharacter[];
  usage: MostUsedEntry[];
  guideTitles: GuideTitleMap;
};

export default function MostUsedUnitsClient({ characters, usage, guideTitles }: Props) {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const [elementFilter, setElementFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<typeof GUIDE_CATEGORIES[number][]>([]);
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // URL sync refs
  const lastSerializedRef = useRef('');
  const didHydrateFromURL = useRef(false);

  // Build payload
  const payload = useMemo<FilterPayload>(() => ({
    el: elementFilter.length ? elementFilter : undefined,
    cl: classFilter.length ? classFilter : undefined,
    r: rarityFilter.length ? rarityFilter : undefined,
    cat: categoryFilter.length ? categoryFilter : undefined,
    q: rawQuery.trim() || undefined,
  }), [elementFilter, classFilter, rarityFilter, categoryFilter, rawQuery]);

  // Hydrate from URL on mount
  useEffect(() => {
    if (didHydrateFromURL.current) return;
    didHydrateFromURL.current = true;
    const z = new URLSearchParams(window.location.search).get('z');
    const decoded = decodeFilters(z);
    if (decoded) {
      if (decoded.el?.length) setElementFilter(decoded.el);
      if (decoded.cl?.length) setClassFilter(decoded.cl);
      if (decoded.r?.length) setRarityFilter(decoded.r as RarityType[]);
      if (decoded.cat?.length) setCategoryFilter(decoded.cat as typeof GUIDE_CATEGORIES[number][]);
      if (decoded.q) setRawQuery(decoded.q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters → URL
  useEffect(() => {
    const handle = setTimeout(() => {
      const serialized = isEmptyPayload(payload) ? pathname : `${pathname}?z=${encodeFilters(payload)}`;
      if (lastSerializedRef.current !== serialized) {
        lastSerializedRef.current = serialized;
        router.replace(serialized as never, { scroll: false });
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [pathname, router, payload]);

  const toggleArray = <T,>(
    setter: React.Dispatch<React.SetStateAction<T[]>>, value: T, allValues?: readonly T[],
  ) => {
    setter(prev => {
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
      return allValues && next.length === allValues.length ? [] : next;
    });
  };

  // Build character map by slug
  const charBySlug = useMemo(() => {
    const map = new Map<string, MostUsedCharacter>();
    for (const char of characters) map.set(char.slug, char);
    return map;
  }, [characters]);

  // Enrich usage data with character info
  const enriched = useMemo(() =>
    usage
      .map(entry => {
        const char = charBySlug.get(entry.slug);
        if (!char) return null;
        const displayName = l(char, 'Fullname', lang);
        const searchNames = LANGS.map(lg => l(char, 'Fullname', lg).normalize('NFKC').toLowerCase()).filter(Boolean);
        return { ...entry, char, displayName, searchNames };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null),
    [usage, charBySlug, lang],
  );

  // Filter
  const filtered = useMemo(() => {
    const q = query.normalize('NFKC').toLowerCase().trim();
    const elemSet = new Set(elementFilter);
    const classSet = new Set(classFilter);
    const raritySet = new Set(rarityFilter);
    const catSet = new Set(categoryFilter);

    return enriched
      .map(entry => {
        const { char } = entry;
        if (q && !entry.searchNames.some(name => name.includes(q))) return null;
        if (elemSet.size && !elemSet.has(char.Element)) return null;
        if (classSet.size && !classSet.has(char.Class)) return null;
        if (raritySet.size && !raritySet.has(char.Rarity)) return null;

        if (catSet.size) {
          const filteredCats: Record<string, string[]> = {};
          let total = 0;
          for (const cat of categoryFilter) {
            if (entry.categories[cat]) {
              filteredCats[cat] = entry.categories[cat];
              total += entry.categories[cat].length;
            }
          }
          if (total === 0) return null;
          return { ...entry, total, categories: filteredCats };
        }

        return entry;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.total - a.total);
  }, [enriched, query, elementFilter, classFilter, rarityFilter, categoryFilter]);

  // UI filter arrays
  const ELEMENTS_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...ELEMENTS.map(v => ({ name: v, value: v })),
  ], [t]);

  const CLASSES_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...CLASSES.map(v => ({ name: v, value: v })),
  ], [t]);

  /** Resolve a guide slug to its localized title */
  const guideTitle = (guideSlug: string): string => {
    const titles = guideTitles[guideSlug];
    if (titles) return titles[lang] || titles.en || guideSlug;
    // Tower guides: format "very-hard-tower" → "Very Hard Tower"
    return guideSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  /** Get the href for a guide */
  const guideHref = (category: string, guideSlug: string): string | null => {
    if (category === 'skyward-tower') return href(`/guides/skyward-tower/${guideSlug.replace('-tower', '')}`);
    return href(`/guides/${category}/${guideSlug}`);
  };

  return (
    <div className="mx-auto max-w-250 space-y-3">
      {/* Search */}
      <FilterSearch value={rawQuery} onChange={setRawQuery} placeholder={t('search.placeholder')} />

      {/* Rarity */}
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300">{t('filters.rarity')}</p>
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
                <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="star" width={16} height={16} style={{ width: 16, height: 16 }} />
              ))}
            </div>
          </FilterPill>
        ))}
      </div>

      {/* Elements + Classes */}
      <div className="mx-auto max-w-205 grid grid-cols-1 md:grid-cols-2 gap-y-2 md:gap-x-6 place-items-center">
        <IconFilterGroup
          label={t('filters.elements')}
          items={ELEMENTS_UI}
          filter={elementFilter}
          onToggle={v => toggleArray(setElementFilter, v, ELEMENTS)}
          onReset={() => setElementFilter([])}
          imagePath={v => `/images/ui/elem/CM_Element_${v}.webp`}
        />
        <IconFilterGroup
          label={t('filters.classes')}
          items={CLASSES_UI}
          filter={classFilter}
          onToggle={v => toggleArray(setClassFilter, v, CLASSES)}
          onReset={() => setClassFilter([])}
          imagePath={v => `/images/ui/class/CM_Class_${v}.webp`}
        />
      </div>

      {/* Category filter */}
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300">
        {t('tools.most-used-units.category_filter' as TranslationKey)}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <FilterPill
          active={categoryFilter.length === 0}
          onClick={() => setCategoryFilter([])}
          className="h-8 px-3"
        >
          {t('common.all')}
        </FilterPill>
        {GUIDE_CATEGORIES.map(cat => (
          <FilterPill
            key={cat}
            active={categoryFilter.includes(cat)}
            onClick={() => toggleArray(setCategoryFilter, cat, GUIDE_CATEGORIES)}
            className="h-8 px-3"
          >
            {t(`guides.category.${cat}` as TranslationKey)}
          </FilterPill>
        ))}
      </div>

      {/* Results */}
      <div className="mt-6 space-y-2">
        {filtered.map((entry, index) => {
          const isExpanded = expandedSlug === entry.slug;
          const catEntries = Object.entries(entry.categories);
          const MAX_PILLS = 3;
          const visiblePills = catEntries.slice(0, MAX_PILLS);
          const extraCount = catEntries.length - MAX_PILLS;

          return (
            <div key={entry.slug}>
              <button
                type="button"
                onClick={() => setExpandedSlug(isExpanded ? null : entry.slug)}
                className={[
                  'flex w-full items-center gap-3 md:gap-4 px-3 md:px-4 py-3 text-left transition cursor-pointer',
                  'rounded-lg border border-zinc-700/40',
                  'hover:bg-zinc-800/80',
                  isExpanded ? 'bg-zinc-800/60 rounded-b-none' : 'bg-zinc-900/40',
                ].join(' ')}
              >
                {/* Rank */}
                <span className="w-8 shrink-0 text-center text-lg font-bold text-zinc-500">
                  #{index + 1}
                </span>

                {/* Portrait */}
                <CharacterPortrait
                  id={entry.char.ID}
                  size={{ base: 'md', md: 'lg' }}
                  showIcons
                  showStars
                  priority={index <= 5}
                />

                {/* Name + element/class */}
                <div className="flex-1 min-w-0">
                  <span className="truncate text-sm md:text-base font-semibold text-white block">
                    {entry.displayName}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Image src={`/images/ui/elem/CM_Element_${entry.char.Element}.webp`} alt={entry.char.Element} width={16} height={16} className="h-4 w-4" />
                      {entry.char.Element}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Image src={`/images/ui/class/CM_Class_${entry.char.Class}.webp`} alt={entry.char.Class} width={16} height={16} className="h-4 w-4" />
                      {entry.char.Class}
                    </span>
                  </div>
                </div>

                {/* Guide count */}
                <div className="shrink-0 text-center">
                  <span className="text-2xl md:text-3xl font-bold text-sky-400">{entry.total}</span>
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wide">guides</span>
                </div>

                {/* Category pills (desktop) */}
                <div className="hidden md:flex shrink-0 flex-wrap gap-1 max-w-60">
                  {visiblePills.map(([cat]) => (
                    <span
                      key={cat}
                      className="rounded bg-zinc-700/40 px-2 py-0.5 text-[11px] text-zinc-400"
                    >
                      {t(`guides.category.${cat}` as TranslationKey)}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className="rounded bg-zinc-700/40 px-2 py-0.5 text-[11px] text-zinc-500">
                      +{extraCount}
                    </span>
                  )}
                </div>

                {/* Chevron */}
                <svg
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-x border-b border-zinc-700/40 bg-zinc-800/40 px-4 py-3 rounded-b-lg">
                  {/* Mobile category pills */}
                  <div className="md:hidden flex flex-wrap gap-1 mb-3">
                    {catEntries.map(([cat]) => (
                      <span
                        key={cat}
                        className="rounded bg-zinc-700/40 px-2 py-0.5 text-[11px] text-zinc-400"
                      >
                        {t(`guides.category.${cat}` as TranslationKey)}
                      </span>
                    ))}
                  </div>

                  {/* Guide list grouped by category */}
                  <div className="space-y-3">
                    {catEntries.map(([cat, guidesSlugs]) => (
                      <div key={cat}>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                          {t(`guides.category.${cat}` as TranslationKey)}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {guidesSlugs.map(gs => {
                            const link = guideHref(cat, gs);
                            const title = guideTitle(gs);
                            return link ? (
                              <Link
                                key={gs}
                                href={link as never}
                                className="rounded bg-zinc-700/50 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600/50 hover:text-white transition"
                              >
                                {title}
                              </Link>
                            ) : (
                              <span key={gs} className="rounded bg-zinc-700/50 px-2 py-1 text-xs text-zinc-300">
                                {title}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Count */}
      <p className="text-center text-xs text-zinc-500">
        {filtered.length} / {enriched.length}
      </p>
    </div>
  );
}
