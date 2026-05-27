'use client';

import { use, useState, useMemo, useDeferredValue } from 'react';
import Image from 'next/image';
import type { Weapon, Amulet, Talisman, ArmorSet, ExclusiveEquipment, BossDisplayMap, SourceFilterOption } from '@/types/equipment';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import type { ClassType, ElementType, RarityType } from '@/types/enums';
import { CLASSES, ELEMENTS, RARITIES } from '@/types/enums';
import { l, lRec } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import Tabs from '@/app/components/ui/Tabs';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import { WeaponCard, AmuletCard, TalismanCard, SetCard, EECard } from '@/app/components/equipment';
import { FilterSearch, FilterPill } from '@/app/components/ui/FilterPills';
import { FilterBarGroup, FilterBarDivider } from '@/app/components/ui/FiltersTopBar';
import { ElementIconPill, ClassIconPill, StarPill } from '@/app/components/characters/filters/FilterAtoms';

type StatEntry = { label: string; icon: string };
const statsPromise = import('@data/stats.json').then(m => m.default as Record<string, StatEntry>);

const TAB_KEYS = ['weapons', 'accessories', 'sets', 'talismans', 'ee'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const LEVELS = [5, 6] as const;
type EquipLevel = (typeof LEVELS)[number];

const TALISMAN_TYPES = ['AP', 'CP'] as const;
type TalismanType = (typeof TALISMAN_TYPES)[number];

const TALISMAN_TYPE_TONE: Record<TalismanType, string> = {
  AP: 'text-amber-300',
  CP: 'text-cyan-300',
};

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
  item: { source?: string; boss?: string | string[] },
  keys: string[],
): boolean {
  return keys.some(key => {
    if (key.startsWith('source:')) return item.source === key.slice(7);
    const itemKey = Array.isArray(item.boss) ? item.boss.join(',') : item.boss;
    return itemKey === key;
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
  eeCharElements: Record<string, string>;
  eeCharRarities: Record<string, number>;
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
  eeCharElements, eeCharRarities,
  gearSourceFilters, setSourceFilters, mainStatsOptions, bossMap, buffMap, debuffMap, lang, messages,
}: Props) {
  const { t } = useI18n();
  const statsData = use(statsPromise);
  const [activeTab, setActiveTab] = useState<TabKey>('weapons');

  // ── Filter state ──
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);
  const [classFilter, setClassFilter] = useState<ClassType[]>([]);
  const [elementFilter, setElementFilter] = useState<ElementType[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [levelFilter, setLevelFilter] = useState<EquipLevel[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [mainStatFilter, setMainStatFilter] = useState<string[]>([]);
  const [talismanTypeFilter, setTalismanTypeFilter] = useState<TalismanType[]>([]);

  const resetAllFilters = () => {
    setRawQuery('');
    setClassFilter([]);
    setElementFilter([]);
    setRarityFilter([]);
    setLevelFilter([]);
    setSourceFilter([]);
    setMainStatFilter([]);
    setTalismanTypeFilter([]);
  };

  const handleTabChange = (v: string) => {
    setActiveTab(v as TabKey);
    resetAllFilters();
  };

  const hasActiveFilters =
    rawQuery.trim().length > 0
    || classFilter.length > 0
    || elementFilter.length > 0
    || rarityFilter.length > 0
    || levelFilter.length > 0
    || sourceFilter.length > 0
    || mainStatFilter.length > 0
    || talismanTypeFilter.length > 0;

  const tabLabels = TAB_KEYS.map((k) => messages[`equip.tab.${k}`]);

  // ── Filter UI data ──

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
    return talismans.filter(tlm => {
      if (q && !norm(l(tlm, 'name', lang)).includes(q)) return false;
      if (talismanTypeFilter.length && !talismanTypeFilter.includes(tlm.type as TalismanType)) return false;
      return true;
    });
  }, [talismans, q, talismanTypeFilter, lang]);

  const eeEntries = useMemo(() => Object.entries(ee), [ee]);

  const filteredEE = useMemo(() => {
    return eeEntries.filter(([charId, eeItem]) => {
      if (classFilter.length && !classFilter.includes(eeCharClasses[charId] as ClassType)) return false;
      if (elementFilter.length && !elementFilter.includes(eeCharElements[charId] as ElementType)) return false;
      if (rarityFilter.length && !rarityFilter.includes(eeCharRarities[charId] as RarityType)) return false;
      if (q) {
        const eeName = norm(l(eeItem, 'name', lang));
        const charName = norm(eeCharNames[charId] ?? '');
        if (!eeName.includes(q) && !charName.includes(q)) return false;
      }
      return true;
    });
  }, [eeEntries, q, classFilter, elementFilter, rarityFilter, eeCharClasses, eeCharElements, eeCharRarities, eeCharNames, lang]);

  const searchPlaceholder = activeTab === 'ee' ? t('equip.filter.searchEE') : t('equip.filter.search');

  // ── Source pill renderer ──

  // Split gear filters into boss row (no prefix) and other row (ie: / source:)
  const gearSourceHalves = useMemo(() => {
    const half = Math.ceil(gearSourceFilters.length / 2);
    return [gearSourceFilters.slice(0, half), gearSourceFilters.slice(half)];
  }, [gearSourceFilters]);

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
                    alt={lRec(bossMap[bk]?.name, lang) || bk}
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

      {/* Top filter bar (per tab) */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-xl border border-zinc-800 bg-slate-800/50 px-3 py-2.5 backdrop-blur-sm md:justify-start">
        <div className="w-full md:w-72">
          <FilterSearch value={rawQuery} onChange={setRawQuery} placeholder={searchPlaceholder} />
        </div>

        {(activeTab === 'weapons' || activeTab === 'accessories') && (
          <>
            <FilterBarDivider />
            <FilterBarGroup label={t('filters.classes')}>
              {CLASSES.map(cls => (
                <ClassIconPill
                  key={cls}
                  classType={cls}
                  active={classFilter.includes(cls)}
                  onClick={() => toggleArray(setClassFilter, cls, CLASSES)}
                />
              ))}
            </FilterBarGroup>
            <FilterBarDivider />
            <FilterBarGroup label={t('equip.filter.level')}>
              {LEVELS.map(lv => (
                <FilterPill
                  key={lv}
                  active={levelFilter.includes(lv)}
                  onClick={() => toggleArray(setLevelFilter, lv, LEVELS)}
                  className="h-9 px-3"
                >
                  <div className="flex items-center -space-x-1">
                    {Array.from({ length: lv }, (_, i) => (
                      <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="star" width={14} height={14} style={{ width: 14, height: 14 }} />
                    ))}
                  </div>
                </FilterPill>
              ))}
            </FilterBarGroup>
            <FilterBarDivider />
            <SourceColumn
              label={t('equip.filter.source')}
              rows={gearSourceHalves}
              renderPill={renderSourcePill}
            />
          </>
        )}

        {activeTab === 'sets' && (
          <>
            <FilterBarDivider />
            <SourceColumn
              label={t('equip.filter.source')}
              rows={[setSourceFilters]}
              renderPill={renderSourcePill}
            />
          </>
        )}

        {activeTab === 'talismans' && (
          <>
            <FilterBarDivider />
            <FilterBarGroup label="Type">
              {TALISMAN_TYPES.map(tp => (
                <FilterPill
                  key={tp}
                  active={talismanTypeFilter.includes(tp)}
                  onClick={() => toggleArray(setTalismanTypeFilter, tp, TALISMAN_TYPES)}
                  className="h-9 px-3"
                >
                  <span className={`font-mono text-xs font-semibold tracking-wider ${TALISMAN_TYPE_TONE[tp]}`}>{tp}</span>
                </FilterPill>
              ))}
            </FilterBarGroup>
          </>
        )}

        {activeTab === 'ee' && (
          <>
            <FilterBarDivider />
            <FilterBarGroup label={t('filters.classes')}>
              {CLASSES.map(cls => (
                <ClassIconPill
                  key={cls}
                  classType={cls}
                  active={classFilter.includes(cls)}
                  onClick={() => toggleArray(setClassFilter, cls, CLASSES)}
                />
              ))}
            </FilterBarGroup>
            <FilterBarDivider />
            <FilterBarGroup label={t('filters.elements')}>
              {ELEMENTS.map(el => (
                <ElementIconPill
                  key={el}
                  element={el}
                  active={elementFilter.includes(el)}
                  onClick={() => toggleArray(setElementFilter, el, ELEMENTS)}
                />
              ))}
            </FilterBarGroup>
            <FilterBarDivider />
            <FilterBarGroup label={t('filters.rarity')}>
              {RARITIES.map(r => (
                <StarPill
                  key={r}
                  stars={r}
                  active={rarityFilter.includes(r)}
                  onClick={() => toggleArray(setRarityFilter, r, RARITIES)}
                />
              ))}
            </FilterBarGroup>
          </>
        )}

        <button
          type="button"
          onClick={resetAllFilters}
          disabled={!hasActiveFilters}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 self-center rounded-lg border px-3 text-xs transition md:ml-auto ${
            hasActiveFilters
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-400/60 hover:bg-rose-500/20'
              : 'cursor-not-allowed border-zinc-800 bg-slate-900/80 text-zinc-500 opacity-60'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4h8M3 4v6a1 1 0 001 1h4a1 1 0 001-1V4M5 4V3a1 1 0 011-1h0a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {t('characters.filters.reset')}
        </button>
      </div>

      {/* Mainstat row for accessories */}
      {activeTab === 'accessories' && mainStatsOptions.length > 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-slate-800/50 p-4">
          <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            {t('equip.detail.mainstats')}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <FilterPill
              active={mainStatFilter.length === 0}
              onClick={() => setMainStatFilter([])}
              className="h-8 px-3"
            >
              {t('common.all')}
            </FilterPill>
            {mainStatsOptions.map(stat => {
              const info = statsData[stat];
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

/** Source column with optional multi-row layout, used inline inside the top bar. */
function SourceColumn({
  label, rows, renderPill,
}: {
  label: string;
  rows: SourceFilterOption[][];
  renderPill: (item: SourceFilterOption) => React.ReactNode;
}) {
  const visibleRows = rows.filter(r => r.length > 0);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
        {label}
      </span>
      <div className="flex flex-col items-center gap-1">
        {visibleRows.map((row, i) => (
          <div key={i} className="flex flex-wrap justify-center gap-1">
            {row.map(renderPill)}
          </div>
        ))}
      </div>
    </div>
  );
}
