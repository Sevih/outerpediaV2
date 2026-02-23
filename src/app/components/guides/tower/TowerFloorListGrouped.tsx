'use client';

import { useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { lRec } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import { isRandomFloor } from '@/types/tower';
import type { TowerFloor, TowerFloorRandom, TowerFloorFixed, TowerPoolEntry } from '@/types/tower';
import type { Boss } from '@/types/boss';
import type { Lang } from '@/lib/i18n/config';
import type { ElementType } from '@/types/enums';

type Props = {
  floors: TowerFloor[];
  randomPool: TowerPoolEntry[];
  selectedFloor: number | null;
  selectedSet: number;
  selectedPoolIndex: number | null;
  onSelectFloor: (floor: number, set?: number) => void;
  onSelectPool: (index: number) => void;
  search: string;
  lang: Lang;
  bossMap: Record<string, Boss>;
};

/* ── Search helper ── */

function matchesBoss(bossId: string, query: string, lang: Lang, bossMap: Record<string, Boss>): boolean {
  const boss = bossMap[bossId];
  if (!boss) return false;
  return lRec(boss.Name, lang).toLowerCase().includes(query);
}

/* ── Shared item button ── */

function ItemButton({
  isActive,
  onClick,
  activeRef,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  activeRef?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <button
      ref={activeRef}
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors',
        isActive
          ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
          : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/* ── Boss portrait + name row ── */

function BossRow({ boss, lang }: { boss: Boss; lang: Lang }) {
  const element = boss.element as ElementType;

  return (
    <>
      {boss.icons.startsWith('2') ? (
        <CharacterPortrait id={boss.icons} size="xxs" />
      ) : (
        <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded">
          <Image
            src={boss.icons.startsWith('Skill_')
              ? `/images/characters/${boss.icons.split('_').pop()?.startsWith('2') ? '' : 'boss/'}skills/${boss.icons}.webp`
              : `/images/characters/boss/portrait/MT_${boss.icons}.webp`
            }
            alt=""
            fill
            sizes="20px"
            className="object-cover"
          />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{lRec(boss.Name, lang)}</span>
      {element && (
        <span className="relative h-4 w-4 shrink-0">
          <Image
            src={`/images/ui/elem/CM_Element_${element}.webp`}
            alt=""
            fill
            sizes="16px"
            className="object-contain"
          />
        </span>
      )}
    </>
  );
}

/* ── Section header ── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mt-3 mb-1 flex items-center gap-2 px-2 first:mt-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="h-px flex-1 bg-zinc-700/50" />
    </div>
  );
}

/* ── Main component ── */

export default function TowerFloorListGrouped({
  floors,
  randomPool,
  selectedFloor,
  selectedSet,
  selectedPoolIndex,
  onSelectFloor,
  onSelectPool,
  search,
  lang,
  bossMap,
}: Props) {
  const { t } = useI18n();
  const activeRef = useRef<HTMLButtonElement>(null);
  const q = search.toLowerCase();

  // Split floors into: floor 20 (last random) + fixed floors
  const { floor20, fixedFloors } = useMemo(() => {
    const maxFloor = Math.max(...floors.map(f => f.floor));
    let floor20: TowerFloorRandom | null = null;
    const fixedFloors: TowerFloorFixed[] = [];

    for (const f of floors) {
      if (f.floor === maxFloor && isRandomFloor(f)) {
        floor20 = f;
      } else if (!isRandomFloor(f)) {
        fixedFloors.push(f);
      }
    }

    return { floor20, fixedFloors };
  }, [floors]);

  // Filter Floor 20 sets by search
  const filteredFloor20Sets = useMemo(() => {
    if (!floor20) return [];
    if (!q) return floor20.sets.map((_s, i) => i);
    return floor20.sets
      .map((_s, i) => i)
      .filter(i => {
        const s = floor20.sets[i];
        return String(floor20.floor).includes(q) || matchesBoss(s.boss_id, q, lang, bossMap);
      });
  }, [floor20, q, lang, bossMap]);

  // Filter fixed floors by boss name
  const filteredFixed = useMemo(() => {
    if (!q) return fixedFloors;
    return fixedFloors.filter(f => matchesBoss(f.boss_id, q, lang, bossMap));
  }, [fixedFloors, q, lang, bossMap]);

  // Filter random pool by boss name
  const filteredPool = useMemo(() => {
    if (!q) return randomPool.map((_e, i) => i);
    return randomPool
      .map((_e, i) => i)
      .filter(i => matchesBoss(randomPool[i].boss_id, q, lang, bossMap));
  }, [randomPool, q, lang, bossMap]);

  const totalResults = filteredFloor20Sets.length + filteredFixed.length + filteredPool.length;

  // Scroll active into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedFloor, selectedSet, selectedPoolIndex]);

  return (
    <div className="flex flex-col gap-0.5">
      {/* ── Floor 20 — boss names ── */}
      {floor20 && filteredFloor20Sets.length > 0 && (
        <>
          <SectionHeader label={t('tower.floor_20')} />
          {filteredFloor20Sets.map(setIdx => {
            const set = floor20.sets[setIdx];
            const boss = bossMap[set.boss_id] ?? null;
            const isActive = selectedFloor === floor20.floor && selectedSet === setIdx;

            return (
              <ItemButton
                key={`f20-s${setIdx}`}
                isActive={isActive}
                onClick={() => onSelectFloor(floor20.floor, setIdx)}
                activeRef={isActive ? activeRef : undefined}
              >
                {boss ? <BossRow boss={boss} lang={lang} /> : <span className="text-zinc-500">...</span>}
              </ItemButton>
            );
          })}
        </>
      )}

      {/* ── Fixed floors (5/10/15) — boss names ── */}
      {filteredFixed.length > 0 && (
        <>
          <SectionHeader label={t('tower.fixed_floors')} />
          {filteredFixed.map(floor => {
            const boss = bossMap[floor.boss_id] ?? null;
            const isActive = selectedFloor === floor.floor;

            return (
              <ItemButton
                key={floor.floor}
                isActive={isActive}
                onClick={() => onSelectFloor(floor.floor)}
                activeRef={isActive ? activeRef : undefined}
              >
                {boss ? <BossRow boss={boss} lang={lang} /> : <span className="text-zinc-500">...</span>}
              </ItemButton>
            );
          })}
        </>
      )}

      {/* ── Random pool — boss names ── */}
      {filteredPool.length > 0 && (
        <>
          <SectionHeader label={t('tower.random_floors')} />
          {filteredPool.map(poolIdx => {
            const entry = randomPool[poolIdx];
            const boss = bossMap[entry.boss_id] ?? null;
            const isActive = selectedPoolIndex === poolIdx;

            return (
              <ItemButton
                key={`pool-${poolIdx}`}
                isActive={isActive}
                onClick={() => onSelectPool(poolIdx)}
                activeRef={isActive ? activeRef : undefined}
              >
                {boss ? <BossRow boss={boss} lang={lang} /> : <span className="text-zinc-500">...</span>}
              </ItemButton>
            );
          })}
        </>
      )}

      {totalResults === 0 && (
        <p className="py-4 text-center text-sm text-zinc-500">
          No matching floors
        </p>
      )}
    </div>
  );
}
