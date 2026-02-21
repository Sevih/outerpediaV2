'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import Image from 'next/image';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, BossDisplayMap, SourceFilterOption } from '@/types/equipment';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import type { ClassType } from '@/types/enums';
import { CLASSES } from '@/types/enums';
import { l, lRec } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import Tabs from '@/app/components/ui/Tabs';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import { WeaponCard, AmuletCard, TalismanCard, SetCard, EECard } from '@/app/components/equipment';
import { FilterSearch, FilterPill, IconFilterGroup } from '@/app/components/ui/FilterPills';
import statsData from '@data/stats.json';

const TAB_KEYS = ['weapons', 'accessories', 'sets', 'talismans', 'ee'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const LEVELS = [5, 6] as const;
type EquipLevel = (typeof LEVELS)[number];

// ── Helpers ──

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim();
}

function toggleArray<T>(
  setter: React.Dispatch<React.SetStateAction<T[]>>, value: T, allValues?: readonly T[],
) {
  setter(prev => {
    const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
    return allValues && next.length === allValues.length ? [] : next;
  });
}

function matchesSource(
  item: { source?: string; boss?: string; name: string },
  keys: string[],
): boolean {
  return keys.some(key => {
    if (key.startsWith('source:')) return item.source === key.slice(7);
    if (key.startsWith('ie:')) {
      return item.source === 'Irregular Extermination' && item.name.includes(key.slice(3));
    }
    return item.boss === key;
  });
}

// ── Props ──

type Props = {
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
  ee: Record<string, ExclusiveEquipment>;
  eeCharNames: Record<string, string>;
  eeCharClasses: Record<string, string>;
  gearSourceFilters: SourceFilterOption[];
  setSourceFilters: SourceFilterOption[];
  mainStatsOptions: string[];
  bossMap: BossDisplayMap;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
  lang: Lang;
  messages: Messages;
};

