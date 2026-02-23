import Image from 'next/image';
import charIndex from '@data/generated/characters-index.json';
import type { ElementType, ClassType, RarityType } from '@/types/enums';
import type { CharacterIndex } from '@/types/character';


const characters = charIndex as Record<string, CharacterIndex>;

// Extra zoom to crop tightly on the face (parent overflow-hidden clips the excess)
const FACE_ZOOM = 1.5;

// Default: face at ~18% from top
const DEFAULT_CROP = 'center 18%';

// Characters with lower face positions
const CROP_OVERRIDES: Record<string, string> = {
  '2000072': 'center 22%', // Edelweiss
  '2000075': 'center 22%', // Demiurge Vlada
  '2000086': 'center 22%', // Kitsune Tamamo-no-Mae
  '2000073': 'center 26%', // Vlada
  '2000079': 'center 26%', // Kuro
  '2000080': 'center 26%', // Tamamo-no-Mae
  '2000081': 'center 26%', // Maxie
  '2000084': 'center 26%', // Monad Eva
};

const SIZES = {
  xxs: { px: 20, cls: 'h-5 w-5', iconSize: 0, starSize: 0 },
  xs: { px: 32, cls: 'h-8 w-8', iconSize: 0, starSize: 0 },
  sm: { px: 48, cls: 'h-12 w-12', iconSize: 15, starSize: 8 },
  md: { px: 64, cls: 'h-16 w-16', iconSize: 20, starSize: 10 },
  lg: { px: 96, cls: 'h-24 w-24', iconSize: 22, starSize: 13 },
} as const;

export type CharacterPortraitSize = keyof typeof SIZES;

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
  size?: CharacterPortraitSize;
  /** CSS object-position override (auto-resolved from CROP_OVERRIDES if omitted) */
  cropPosition?: string;
  showIcons?: boolean;
  showStars?: boolean;
  className?: string;
  priority?: boolean;
};

export default function CharacterPortrait({
  id,
  name: nameOverride,
  element: elementOverride,
  classType: classOverride,
  rarity: rarityOverride,
  size = 'md',
  cropPosition,
  showIcons = false,
  showStars = false,
  className = '',
  priority = false,
}: Props) {
  const char = characters[id];
  const name = nameOverride ?? char?.Fullname ?? id;
  const element = elementOverride ?? char?.Element;
  const classType = classOverride ?? char?.Class;
  const rarity = rarityOverride ?? char?.Rarity;

  const s = SIZES[size];
  const position = cropPosition ?? CROP_OVERRIDES[id] ?? DEFAULT_CROP;

  return (
    <div className={`relative overflow-hidden rounded-lg border border-gray-700 bg-gray-900 ${s.cls} ${className}`}>
      <Image
        fill
        sizes={`${Math.round(s.px * FACE_ZOOM)}px`}
        src={`/images/characters/portrait/CT_${id}.webp`}
        alt={name}
        className="object-cover"
        style={{ objectPosition: position, transform: `scale(${FACE_ZOOM})` }}
        priority={priority}
      />

      {/* Element icon — top right, Class icon — bottom right */}
      {showIcons && s.iconSize > 0 && (
        <>
          {element && (
            <div className="absolute top-0.5 right-0.5 z-10">
              <Image
                src={`/images/ui/elem/CM_Element_${element}.webp`}
                alt={element}
                width={s.iconSize}
                height={s.iconSize}
                className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
              />
            </div>
          )}
          {classType && (
            <div className="absolute top-1/2 right-0.5 z-10 -translate-y-1/2">
              <Image
                src={`/images/ui/class/CM_Class_${classType}.webp`}
                alt={classType}
                width={s.iconSize}
                height={s.iconSize}
                className="drop-shadow-md"
              />
            </div>
          )}
        </>
      )}

      {/* Rarity stars — bottom center */}
      {showStars && s.starSize > 0 && rarity && (
        <div className="absolute bottom-0.5 left-1/2 z-10 flex -translate-x-1/2 items-center">
          {Array.from({ length: rarity }, (_, i) => (
            <Image
              key={i}
              src="/images/ui/star/CM_icon_star_y.webp"
              alt=""
              width={s.starSize}
              height={s.starSize}
              className="-mx-0.5"
            />
          ))}
        </div>
      )}
    </div>
  );
}
