'use client';

import { useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { lRec } from '@/lib/i18n/localize';
import { isRandomFloor } from '@/types/tower';
import type { TowerFloor } from '@/types/tower';
import type { Lang } from '@/lib/i18n/config';
import type { ElementType } from '@/types/enums';

type Props = {
  floors: TowerFloor[];
  selectedFloor: number | null;
  onSelect: (floor: number) => void;
  search: string;
  lang: Lang;
};

/** Get the primary boss info for display (first set for random floors) */
function getPrimaryBoss(floor: TowerFloor) {
  if (isRandomFloor(floor)) {
    return floor.sets[0]?.boss ?? null;
  }
  return floor.boss;
}

/** Check if a floor matches the search query */
function matchesSearch(floor: TowerFloor, query: string, lang: Lang): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  // Match floor number
  if (String(floor.floor).includes(q)) return true;

  // Match boss name(s)
  if (isRandomFloor(floor)) {
    return floor.sets.some(s => {
      const name = lRec(s.boss.name, lang);
      return name.toLowerCase().includes(q);
    });
  }

  const name = lRec(floor.boss.name, lang);
  return name.toLowerCase().includes(q);
}

export default function TowerFloorList({ floors, selectedFloor, onSelect, search, lang }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Filter floors based on search
  const filtered = useMemo(
    () => floors.filter(f => matchesSearch(f, search, lang)),
    [floors, search, lang],
  );

  // Scroll active floor into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedFloor]);

  return (
    <div ref={listRef} className="flex flex-col gap-0.5 overflow-y-auto">
      {filtered.map(floor => {
        const boss = getPrimaryBoss(floor);
        const isActive = floor.floor === selectedFloor;
        const isRandom = isRandomFloor(floor);
        const element = boss?.element as ElementType | undefined;
        const bossName = boss ? lRec(boss.name, lang) : '—';
        const isCharIcon = boss?.icons.startsWith('2');

        return (
          <button
            key={floor.floor}
            ref={isActive ? activeRef : undefined}
            type="button"
            onClick={() => onSelect(floor.floor)}
            className={[
              'flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
              isActive
                ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
                : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100',
            ].join(' ')}
          >
            {/* Floor number */}
            <span className="w-8 shrink-0 text-xs font-bold text-zinc-500">
              F{floor.floor}
            </span>

            {/* Boss mini portrait */}
            {boss && (
              <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded">
                <Image
                  src={isCharIcon
                    ? `/images/characters/portrait/CT_${boss.icons}.webp`
                    : `/images/characters/boss/portrait/MT_${boss.icons}.webp`
                  }
                  alt=""
                  fill
                  sizes="24px"
                  className="object-cover"
                />
              </span>
            )}

            {/* Boss name */}
            <span className="min-w-0 flex-1 truncate">{bossName}</span>

            {/* Element badge */}
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

            {/* Random badge */}
            {isRandom && (
              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-300">
                RNG
              </span>
            )}
          </button>
        );
      })}

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-zinc-500">
          No matching floors
        </p>
      )}
    </div>
  );
}
