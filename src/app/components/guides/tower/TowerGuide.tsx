'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FilterSearch } from '@/app/components/ui/FilterPills';
import TowerFloorList from './TowerFloorList';
import TowerFloorListGrouped from './TowerFloorListGrouped';
import TowerFloorDetail from './TowerFloorDetail';
import TowerPoolBossDetail from './TowerPoolBossDetail';
import { useI18n } from '@/lib/contexts/I18nContext';
import { isRandomFloor } from '@/types/tower';
import restrictionsIndex from '@data/tower/restrictions.json';
import type { TowerData, TowerRestrictionMap, TowerPoolEntry } from '@/types/tower';
import type { Boss } from '@/types/boss';
import type { Lang } from '@/lib/i18n/config';

const restrictionMap = restrictionsIndex as TowerRestrictionMap;

/* ── Module-level boss cache (shared across instances) ── */

const bossCache = new Map<string, Boss>();

async function loadBoss(id: string): Promise<Boss | null> {
  const cached = bossCache.get(id);
  if (cached) return cached;
  try {
    const mod = await import(`@data/boss/${id}.json`);
    const data = (mod.default ?? mod) as Boss;
    bossCache.set(id, data);
    return data;
  } catch {
    return null;
  }
}

/* ── Extract all unique boss IDs from tower data ── */

function collectBossIds(data: TowerData): string[] {
  const ids = new Set<string>();
  for (const floor of data.floors) {
    if (isRandomFloor(floor)) {
      for (const set of floor.sets) {
        ids.add(set.boss_id);
        if (set.minions) for (const m of set.minions) ids.add(m);
      }
    } else {
      ids.add(floor.boss_id);
      if (floor.minions) for (const m of floor.minions) ids.add(m);
    }
  }
  if (data.randomPool) {
    for (const entry of data.randomPool) {
      ids.add(entry.boss_id);
      if (entry.minions) for (const m of entry.minions) ids.add(m);
    }
  }
  return [...ids];
}

/* ── Component ── */

type Props = {
  data: TowerData;
};

