'use client';

import { useState, useMemo } from 'react';
import { FilterSearch } from '@/app/components/ui/FilterPills';
import TowerFloorList from './TowerFloorList';
import TowerFloorDetail from './TowerFloorDetail';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TowerData } from '@/types/tower';
import type { Lang } from '@/lib/i18n/config';

type Props = {
  data: TowerData;
};

export default function TowerGuide({ data }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;

  const [search, setSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(
    data.floors[0]?.floor ?? null,
  );

  const activeFloor = useMemo(
    () => data.floors.find(f => f.floor === selectedFloor) ?? null,
    [data.floors, selectedFloor],
  );

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
        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-1.5 md:max-h-[calc(100vh-10rem)]">
          <TowerFloorList
            floors={data.floors}
            selectedFloor={selectedFloor}
            onSelect={setSelectedFloor}
            search={search}
            lang={lang}
          />
        </div>
      </div>

      {/* Right column — floor detail */}
      <div className="min-w-0 flex-1">
        {activeFloor ? (
          <TowerFloorDetail floor={activeFloor} />
        ) : (
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
            {t('tower.select_floor')}
          </div>
        )}
      </div>
    </div>
  );
}
