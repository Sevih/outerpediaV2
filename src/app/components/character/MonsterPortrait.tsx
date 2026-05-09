'use client'

import Image from 'next/image';
import { useState } from 'react';
import type { ElementType, ClassType } from '@/types/enums';
import { ElementIcon, ClassIcon, StarsRow, OVERLAY_MIN_PX } from './PortraitOverlays';

const SIZES = {
  xxs: { px: 20, cls: 'h-5 w-5'   },
  xs:  { px: 32, cls: 'h-8 w-8'   },
  sm:  { px: 48, cls: 'h-12 w-12' },
  md:  { px: 64, cls: 'h-16 w-16' },
  mld: { px: 80, cls: 'h-20 w-20' },
  lg:  { px: 96, cls: 'h-24 w-24' },
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
  // Map both raw datamine enums (CCT_*) and human-friendly labels onto the
  // class-icon token. 'Attacker' is the in-game monster label (preserved as
  // text everywhere else in the UI) but the icon file is CM_Class_Striker.webp
  // — same convention the project uses for characters. 'Priest' folds into
  // 'Healer' for the same reason.
  const map: Record<string, string> = {
    CCT_ATTACKER: 'Striker', Attacker: 'Striker',
    CCT_MAGE: 'Mage',
    CCT_RANGER: 'Ranger',
    CCT_DEFENDER: 'Defender',
    CCT_PRIEST: 'Healer', Priest: 'Healer',
    CCT_HEALER: 'Healer',
  };
  return map[c] ?? c;
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

  // IDs starting with '2' are character models reused as monsters — they have
  // a pre-cropped FaceIcon (FI_<id>.webp) generated from the Unity prefab
  // layout. Other ids fall back to the static MT_ boss portrait.
  const isCharacterModel = faceIconId.startsWith('2');
  const portraitSrc = isCharacterModel
    ? `/images/characters/faceicon/FI_${faceIconId}.webp`
    : `/images/characters/boss/portrait/MT_${faceIconId}.webp`;

  const showOverlays = s.px >= OVERLAY_MIN_PX;

  return (
    <div className={`relative ${s.cls} ${className}`}>
      <Image
        fill
        sizes={`${s.px}px`}
        src={bg}
        alt=""
        aria-hidden
        className="rounded-lg object-cover"
      />

      {!errored ? (
        <Image
          fill
          sizes={`${s.px}px`}
          src={portraitSrc}
          alt={alt}
          className="rounded-lg object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        // Fallback: only ~460 monsters have portraits while ~4360 exist; we swap
        // to a flat initial-tile so the selector stays usable for monsters that
        // ship without a face icon (most regular trash mobs).
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono uppercase text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {alt.slice(0, 3)}
        </div>
      )}

      {showIcons && showOverlays && elem && <ElementIcon element={elem} intrinsicPx={s.px} />}
      {showIcons && showOverlays && cls && <ClassIcon classType={cls} intrinsicPx={s.px} />}

      {isBoss && (
        <div className="absolute top-0.5 left-0 z-10 rounded bg-red-900/80 px-1 text-[9px] font-bold leading-tight text-red-100 drop-shadow-md">
          BOSS
        </div>
      )}

      {showStars && showOverlays && basicStar && basicStar > 0 && (
        <StarsRow count={basicStar} intrinsicPx={s.px} />
      )}

      {showLevel && typeof level === 'number' && level > 0 && (
        <div className="absolute bottom-3 right-0 z-10 rounded bg-black/70 px-1 text-[8px] font-bold leading-tight text-amber-300">
          Lv{level}
        </div>
      )}
    </div>
  );
}