export default function TowerGuide({ data }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;

  const isGrouped = !!data.disclaimer;

  const [search, setSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(
    data.floors[0]?.floor ?? null,
  );
  const [selectedSet, setSelectedSet] = useState(0);
  const [selectedPoolIndex, setSelectedPoolIndex] = useState<number | null>(null);
  const [selectedPoolSet, setSelectedPoolSet] = useState(0);
  const [bossMap, setBossMap] = useState<Record<string, Boss>>({});

  // Load all bosses on mount
  const allBossIds = useMemo(() => collectBossIds(data), [data]);

  const loadAllBosses = useCallback(async () => {
    const results = await Promise.all(allBossIds.map(async id => {
      const boss = await loadBoss(id);
      return boss ? [id, boss] as const : null;
    }));

    const map: Record<string, Boss> = {};
    for (const r of results) {
      if (r) map[r[0]] = r[1];
    }
    setBossMap(map);
  }, [allBossIds]);

  useEffect(() => {
    loadAllBosses();
  }, [loadAllBosses]);

  const activeFloor = useMemo(
    () => data.floors.find(f => f.floor === selectedFloor) ?? null,
    [data.floors, selectedFloor],
  );

  const activePoolEntry = useMemo(
    () => (selectedPoolIndex !== null && data.randomPool)
      ? data.randomPool[selectedPoolIndex] ?? null
      : null,
    [data.randomPool, selectedPoolIndex],
  );

  // In VH mode, convert any floor selection to a pool entry (no floor number, no tabs)
  const vhEntry = useMemo((): TowerPoolEntry | null => {
    if (!isGrouped || !activeFloor) return null;
    if (isRandomFloor(activeFloor)) {
      const set = activeFloor.sets[selectedSet] ?? activeFloor.sets[0];
      return {
        boss_id: set.boss_id,
        minions: set.minions,
        restrictionSets: [{ restrictions: set.restrictions ?? [], recommended: set.recommended }],
        reason: set.reason,
      };
    }
    return {
      boss_id: activeFloor.boss_id,
      minions: activeFloor.minions,
      restrictionSets: [{ restrictions: activeFloor.restrictions ?? [], recommended: activeFloor.recommended }],
      reason: activeFloor.reason,
    };
  }, [isGrouped, activeFloor, selectedSet]);

  /* ── URL hash sync ── */

  const didReadHash = useRef(false);

  const handleSelectFloor = useCallback((floor: number, set?: number) => {
    setSelectedFloor(floor);
    setSelectedSet(set ?? 0);
    setSelectedPoolIndex(null);
    const hash = set ? `#floor-${floor}-set-${set}` : `#floor-${floor}`;
    history.replaceState(null, '', hash);
  }, []);

  const handleSelectPool = useCallback((index: number, set?: number) => {
    setSelectedPoolIndex(index);
    setSelectedPoolSet(set ?? 0);
    setSelectedFloor(null);
    const hash = set ? `#pool-${index}-set-${set}` : `#pool-${index}`;
    history.replaceState(null, '', hash);
  }, []);

  const handleFloorSetChange = useCallback((set: number) => {
    setSelectedSet(set);
    if (selectedFloor !== null) {
      const hash = set ? `#floor-${selectedFloor}-set-${set}` : `#floor-${selectedFloor}`;
      history.replaceState(null, '', hash);
    }
  }, [selectedFloor]);

  const handlePoolSetChange = useCallback((set: number) => {
    setSelectedPoolSet(set);
    if (selectedPoolIndex !== null) {
      const hash = set ? `#pool-${selectedPoolIndex}-set-${set}` : `#pool-${selectedPoolIndex}`;
      history.replaceState(null, '', hash);
    }
  }, [selectedPoolIndex]);

  // Read hash on mount
  useEffect(() => {
    if (didReadHash.current) return;
    didReadHash.current = true;

    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;

    const poolMatch = hash.match(/^pool-(\d+)(?:-set-(\d+))?$/);
    if (poolMatch && data.randomPool) {
      const idx = Number(poolMatch[1]);
      const setNum = poolMatch[2] ? Number(poolMatch[2]) : 0;
      if (idx < data.randomPool.length) {
        handleSelectPool(idx, setNum);
        return;
      }
    }

    const floorMatch = hash.match(/^floor-(\d+)(?:-set-(\d+))?$/);
    if (floorMatch) {
      const floorNum = Number(floorMatch[1]);
      const setNum = floorMatch[2] ? Number(floorMatch[2]) : 0;
      if (data.floors.some(f => f.floor === floorNum)) {
        handleSelectFloor(floorNum, setNum);
      }
    }
  }, [data, handleSelectFloor, handleSelectPool]);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* Left column — search + floor list */}
      <div className="w-full shrink-0 md:sticky md:top-20 md:w-72">
        <FilterSearch
          value={search}
          onChange={setSearch}
          placeholder={t('tower.search_placeholder')}
          className="mb-3"
        />
        <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-1.5 md:max-h-[min(1200px,calc(100vh-8rem))]">
          {isGrouped ? (
            <TowerFloorListGrouped
              floors={data.floors}
              randomPool={data.randomPool ?? []}
              selectedFloor={selectedFloor}
              selectedSet={selectedSet}
              selectedPoolIndex={selectedPoolIndex}
              onSelectFloor={handleSelectFloor}
              onSelectPool={handleSelectPool}
              search={search}
              lang={lang}
              bossMap={bossMap}
            />
          ) : (
            <TowerFloorList
              floors={data.floors}
              selectedFloor={selectedFloor}
              onSelect={handleSelectFloor}
              search={search}
              lang={lang}
              bossMap={bossMap}
            />
          )}
        </div>
      </div>

      {/* Right column — detail */}
      <div className="min-w-0 flex-1">
        {vhEntry ? (
          <TowerPoolBossDetail
            key={`vh-${vhEntry.boss_id}`}
            entry={vhEntry}
            bossMap={bossMap}
            restrictionMap={restrictionMap}
          />
        ) : activeFloor ? (
          <TowerFloorDetail
            key={`${activeFloor.floor}-${selectedSet}`}
            floor={activeFloor}
            bossMap={bossMap}
            restrictionMap={restrictionMap}
            defaultSet={selectedSet}
            onSetChange={handleFloorSetChange}
          />
        ) : activePoolEntry ? (
          <TowerPoolBossDetail
            key={`pool-${selectedPoolIndex}-${selectedPoolSet}`}
            entry={activePoolEntry}
            bossMap={bossMap}
            restrictionMap={restrictionMap}
            defaultSet={selectedPoolSet}
            onSetChange={handlePoolSetChange}
          />
        ) : (
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
            {t('tower.select_floor')}
          </div>
        )}
      </div>
    </div>
  );
}
