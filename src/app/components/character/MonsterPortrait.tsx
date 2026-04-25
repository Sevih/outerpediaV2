'use client'

import Image from 'next/image';
import { useState } from 'react';
import type { ElementType, ClassType } from '@/types/enums';

const SIZES = {
  xxs: { px: 20, cls: 'h-5 w-5',   iconSize: 0,  starSize: 0 },
  xs:  { px: 32, cls: 'h-8 w-8',   iconSize: 0,  starSize: 0 },
  sm:  { px: 48, cls: 'h-12 w-12', iconSize: 14, starSize: 10 },
  md:  { px: 64, cls: 'h-16 w-16', iconSize: 18, starSize: 12 },
  mld: { px: 80, cls: 'h-20 w-20', iconSize: 20, starSize: 13 },
  lg:  { px: 96, cls: 'h-24 w-24', iconSize: 22, starSize: 14 },
} as const;

export type MonsterPortraitSize = keyof typeof SIZES;

type Props = {
  faceIconId: string;
  name?: string;
  element?: string | ElementType | null;        // 'Fire' | 'CET_FIRE' — both accepted
  classType?: string | ClassType | null;        // 'Attacker' | 'CCT_ATTACKER' — both accepted
  type?: string | null;                         // CT_MONSTER / CT_NAMED_MONSTER / CT_BOSS_MONSTER / ... — drives slot bg color
  basicStar?: number;
  level?: number;
  isBoss?: boolean;
  size?: MonsterPortraitSize;
  showIcons?: boolean;
  showStars?: boolean;
  showLevel?: boolean;
  className?: string;
};

// Element / class come in either as the human-friendly label (`Fire`, `Attacker`)
// or the raw datamine enum (`CET_FIRE`, `CCT_ATTACKER`) depending on the caller.
// Normalize both to the icon-file token.
function normalizeElement(e?: string | null): string | null {
  if (!e) return null;
  if (e.startsWith('CET_')) return e.slice(4).toLowerCase().replace(/^./, c => c.toUpperCase()); // CET_FIRE → Fire
  return e;
}
function normalizeClass(c?: string | null): string | null {
  if (!c) return null;
  if (c.startsWith('CCT_')) {
    const map: Record<string, string> = {
      CCT_ATTACKER: 'Attacker', CCT_MAGE: 'Mage', CCT_RANGER: 'Ranger',
      CCT_DEFENDER: 'Defender', CCT_PRIEST: 'Priest', CCT_HEALER: 'Healer',
    };
    return map[c] ?? null;
  }
  return c;
}

// In-game slot rarity background driven by monster Type (not BasicStar — that
// only tracks the visual star count, while the slot color tracks the boss
// hierarchy):
//   CT_BOSS_MONSTER / CT_AREA_BOSS_MONSTER / CT_SEASON_BOSS_MONSTER → Rare (red)
//   CT_NAMED_MONSTER                                                → Magic (blue)
//   CT_MONSTER (and anything else)                                  → Normal (green)
function rarityBg(type?: string | null): string {
  if (!type) return '/images/ui/bg/MT_Slot_Normal.webp';
  if (type === 'CT_BOSS_MONSTER' || type === 'CT_AREA_BOSS_MONSTER' || type === 'CT_SEASON_BOSS_MONSTER') {
    return '/images/ui/bg/MT_Slot_Rare.webp';
  }
  if (type === 'CT_NAMED_MONSTER') return '/images/ui/bg/MT_Slot_Magic.webp';
  return '/images/ui/bg/MT_Slot_Normal.webp';
}

export default function MonsterPortrait({
  faceIconId,
  name,
  element,
  classType,
  type,
  basicStar,
  level,
  isBoss,
  size = 'md',
  showIcons = true,
  showStars = false,
  showLevel = false,
  className = '',
}: Props) {
  const s = SIZES[size];
  const [errored, setErrored] = useState(false);
  const elem = normalizeElement(typeof element === 'string' ? element : element ?? null);
  const cls = normalizeClass(typeof classType === 'string' ? classType : classType ?? null);
  const alt = name ?? faceIconId;
  const bg = rarityBg(type);

  return (
    <div className={`relative overflow-hidden rounded-lg ${s.cls} ${className}`}>
      <Image
        fill
        sizes={`${s.px}px`}
        src={bg}
        alt=""
        aria-hidden
        className="object-cover"
      />

      {!errored ? (
        <Image
          fill
          sizes={`${s.px}px`}
          src={`/images/characters/boss/portrait/MT_${faceIconId}.webp`}
          alt={alt}
          className="object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        // Fallback: only ~460 monsters have portraits while ~4360 exist; we swap
        // to a flat initial-tile so the selector stays usable for monsters that
        // ship without a face icon (most regular trash mobs).
        <div className="flex h-full w-full items-center justify-center text-[10px] font-mono uppercase text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {alt.slice(0, 3)}
        </div>
      )}

      {showIcons && s.iconSize > 0 && (
        <>
          {elem && (
            <div className="absolute top-0.5 right-0.5 z-10">
              <Image
                src={`/images/ui/elem/CM_Element_${elem}.webp`}
                alt={elem}
                width={s.iconSize}
                height={s.iconSize}
                className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
              />
            </div>
          )}
          {cls && (
            <div className="absolute top-0.5 left-0.5 z-10">
              <Image
                src={`/images/ui/class/CM_Class_${cls}.webp`}
                alt={cls}
                width={s.iconSize}
                height={s.iconSize}
                className="drop-shadow-md"
              />
            </div>
          )}
        </>
      )}

      {isBoss && (
        <div className="absolute top-0.5 left-1/2 z-10 -translate-x-1/2 rounded bg-red-900/80 px-1 text-[9px] font-bold leading-tight text-red-100 drop-shadow-md">
          BOSS
        </div>
      )}

      {showStars && s.starSize > 0 && basicStar && basicStar > 0 && (
        <div className="absolute bottom-0.5 left-0 right-0 z-10 flex items-center justify-center">
          {Array.from({ length: basicStar }, (_, i) => (
            <Image
              key={i}
              src="/images/ui/star/CM_icon_star_y.webp"
              alt="Star"
              width={s.starSize}
              height={s.starSize}
              className="-mx-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            />
          ))}
        </div>
      )}

      {showLevel && typeof level === 'number' && level > 0 && (
        <div className="absolute bottom-0.5 right-0.5 z-10 rounded bg-black/70 px-1 text-[9px] font-bold leading-tight text-amber-300">
          Lv{level}
        </div>
      )}
    </div>
  );
}
