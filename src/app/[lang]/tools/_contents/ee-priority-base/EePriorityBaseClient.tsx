'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Image from 'next/image';
import type { CharacterListEntry } from '@/types/character';
import type { RarityType } from '@/types/enums';
import { ELEMENTS, CLASSES, RARITIES } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import { LANGS } from '@/lib/i18n/config';
import ResponsiveCharacterCard from '@/app/components/character/ResponsiveCharacterCard';
import { FilterPill, FilterSearch, IconFilterGroup } from '@/app/components/ui/FilterPills';

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

export default function EePriorityBaseClient({ characters }: Props) {
  const { lang, t, href } = useI18n();

  const [elementFilter, setElementFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);

  const toggleArray = <T,>(
    setter: React.Dispatch<React.SetStateAction<T[]>>, value: T, allValues?: readonly T[],
  ) => {
    setter(prev => {
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
      return allValues && next.length === allValues.length ? [] : next;
    });
  };

  const ELEMENTS_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...ELEMENTS.map(v => ({ name: v, value: v })),
  ], [t]);

  const CLASSES_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...CLASSES.map(v => ({ name: v, value: v })),
  ], [t]);

  const resolved = useMemo(() =>
    characters.map(char => {
      const displayName = l(char, 'Fullname', lang);
      const nameParts = splitCharacterName(char.ID, displayName, lang);
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
        <span className="mr-1.5">⚠️</span>{t('tierlist.disclaimer_ee_base')}
      </div>

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