export default function EquipmentsPageClient({
  weapons, amulets, talismans, sets, ee, eeCharNames, eeCharClasses,
  gearSourceFilters, setSourceFilters, mainStatsOptions, bossMap, buffMap, debuffMap, lang, messages,
}: Props) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('weapons');

  // ── Filter state ──
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);
  const [classFilter, setClassFilter] = useState<ClassType[]>([]);
  const [levelFilter, setLevelFilter] = useState<EquipLevel[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [mainStatFilter, setMainStatFilter] = useState<string[]>([]);

  const handleTabChange = (v: string) => {
    setActiveTab(v as TabKey);
    setRawQuery('');
    setClassFilter([]);
    setLevelFilter([]);
    setSourceFilter([]);
    setMainStatFilter([]);
  };

  const tabLabels = TAB_KEYS.map((k) => messages[`equip.tab.${k}`]);

  // ── Filter UI data ──

  const CLASSES_UI = useMemo(() => [
    { name: t('common.all'), value: null as ClassType | null },
    ...CLASSES.map(v => ({ name: v, value: v })),
  ], [t]);

  const isGearTab = activeTab === 'weapons' || activeTab === 'accessories';
  const activeFilters = activeTab === 'sets' ? setSourceFilters : gearSourceFilters;
  const activeSourceKeys = useMemo(() => activeFilters.map(f => f.key), [activeFilters]);

  // ── Filtered data ──

  const q = norm(query);

  const filteredWeapons = useMemo(() => {
    return weapons.filter(w => {
      if (q && !norm(l(w, 'name', lang)).includes(q)) return false;
      if (classFilter.length && !classFilter.includes(w.class as ClassType)) return false;
      if (levelFilter.length && !levelFilter.includes(w.level as EquipLevel)) return false;
      if (sourceFilter.length && !matchesSource(w, sourceFilter)) return false;
      return true;
    });
  }, [weapons, q, classFilter, levelFilter, sourceFilter, lang]);

  const filteredAmulets = useMemo(() => {
    return amulets.filter(a => {
      if (q && !norm(l(a, 'name', lang)).includes(q)) return false;
      if (classFilter.length && !classFilter.includes(a.class as ClassType)) return false;
      if (levelFilter.length && !levelFilter.includes(a.level as EquipLevel)) return false;
      if (sourceFilter.length && !matchesSource(a, sourceFilter)) return false;
      if (mainStatFilter.length && !(a.mainStats ?? []).some(s => mainStatFilter.includes(s))) return false;
      return true;
    });
  }, [amulets, q, classFilter, levelFilter, sourceFilter, mainStatFilter, lang]);

  const filteredSets = useMemo(() => {
    return sets.filter(s => {
      if (q && !norm(l(s, 'name', lang)).includes(q)) return false;
      if (sourceFilter.length && !matchesSource(s, sourceFilter)) return false;
      return true;
    });
  }, [sets, q, sourceFilter, lang]);

  const filteredTalismans = useMemo(() => {
    if (!q) return talismans;
    return talismans.filter(t => norm(l(t, 'name', lang)).includes(q));
  }, [talismans, q, lang]);

  const eeEntries = useMemo(() => Object.entries(ee), [ee]);

  const filteredEE = useMemo(() => {
    return eeEntries.filter(([charId, eeItem]) => {
      if (classFilter.length && !classFilter.includes(eeCharClasses[charId] as ClassType)) return false;
      if (q) {
        const eeName = norm(l(eeItem, 'name', lang));
        const charName = norm(eeCharNames[charId] ?? '');
        if (!eeName.includes(q) && !charName.includes(q)) return false;
      }
      return true;
    });
  }, [eeEntries, q, classFilter, eeCharClasses, eeCharNames, lang]);

  // ── Visibility flags ──

  const showClassFilter = activeTab === 'weapons' || activeTab === 'accessories' || activeTab === 'ee';
  const showLevelFilter = activeTab === 'weapons' || activeTab === 'accessories';
  const showSourceFilter = activeTab === 'weapons' || activeTab === 'accessories' || activeTab === 'sets';
  const showMainStatFilter = activeTab === 'accessories';
  const searchPlaceholder = activeTab === 'ee' ? t('equip.filter.searchEE') : t('equip.filter.search');

  // ── Source pill renderer ──

  // Split gear filters into boss row (no prefix) and other row (ie: / source:)
  const gearBossFilters = gearSourceFilters.filter(f => !f.key.includes(':'));
  const gearOtherFilters = gearSourceFilters.filter(f => f.key.includes(':'));

  function renderSourcePill(item: SourceFilterOption) {
    const label = item.i18nKey
      ? t(item.i18nKey as Parameters<typeof t>[0])
      : item.bossKeys.map(bk => lRec(bossMap[bk]?.name, lang) || bk).join(' / ');

    return (
      <FilterPill
        key={item.key}
        active={sourceFilter.includes(item.key)}
        onClick={() => toggleArray(setSourceFilter, item.key, activeSourceKeys)}
        title={label}
        className="h-10 px-2 gap-1.5"
      >
        {item.bossKeys.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {item.bossKeys.map(bk => {
              const boss = bossMap[bk];
              if (!boss) return null;
              return (
                <div key={bk} className="relative h-8 w-8 shrink-0">
                  <Image
                    src={`/images/characters/boss/atb/IG_Turn_${boss.icons}.webp`}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-contain"
                  />
                </div>
              );
            })}
          </div>
        )}
        <span className="text-xs">{label}</span>
      </FilterPill>
    );
  }

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
    <div className="flex flex-col gap-6">
      <Tabs
        items={[...TAB_KEYS]}
        labels={tabLabels}
        value={activeTab}
        onChange={handleTabChange}
        hashPrefix="tab"
        className="justify-center"
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 items-center">
        <FilterSearch value={rawQuery} onChange={setRawQuery} placeholder={searchPlaceholder} />

        {showClassFilter && showLevelFilter && (
          <div className="mx-auto max-w-205 grid grid-cols-1 md:grid-cols-2 gap-y-2 md:gap-x-6 place-items-center w-full">
            <IconFilterGroup
              label={t('filters.classes')}
              items={CLASSES_UI}
              filter={classFilter}
              onToggle={v => toggleArray(setClassFilter, v, CLASSES)}
              onReset={() => setClassFilter([])}
              imagePath={v => `/images/ui/class/CM_Class_${v}.webp`}
            />
            <div className="w-full flex flex-col items-center">
              <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{t('equip.filter.level')}</p>
              <div className="flex gap-2 justify-center">
                <FilterPill active={levelFilter.length === 0} onClick={() => setLevelFilter([])} className="h-8 px-3">
                  {t('common.all')}
                </FilterPill>
                {LEVELS.map(lv => (
                  <FilterPill
                    key={lv}
                    active={levelFilter.includes(lv)}
                    onClick={() => toggleArray(setLevelFilter, lv, LEVELS)}
                    className="h-8 px-3"
                  >
                    <div className="flex items-center -space-x-1">
                      {Array.from({ length: lv }, (_, i) => (
                        <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="star" width={14} height={14} style={{ width: 14, height: 14 }} />
                      ))}
                    </div>
                  </FilterPill>
                ))}
              </div>
            </div>
          </div>
        )}

        {showClassFilter && !showLevelFilter && (
          <IconFilterGroup
            label={t('filters.classes')}
            items={CLASSES_UI}
            filter={classFilter}
            onToggle={v => toggleArray(setClassFilter, v, CLASSES)}
            onReset={() => setClassFilter([])}
            imagePath={v => `/images/ui/class/CM_Class_${v}.webp`}
          />
        )}

        {showSourceFilter && (
          <div className="w-full flex flex-col items-center">
            <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{t('equip.filter.source')}</p>
            {isGearTab ? (
              <div className="flex flex-col gap-2 items-center">
                <div className="flex flex-wrap gap-2 justify-center">
                  <FilterPill
                    active={sourceFilter.length === 0}
                    onClick={() => setSourceFilter([])}
                    className="h-10 px-3"
                  >
                    {t('common.all')}
                  </FilterPill>
                  {gearBossFilters.map(renderSourcePill)}
                </div>
                {gearOtherFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {gearOtherFilters.map(renderSourcePill)}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                <FilterPill
                  active={sourceFilter.length === 0}
                  onClick={() => setSourceFilter([])}
                  className="h-10 px-3"
                >
                  {t('common.all')}
                </FilterPill>
                {setSourceFilters.map(renderSourcePill)}
              </div>
            )}
          </div>
        )}

        {showMainStatFilter && mainStatsOptions.length > 0 && (
          <div className="w-full flex flex-col items-center">
            <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{t('equip.detail.mainstats')}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <FilterPill
                active={mainStatFilter.length === 0}
                onClick={() => setMainStatFilter([])}
                className="h-8 px-3"
              >
                {t('common.all')}
              </FilterPill>
              {mainStatsOptions.map(stat => {
                const info = (statsData as Record<string, { label: string; icon: string }>)[stat];
                return (
                  <FilterPill
                    key={stat}
                    active={mainStatFilter.includes(stat)}
                    onClick={() => toggleArray(setMainStatFilter, stat, mainStatsOptions)}
                    title={info?.label ?? stat}
                    className="h-8 px-2"
                  >
                    {info ? (
                      <Image
                        src={`/images/ui/effect/${info.icon}`}
                        alt={info.label}
                        width={20}
                        height={20}
                        style={{ width: 20, height: 20 }}
                      />
                    ) : (
                      <span className="text-xs">{stat}</span>
                    )}
                  </FilterPill>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Weapons */}
      {activeTab === 'weapons' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {filteredWeapons.map((w, i) => (
            <WeaponCard key={i} weapon={w} lang={lang} bossMap={bossMap} />
          ))}
        </div>
      )}

      {/* Accessories */}
      {activeTab === 'accessories' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {filteredAmulets.map((a, i) => (
            <AmuletCard key={i} amulet={a} lang={lang} bossMap={bossMap} />
          ))}
        </div>
      )}

      {/* Armor Sets */}
      {activeTab === 'sets' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {filteredSets.map((s, i) => (
            <SetCard key={i} set={s} lang={lang} bossMap={bossMap} />
          ))}
        </div>
      )}

      {/* Talismans */}
      {activeTab === 'talismans' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {filteredTalismans.map((t, i) => (
            <TalismanCard key={i} talisman={t} lang={lang} />
          ))}
        </div>
      )}

      {/* Exclusive Equipment */}
      {activeTab === 'ee' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {filteredEE.map(([charId, eeItem]) => (
            <EECard
              key={charId}
              ee={eeItem}
              charId={charId}
              charName={eeCharNames[charId] ?? charId}
              lang={lang}
            />
          ))}
        </div>
      )}

    </div>
    </EffectsProvider>
  );
}
