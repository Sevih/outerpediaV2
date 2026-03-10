'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CharacterListEntry } from '@/types/character';
import type { Lang } from '@/types/common';
import { SUFFIX_LANGS } from '@/lib/i18n/config';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import EquipmentIcon from '@/app/components/equipment/EquipmentIcon';
import { FilterPill, FilterSearch } from '@/app/components/ui/FilterPills';
import type { ItemRarity } from '@/lib/theme';
import type { TranslationKey } from '@/i18n/locales/en';
import type { GearCategory, GearUsageData, GearUsageEntry } from './index';

const CATEGORIES: { key: GearCategory; i18n: TranslationKey }[] = [
  { key: 'weapon', i18n: 'tools.gear-usage-statistics.tab.weapons' as TranslationKey },
  { key: 'amulet', i18n: 'tools.gear-usage-statistics.tab.amulets' as TranslationKey },
  { key: 'set', i18n: 'tools.gear-usage-statistics.tab.sets' as TranslationKey },
  { key: 'talisman', i18n: 'tools.gear-usage-statistics.tab.talismans' as TranslationKey },
];

type Props = {
  data: GearUsageData;
  characters: CharacterListEntry[];
};

export default function GearUsageStatisticsClient({ data, characters }: Props) {
  const { lang, t, href } = useI18n();

  const [category, setCategory] = useState<GearCategory>('weapon');
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);
  const [expandedName, setExpandedName] = useState<string | null>(null);

  // Character lookup
  const charById = useMemo(() => {
    const map = new Map<string, CharacterListEntry>();
    for (const c of characters) map.set(c.ID, c);
    return map;
  }, [characters]);

  // Current entries filtered by search
  const entries = useMemo(() => {
    const list = data[category];
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(e =>
      e.name.toLowerCase().includes(q) ||
      SUFFIX_LANGS.some(sl => e[`name_${sl}`]?.toLowerCase().includes(q))
    );
  }, [data, category, query]);

  const maxCount = entries.length > 0 ? entries[0].count : 1;

  return (
    <div className="mx-auto max-w-250 space-y-4">
      {/* Disclaimer */}
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-center text-sm text-zinc-300">
        {t('tools.gear-usage-statistics.disclaimer1' as TranslationKey)}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map(cat => (
          <FilterPill
            key={cat.key}
            active={category === cat.key}
            onClick={() => { setCategory(cat.key); setExpandedName(null); }}
            className="h-9 px-4"
          >
            <span className="flex items-center gap-1.5">
              {t(cat.i18n)}
              <span className="text-[10px] text-zinc-400">({data[cat.key].length})</span>
            </span>
          </FilterPill>
        ))}
      </div>

      {/* Search */}
      <FilterSearch value={rawQuery} onChange={setRawQuery} placeholder={t('search.placeholder')} />

      {/* Results */}
      <div className="space-y-1.5">
        {entries.map((entry, index) => (
          <GearRow
            key={entry.name}
            entry={entry}
            index={index}
            maxCount={maxCount}
            isExpanded={expandedName === entry.name}
            onToggle={() => setExpandedName(expandedName === entry.name ? null : entry.name)}
            charById={charById}
            lang={lang}
            href={href}
            category={category}
          />
        ))}
      </div>

      {/* Count */}
      <p className="text-center text-xs text-zinc-500">
        {entries.length} / {data[category].length}
      </p>
    </div>
  );
}

function GearRow({
  entry, index, maxCount, isExpanded, onToggle, charById, lang, href, category,
}: {
  entry: GearUsageEntry;
  index: number;
  maxCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  charById: Map<string, CharacterListEntry>;
  lang: Lang;
  href: (path: string) => string;
  category: GearCategory;
}) {
  const barWidth = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={[
          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition cursor-pointer',
          'rounded-lg border border-zinc-700/40',
          'hover:bg-zinc-800/80',
          isExpanded ? 'bg-zinc-800/60 rounded-b-none' : 'bg-zinc-900/40',
        ].join(' ')}
      >
        {/* Rank */}
        <span className="w-7 shrink-0 text-center text-sm font-bold text-zinc-500">
          #{index + 1}
        </span>

        {/* Equipment icon */}
        {entry.image && (
          <EquipmentIcon
            src={entry.image}
            rarity={entry.rarity as ItemRarity}
            alt={entry.name}
            size={40}
            effectIcon={entry.effectIcon}
            classType={entry.classType}
            overlaySize={14}
            level={category !== 'set' ? entry.level : undefined}
          />
        )}

        {/* Name + bar */}
        <div className="flex-1 min-w-0">
          <span className="truncate text-sm font-semibold text-white block">{l(entry, 'name', lang)}</span>
          <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-700/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500/70 transition-all"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Count */}
        <div className="shrink-0 text-center min-w-12">
          <span className="text-xl font-bold text-sky-400">{entry.count}</span>
          <span className="block text-[10px] text-zinc-500 uppercase tracking-wide">chars</span>
        </div>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded: character list */}
      {isExpanded && (
        <div className="border-x border-b border-zinc-700/40 bg-zinc-800/40 px-4 py-3 rounded-b-lg">
          <div className="flex flex-wrap gap-2">
            {entry.characters.map(({ id, slug }) => {
              const char = charById.get(id);
              if (!char) return null;
              const name = l(char, 'Fullname', lang);
              return (
                <Link
                  key={id}
                  href={href(`/characters/${slug}`) as never}
                  className="flex items-center gap-2 rounded-lg bg-zinc-700/30 px-2 py-1.5 hover:bg-zinc-600/40 transition"
                >
                  <CharacterPortrait id={id} size="sm" />
                  <span className="text-xs text-zinc-200">{name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
