'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { LANGS } from '@/lib/i18n/config';
import { EquipmentIcon } from '@/app/components/equipment';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { FilterSearch, FilterPill } from '@/app/components/ui/FilterPills';
import FitText from '@/app/components/ui/FitText';
import type { CharacterListEntry } from '@/types/character';
import type { TranslationKey } from '@/i18n/locales/en';
import type { ItemRarity } from '@/lib/theme';
import type { WithLocalizedFields } from '@/types/common';

export type EquipmentItem = WithLocalizedFields<{
  name: string;
  type: 'weapon' | 'amulet' | 'talisman' | 'set';
  rarity: ItemRarity;
  image: string;
  effectIcon: string | null;
  classType: string | null;
  level: number | null;
  users: { characterId: string; buildNames: string[] }[];
}, 'name'>;

const EQUIP_TYPES = ['weapon', 'amulet', 'set', 'talisman'] as const;
type EquipType = typeof EQUIP_TYPES[number];

const TYPE_I18N: Record<EquipType, TranslationKey> = {
  weapon: 'page.character.gear.weapon',
  amulet: 'page.character.gear.amulet',
  set: 'page.character.gear.set',
  talisman: 'page.character.gear.talisman',
};

type Props = {
  items: EquipmentItem[];
  characters: CharacterListEntry[];
};

export default function GearUsageFinderClient({ items, characters }: Props) {
  const { lang, t, href } = useI18n();

  const [typeFilter, setTypeFilter] = useState<EquipType | null>(null);
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [onlyUsed, setOnlyUsed] = useState(false);

  // Character map by ID
  const charById = useMemo(() => {
    const map = new Map<string, CharacterListEntry>();
    for (const c of characters) map.set(c.ID, c);
    return map;
  }, [characters]);

  // Enrich items with localized search names
  const enriched = useMemo(() =>
    items.map(item => {
      const displayName = l(item, 'name', lang);
      const searchNames = LANGS.map(lg => l(item, 'name', lg).normalize('NFKC').toLowerCase()).filter(Boolean);
      return { ...item, displayName, searchNames };
    }),
    [items, lang],
  );

  // Filter items
  const filtered = useMemo(() => {
    const q = query.normalize('NFKC').toLowerCase().trim();

    return enriched
      .filter(item => {
        if (typeFilter && item.type !== typeFilter) return false;
        if (onlyUsed && item.users.length === 0) return false;
        if (q && !item.searchNames.some((n: string) => n.includes(q))) return false;
        return true;
      })
      .sort((a, b) => b.users.length - a.users.length);
  }, [enriched, query, typeFilter, onlyUsed]);

  // Selected item
  const selectedItem = useMemo(() => {
    if (!selectedName) return null;
    return enriched.find(item => item.name === selectedName) ?? null;
  }, [enriched, selectedName]);

  return (
    <div className="mx-auto max-w-250 space-y-4">
      {/* Search */}
      <FilterSearch value={rawQuery} onChange={setRawQuery} placeholder={t('search.placeholder')} />

      {/* Type filter */}
      <div className="flex flex-wrap justify-center gap-2">
        <FilterPill
          active={typeFilter === null}
          onClick={() => setTypeFilter(null)}
          className="h-8 px-3"
        >
          {t('common.all')}
        </FilterPill>
        {EQUIP_TYPES.map(type => (
          <FilterPill
            key={type}
            active={typeFilter === type}
            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            className="h-8 px-3"
          >
            {t(TYPE_I18N[type])}
          </FilterPill>
        ))}
      </div>

      {/* Only used toggle */}
      <div className="flex justify-center">
        <FilterPill
          active={onlyUsed}
          onClick={() => setOnlyUsed(!onlyUsed)}
          className="h-8 px-3"
        >
          {t('tools.gear-usage-finder.only_used' as TranslationKey)}
        </FilterPill>
      </div>

      {/* Equipment grid */}
      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-1.5 sm:gap-2">
        {filtered.map(item => {
          const isSelected = selectedName === item.name;
          return (
            <button
              key={`${item.type}-${item.name}`}
              type="button"
              onClick={() => setSelectedName(isSelected ? null : item.name)}
              title={item.displayName}
              className={[
                'relative flex flex-col items-center gap-1 rounded-lg p-1 transition cursor-pointer',
                isSelected
                  ? 'bg-sky-500/20 ring-1 ring-sky-500'
                  : 'hover:bg-zinc-800/60',
                item.users.length === 0 ? 'opacity-40' : '',
              ].join(' ')}
            >
              <EquipmentIcon
                src={item.image}
                rarity={item.rarity}
                alt={item.displayName}
                size={48}
                effectIcon={item.effectIcon}
                classType={item.classType}
              />
              {item.users.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
                  {item.users.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Count */}
      <p className="text-center text-xs text-zinc-500">
        {filtered.length} / {enriched.length}
      </p>

      {/* Selected item detail */}
      {selectedItem && (
        <div className="mt-4 rounded-lg border border-zinc-700/40 bg-zinc-900/60 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <EquipmentIcon
              src={selectedItem.image}
              rarity={selectedItem.rarity}
              alt={selectedItem.displayName}
              size={56}
              effectIcon={selectedItem.effectIcon}
              classType={selectedItem.classType}
              level={selectedItem.level}
            />
            <div>
              <h3 className="text-lg font-bold text-white">{selectedItem.displayName}</h3>
              <span className="text-xs text-zinc-400">
                {t(TYPE_I18N[selectedItem.type as EquipType])}
              </span>
            </div>
          </div>

          {/* Characters using this equipment */}
          {selectedItem.users.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {t('tools.gear-usage-finder.no_users' as TranslationKey)}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {selectedItem.users.map(({ characterId, buildNames }: { characterId: string; buildNames: string[] }) => {
                const char = charById.get(characterId);
                if (!char) return null;
                const displayName = l(char, 'Fullname', lang);

                return (
                  <Link
                    key={characterId}
                    href={href(`/characters/${char.slug}`) as never}
                    className="card-interactive flex flex-col items-center gap-1.5 p-2"
                  >
                    <CharacterPortrait id={characterId} size="md" showIcons />
                    <div className="w-full text-center">
                      <FitText max={12} min={8}>{displayName}</FitText>
                    </div>
                    <div className="flex flex-wrap justify-center gap-0.5">
                      {buildNames.map(b => (
                        <span key={b} className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {b}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
