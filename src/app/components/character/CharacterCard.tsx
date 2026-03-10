import Image from 'next/image';
import Link from 'next/link';
import type { ElementType, ClassType, RarityType } from '@/types/enums';
import type { ReactNode } from 'react';
import FitText from '@/app/components/ui/FitText';

const SIZES = {
  sm: {
    container: 'h-[128px] w-[66px]',
    sizes: '66px',
    namePx: { max: 11, min: 8 },
    prefixPx: { max: 8, min: 6 },
    nameLeft: 'left-1.5',
    nameMaxW: '',
    nameOverlay: false,
    iconSize: 18,
    classIconSize: 18,
    elemBottom: 'bottom-2',
    classBottom: 'bottom-8',
    starSize: 8,
    starPos: 'top-0.25 right-0.25',
    starPt: 'pt-2.5',
    starGap: '-space-y-0.5',
    slotWidth: 10,
    slotHeight: 57,
    badgeClass: '',
  },
  md: {
    container: 'h-[192px] w-[100px]',
    sizes: '100px',
    namePx: { max: 11, min: 9 },
    prefixPx: { max: 9, min: 7 },
    nameLeft: 'left-1.5',
    nameMaxW: 'max-w-[calc(100%-0.75rem)]',
    nameOverlay: true,
    iconSize: 22,
    classIconSize: 24,
    elemBottom: 'bottom-3.5',
    classBottom: 'bottom-12',
    starSize: 11,
    starPos: 'top-1 right-0.75',
    starPt: 'pt-3',
    starGap: '-space-y-0.5',
    slotWidth: 13,
    slotHeight: 78,
    badgeClass: 'w-[60px] top-1.5 left-0.5',
  },
  lg: {
    container: 'h-[231px] w-[120px]',
    sizes: '120px',
    namePx: { max: 14, min: 12 },
    prefixPx: { max: 10, min: 7 },
    nameLeft: 'left-2',
    nameMaxW: 'max-w-[calc(100%-0.75rem)]',
    nameOverlay: true,
    iconSize: 26,
    classIconSize: 26,
    elemBottom: 'bottom-3.5',
    classBottom: 'bottom-12',
    starSize: 14,
    starPos: 'top-1 right-0.75',
    starPt: 'pt-3.5',
    starGap: '-space-y-0.75',
    slotWidth: 17,
    slotHeight: 94,
    badgeClass: 'w-[75px] top-2 left-0.5',
  },
} as const;

const RECRUIT_BADGES: { tag: string; src: string }[] = [
  { tag: 'collab', src: '/images/ui/recruit/CM_Recruit_Tag_Collab.webp' },
  { tag: 'seasonal', src: '/images/ui/recruit/CM_Recruit_Tag_Seasonal.webp' },
  { tag: 'premium', src: '/images/ui/recruit/CM_Recruit_Tag_Premium.webp' },
  { tag: 'free', src: '/images/ui/recruit/CM_Recruit_Tag_Free.webp' },
  { tag: 'limited', src: '/images/ui/recruit/CM_Recruit_Tag_Fes.webp' },
];

function getRecruitBadge(tags: string[]): { src: string; alt: string } | null {
  for (const { tag, src } of RECRUIT_BADGES) {
    if (tags.includes(tag)) return { src, alt: tag };
  }
  return null;
}

export type CharacterCardSize = keyof typeof SIZES;

export type Props = {
  id: string;
  name: string;
  /** Title prefix displayed above the base name (e.g. "Demiurge" for "Demiurge Stella") */
  prefix?: string | null;
  element?: ElementType;
  classType?: ClassType;
  rarity?: RarityType;
  tags?: string[];
  size?: CharacterCardSize;
  href?: string;
  showName?: boolean;
  showIcons?: boolean;
  showStars?: boolean;
  showBadge?: boolean;
  priority?: boolean;
  children?: ReactNode;
};

