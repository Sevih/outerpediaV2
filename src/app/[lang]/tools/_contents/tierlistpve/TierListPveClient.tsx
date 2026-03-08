'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { CharacterListEntry } from '@/types/character';
import type { RarityType, RoleType } from '@/types/enums';
import { ELEMENTS, CLASSES, RARITIES, ROLES } from '@/types/enums';
import type { TranslationKey } from '@/i18n/locales/en';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import ResponsiveCharacterCard from '@/app/components/character/ResponsiveCharacterCard';
import { FilterPill, IconFilterGroup, TextFilterGroup } from '@/app/components/ui/FilterPills';

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
type Tier = typeof TIERS[number];

const TRANSCEND_LEVELS = [3, 4, 5, 6] as const;

const TIER_COLORS: Record<Tier, string> = {
  S: 'from-amber-500/30 to-amber-900/10 border-amber-500/50',
  A: 'from-orange-600/30 to-orange-900/10 border-orange-500/50',
  B: 'from-blue-500/30 to-blue-900/10 border-blue-500/50',
  C: 'from-green-500/30 to-green-900/10 border-green-500/50',
  D: 'from-zinc-500/30 to-zinc-900/10 border-zinc-500/50',
};

const TIER_LABEL_BG: Record<Tier, string> = {
  S: 'bg-amber-500/20',
  A: 'bg-orange-600/20',
  B: 'bg-blue-500/20',
  C: 'bg-green-500/20',
  D: 'bg-zinc-500/20',
};

type Props = {
  characters: CharacterListEntry[];
};

export default function TierListPveClient({ characters }: Props) {
  const { lang, t, href } = useI18n();

  // Filter state
  const [elementFilter, setElementFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleType[]>([]);
  const [transcendLevel, setTranscendLevel] = useState<number>(6);

  const toggleArray = <T,>(
    setter: React.Dispatch<React.SetStateAction<T[]>>, value: T, allValues?: readonly T[],
  ) => {
    setter(prev => {
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
      return allValues && next.length === allValues.length ? [] : next;
    });
  };

  // UI arrays
  const ELEMENTS_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...ELEMENTS.map(v => ({ name: v, value: v })),
  ], [t]);

  const CLASSES_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...CLASSES.map(v => ({ name: v, value: v })),
  ], [t]);

  const ROLES_UI = useMemo(() => [
    { name: t('common.all'), value: null as RoleType | null },
    ...ROLES.map(v => ({ name: t(`filters.roles.${v}`), value: v })),
  ], [t]);

  // Resolve rank & role for current transcend level
  const resolvedCharacters = useMemo(() =>
    characters.map(char => {
      const lvlKey = String(transcendLevel);
      const rank = char.rank_by_transcend?.[lvlKey] ?? char.rank;
      const role = char.role_by_transcend?.[lvlKey] as RoleType ?? char.role;
      const displayName = l(char, 'Fullname', lang);
      const nameParts = splitCharacterName(char.ID, displayName, lang);
      return { ...char, rank, role, displayName, prefix: nameParts.prefix };
    }), [characters, transcendLevel, lang]);

  // Filter
  const filtered = useMemo(() => {
    const elemSet = new Set(elementFilter);
    const classSet = new Set(classFilter);
    const raritySet = new Set(rarityFilter);
    const roleSet = new Set(roleFilter);

    return resolvedCharacters.filter(char => {
      if (elemSet.size && !elemSet.has(char.Element)) return false;
      if (classSet.size && !classSet.has(char.Class)) return false;
      if (raritySet.size && !raritySet.has(char.Rarity)) return false;
      if (roleSet.size && !roleSet.has(char.role)) return false;
      return true;
    });
  }, [resolvedCharacters, elementFilter, classFilter, rarityFilter, roleFilter]);

  // Group by tier
  const grouped = useMemo(() => {
    const map = new Map<Tier, typeof filtered>();
    for (const tier of TIERS) map.set(tier, []);
    for (const char of filtered) {
      const tier = char.rank as Tier;
      if (map.has(tier)) map.get(tier)!.push(char);
    }
    // Sort within each tier alphabetically
    for (const chars of map.values()) {
      chars.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return map;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-350 space-y-3">
      {/* Transcend level selector */}
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300">
        {t('tierlist.transcend_level')}
      </p>
      <div className="flex justify-center gap-2">
        {TRANSCEND_LEVELS.map(lvl => (
          <FilterPill
            key={lvl}
            active={transcendLevel === lvl}
            onClick={() => setTranscendLevel(lvl)}
            className="h-8 px-3"
          >
            <div className="flex items-center -space-x-1">
              {Array.from({ length: lvl }, (_, i) => (
                <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="" width={16} height={16} style={{ width: 16, height: 16 }} />
              ))}
            </div>
          </FilterPill>
        ))}
      </div>

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

      {/* Roles */}
      <TextFilterGroup
        label={t('characters.filters.roles' as TranslationKey)}
        items={ROLES_UI}
        filter={roleFilter}
        onToggle={v => toggleArray(setRoleFilter, v, ROLES)}
        onReset={() => setRoleFilter([])}
      />

      {/* Tier groups */}
      <div className="mt-6 space-y-4">
        {TIERS.map(tier => {
          const chars = grouped.get(tier);
          if (!chars || chars.length === 0) return null;
          return (
            <div
              key={tier}
              className={`rounded-xl border bg-gradient-to-r ${TIER_COLORS[tier]} overflow-hidden`}
            >
              <div className="flex items-center gap-3">
                {/* Rank image */}
                <div className={`flex min-h-20 w-16 shrink-0 items-center justify-center ${TIER_LABEL_BG[tier]} md:w-20`}>
                  <div className="relative h-12 w-12 md:h-14 md:w-14">
                    <Image
                      src={`/images/ui/rank/IG_Event_Rank_${tier}.webp`}
                      alt={`Tier ${tier}`}
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </div>
                </div>

                {/* Characters grid */}
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
