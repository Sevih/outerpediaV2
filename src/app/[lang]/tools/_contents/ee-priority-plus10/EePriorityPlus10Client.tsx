'use client';

import { useEffect, useDeferredValue, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import type { CharacterListEntry } from '@/types/character';
import type { RarityType } from '@/types/enums';
import { ELEMENTS, CLASSES, RARITIES } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import { LANGS } from '@/lib/i18n/config';
import { encodeFilters, decodeFilters, isEmptyPayload, type FilterPayload } from '@/lib/filter-url';
import ResponsiveCharacterCard from '@/app/components/character/ResponsiveCharacterCard';
import FiltersTopBar from '@/app/components/ui/FiltersTopBar';

const TIERS = ['S', 'A', 'B', 'C', 'D', 'E'] as const;
type Tier = typeof TIERS[number];

const TIER_COLORS: Record<Tier, string> = {
  S: 'from-amber-500/30 to-amber-900/10 border-amber-500/50',
  A: 'from-orange-600/30 to-orange-900/10 border-orange-500/50',
  B: 'from-blue-500/30 to-blue-900/10 border-blue-500/50',
  C: 'from-green-500/30 to-green-900/10 border-green-500/50',
  D: 'from-zinc-500/30 to-zinc-900/10 border-zinc-500/50',
  E: 'from-amber-900/30 to-amber-950/10 border-amber-800/50',
};

type EeCharacter = CharacterListEntry & { eeRank: string };

type Props = {
  characters: EeCharacter[];
};

export default function EePriorityPlus10Client({ characters }: Props) {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const [elementFilter, setElementFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);

  // URL sync refs
  const lastSerializedRef = useRef('');
  const didHydrateFromURL = useRef(false);

  // Build payload
  const payload = useMemo<FilterPayload>(() => ({
    el: elementFilter.length ? elementFilter : undefined,
    cl: classFilter.length ? classFilter : undefined,
    r: rarityFilter.length ? rarityFilter : undefined,
    q: rawQuery.trim() || undefined,
  }), [elementFilter, classFilter, rarityFilter, rawQuery]);

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

  const resolved = useMemo(() =>
    characters.map(char => {
      const displayName = l(char, 'Fullname', lang);
      const nameParts = splitCharacterName(displayName, lang);
      const searchNames = LANGS.map(lg => l(char, 'Fullname', lg).normalize('NFKC').toLowerCase()).filter(Boolean);
      return { ...char, displayName, prefix: nameParts.prefix, searchNames };
    }), [characters, lang]);

  const filtered = useMemo(() => {
    const q = query.normalize('NFKC').toLowerCase().trim();
    const elemSet = new Set(elementFilter);
    const classSet = new Set(classFilter);
    const raritySet = new Set(rarityFilter);

    return resolved.filter(char => {
      if (q && !char.searchNames.some(name => name.includes(q))) return false;
      if (elemSet.size && !elemSet.has(char.Element)) return false;
      if (classSet.size && !classSet.has(char.Class)) return false;
      if (raritySet.size && !raritySet.has(char.Rarity)) return false;
      return true;
    });
  }, [resolved, query, elementFilter, classFilter, rarityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<Tier, typeof filtered>();
    for (const tier of TIERS) map.set(tier, []);
    for (const char of filtered) {
      const tier = char.eeRank as Tier;
      if (map.has(tier)) map.get(tier)!.push(char);
    }
    for (const chars of map.values()) {
      chars.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return map;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-350 space-y-3">
      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-zinc-300">
        <span className="mr-1.5">⚠️</span>{t('tierlist.disclaimer_ee_plus10')}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        {TIERS.map(tier => (
          <div key={tier} className="flex items-center gap-1">
            <Image src={`/images/ui/rank/IG_Event_Rank_${tier}.webp`} alt={tier} width={20} height={20} style={{ width: 20, height: 20 }} />
            <span>{t(`tierlist.legend.${tier}`)}</span>
          </div>
        ))}
      </div>

      {/* Top bar — search + element + class + rarity on one row */}
      <FiltersTopBar
        query={rawQuery}
        onQueryChange={setRawQuery}
        placeholder={t('characters.filters.search_placeholder')}
        elementFilter={elementFilter}
        onToggleElement={v => toggleArray(setElementFilter, v, ELEMENTS as readonly string[])}
        classFilter={classFilter}
        onToggleClass={v => toggleArray(setClassFilter, v, CLASSES as readonly string[])}
        rarityFilter={rarityFilter}
        onToggleRarity={v => toggleArray(setRarityFilter, v, RARITIES)}
      />

      {/* Tier groups */}
      <div className="mt-6 space-y-4">
        {TIERS.map(tier => {
          const chars = grouped.get(tier);
          if (!chars || chars.length === 0) return null;
          return (
            <div
              key={tier}
              className={`rounded-xl border bg-linear-to-r ${TIER_COLORS[tier]} overflow-hidden`}
            >
              <div className="flex items-center gap-3">
                <div className="flex min-h-20 w-16 shrink-0 items-center justify-center md:w-20">
                  <div className="relative h-12 w-12 md:h-14 md:w-14">
                    <Image
                      src={`/images/ui/rank/IG_Event_Rank_${tier}.webp`}
                      alt={`Tier ${tier}`}
                      fill
                      sizes="56px"
                      className="object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 py-3 pr-3 lg:gap-3">
                  {chars.map((char, index) => (
                    <ResponsiveCharacterCard
                      key={char.ID}
                      id={char.ID}
                      name={char.displayName}
                      prefix={char.prefix}
                      element={char.Element}
                      classType={char.Class}
                      rarity={char.Rarity}
                      tags={char.tags}
                      href={href(`/characters/${char.slug}`)}
                      size={{ base: 'sm', md: 'sm', lg: 'md' }}
                      priority={tier === 'S' && index <= 5}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Count */}
      <p className="text-center text-xs text-zinc-500">
        {filtered.length} {t('tierlist.characters_count')}
      </p>
    </div>
  );
}