export default function CharacterCard({
  id,
  name,
  prefix,
  element,
  classType,
  rarity,
  tags,
  size = 'md',
  href,
  showName = true,
  showIcons = true,
  showStars = true,
  showBadge = true,
  priority = false,
  children,
}: Props) {
  const s = SIZES[size];
  const badge = showBadge && s.badgeClass && tags ? getRecruitBadge(tags) : null;

  const portraitBox = (
    <div className={`relative overflow-hidden rounded ${s.container}`}>
      <Image
        fill
        sizes={s.sizes}
        src={`/images/characters/portrait/CT_${id}.webp`}
        alt={name}
        className="object-cover"
        priority={priority}
      />

      {/* Recruit badge — top left */}
      {badge && (
        <Image
          src={badge.src}
          alt={badge.alt}
          width={0}
          height={0}
          sizes={s.sizes}
          className={`absolute z-10 h-auto ${s.badgeClass}`}
        />
      )}

      {/* Stars — top right with dark slot background */}
      {showStars && rarity && (
        <div className={`absolute ${s.starPos} z-10`} role="img" aria-label={`${rarity} star rarity`}>
          {/* Dark slot background */}
          <div className="relative" style={{ width: s.slotWidth, height: s.slotHeight }}>
            <Image
              src="/images/ui/star/CM_Character_Thumbnail_Star_Slot.webp"
              alt="Rarity slot"
              fill
              sizes={`${s.slotWidth}px`}
              className="object-contain"
            />
          </div>
          {/* Stars overlaid on the slot */}
          <div className={`absolute inset-0 flex flex-col items-center justify-start ${s.starGap} ${s.starPt}`}>
            {Array.from({ length: rarity }, (_, i) => (
              <Image
                key={i}
                src="/images/ui/star/CM_icon_star_y.webp"
                alt="Star"
                width={s.starSize}
                height={s.starSize}
                style={{ width: s.starSize, height: s.starSize }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-black/80 to-transparent z-5" />

      {/* Element icon — bottom right */}
      {showIcons && element && (
        <div className={`absolute ${s.elemBottom} right-1 z-10`} style={{ width: s.iconSize, height: s.iconSize }}>
          <Image
            src={`/images/ui/elem/CM_Element_${element}.webp`}
            alt={element}
            fill
            sizes={`${s.iconSize}px`}
            className="object-contain"
          />
        </div>
      )}

      {/* Class icon — above element */}
      {showIcons && classType && (
        <div className={`absolute ${s.classBottom} right-1 z-10`} style={{ width: s.classIconSize, height: s.classIconSize }}>
          <Image
            src={`/images/ui/class/CM_Class_${classType}.webp`}
            alt={classType}
            fill
            sizes={`${s.classIconSize}px`}
            className="object-contain"
          />
        </div>
      )}

      {/* Name overlay — bottom left (md/lg only) */}
      {showName && s.nameOverlay && (
        <div
          style={{ textShadow: '1px 0 1px #000, -1px 0 1px #000, 0 1px 1px #000, 0 -1px 1px #000' }}
          className={`absolute bottom-4 ${s.nameLeft} z-10 ${s.nameMaxW} font-bold leading-tight text-white`}
        >
          {prefix && (
            <FitText max={s.prefixPx.max} min={s.prefixPx.min} className="text-zinc-300">{prefix}</FitText>
          )}
          <FitText max={s.namePx.max} min={s.namePx.min}>
            {prefix ? name.replace(prefix, '').trim() : name}
          </FitText>
        </div>
      )}
    </div>
  );

  const wrapper = href ? (
    <Link href={href as never} className="block transition-opacity hover:opacity-80">
      {portraitBox}
    </Link>
  ) : (
    portraitBox
  );

  const hasExtra = children || (showName && !s.nameOverlay);

  if (hasExtra) {
    return (
      <div className="flex flex-col items-center gap-1">
        {wrapper}
        {showName && !s.nameOverlay && (
          <div className="text-center leading-tight text-zinc-200" style={{ maxWidth: s.sizes, fontFamily: 'var(--font-geist-sans)' }}>
            {prefix ? (
              <>
                <FitText max={s.prefixPx.max} min={s.prefixPx.min} className="text-zinc-400">{prefix}</FitText>
                <FitText max={s.namePx.max} min={s.namePx.min}>{name.replace(prefix, '').trim()}</FitText>
              </>
            ) : (
              <FitText max={s.namePx.max} min={s.namePx.min}>{name}</FitText>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }

  return wrapper;
}
