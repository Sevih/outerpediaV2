import Image from 'next/image';
import charIndex from '@data/generated/characters-index.json';
import type { ElementType, ClassType, RarityType } from '@/types/enums';
import type { CharacterIndex } from '@/types/character';
import { ElementIcon, ClassIcon, StarsRow, OVERLAY_MIN_PX } from './PortraitOverlays';


const characters = charIndex as Record<string, CharacterIndex>;

// Frame sizes. `cls.base` is the unprefixed Tailwind class (always applies);
// `cls.md` and `cls.lg` are prefixed variants used only in the responsive form.
// Tailwind's cascade handles the override naturally — no need for `max-md:`.
//
// All variants are kept as static string literals so Tailwind's content scan
// picks them up.
const SIZES = {
  xxs: { px: 20, cls: { base: 'h-5 w-5',   md: 'md:h-5 md:w-5',   lg: 'lg:h-5 lg:w-5'   } },
  xs:  { px: 32, cls: { base: 'h-8 w-8',   md: 'md:h-8 md:w-8',   lg: 'lg:h-8 lg:w-8'   } },
  sm:  { px: 48, cls: { base: 'h-12 w-12', md: 'md:h-12 md:w-12', lg: 'lg:h-12 lg:w-12' } },
  md:  { px: 64, cls: { base: 'h-16 w-16', md: 'md:h-16 md:w-16', lg: 'lg:h-16 lg:w-16' } },
  mld: { px: 80, cls: { base: 'h-20 w-20', md: 'md:h-20 md:w-20', lg: 'lg:h-20 lg:w-20' } },
  lg:  { px: 96, cls: { base: 'h-24 w-24', md: 'md:h-24 md:w-24', lg: 'lg:h-24 lg:w-24' } },
} as const;

export type CharacterPortraitSize = keyof typeof SIZES;
type ResponsiveSize = {
  base: CharacterPortraitSize;
  md?: CharacterPortraitSize;
  lg?: CharacterPortraitSize;
};

type Props = {
  id: string;
  /** Alt text override (resolved from index if omitted) */
  name?: string;
  /** Element override (resolved from index if omitted) */
  element?: ElementType;
  /** Class override (resolved from index if omitted) */
  classType?: ClassType;
  /** Rarity override (resolved from index if omitted) */
  rarity?: RarityType;
  size?: CharacterPortraitSize | ResponsiveSize;
  showIcons?: boolean;
  showStars?: boolean;
  /** Override the star count displayed (ignores character rarity, implies showStars) */
  forceStar?: number;
  className?: string;
  priority?: boolean;
};

function resolveFrame(size: CharacterPortraitSize | ResponsiveSize): { cls: string; px: number } {
  if (typeof size === 'string') {
    return { cls: SIZES[size].cls.base, px: SIZES[size].px };
  }
  // Build cascading class string and pick the largest declared size for image hints.
  const parts: string[] = [SIZES[size.base].cls.base];
  if (size.md) parts.push(SIZES[size.md].cls.md);
  if (size.lg) parts.push(SIZES[size.lg].cls.lg);
  const largest = size.lg ?? size.md ?? size.base;
  return { cls: parts.join(' '), px: SIZES[largest].px };
}

export default function CharacterPortrait({
  id,
  name: nameOverride,
  element: elementOverride,
  classType: classOverride,
  rarity: rarityOverride,
  size = 'md',
  showIcons = false,
  showStars = false,
  forceStar,
  className = '',
  priority = false,
}: Props) {
  const char = characters[id];
  const name = nameOverride ?? char?.Fullname ?? id;
  const element = elementOverride ?? char?.Element;
  const classType = classOverride ?? char?.Class;
  const rarity = rarityOverride ?? char?.Rarity;

  const { cls: frameClass, px: framePx } = resolveFrame(size);
  const showOverlays = framePx >= OVERLAY_MIN_PX;
  const starCount = forceStar ?? rarity;

  return (
    <div className={`relative ${frameClass} ${className}`}>
      <Image
        fill
        sizes={`${framePx}px`}
        src={`/images/characters/faceicon/FI_${id}.webp`}
        alt={name}
        priority={priority}
        className="rounded-lg border border-gray-700 bg-gray-900 object-cover"
      />

      {showIcons && showOverlays && element && <ElementIcon element={element} intrinsicPx={Math.round(framePx * 0.39)} />}
      {showIcons && showOverlays && classType && <ClassIcon classType={classType} intrinsicPx={Math.round(framePx * 0.27)} />}
      {(showStars || forceStar) && showOverlays && starCount && <StarsRow count={starCount} intrinsicPx={Math.round(framePx * 0.17)} />}
    </div>
  );
}
