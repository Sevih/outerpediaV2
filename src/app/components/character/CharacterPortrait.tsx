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
  '2000100': 'center 26%', // Demiurge Delta
};

const SIZES = {
  xxs: { px: 20, cls: 'h-5 w-5', smCls: 'max-md:h-5 max-md:w-5', mdCls: 'md:h-5 md:w-5', iconSize: 0, starSize: 0 },
  xs: { px: 32, cls: 'h-8 w-8', smCls: 'max-md:h-8 max-md:w-8', mdCls: 'md:h-8 md:w-8', iconSize: 0, starSize: 0 },
  sm: { px: 48, cls: 'h-12 w-12', smCls: 'max-md:h-12 max-md:w-12', mdCls: 'md:h-12 md:w-12', iconSize: 15, starSize: 11 },
  md: { px: 64, cls: 'h-16 w-16', smCls: 'max-md:h-16 max-md:w-16', mdCls: 'md:h-16 md:w-16', iconSize: 20, starSize: 14 },
  mld: { px: 88, cls: 'h-20 w-20', smCls: 'max-md:h-20 max-md:w-20', mdCls: 'md:h-20 md:w-20', iconSize: 20, starSize: 14 },
  lg: { px: 96, cls: 'h-24 w-24', smCls: 'max-md:h-24 max-md:w-24', mdCls: 'md:h-24 md:w-24', iconSize: 22, starSize: 17 },
} as const;

export type CharacterPortraitSize = keyof typeof SIZES;
type ResponsiveSize = { base: CharacterPortraitSize; md: CharacterPortraitSize };

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
  /** CSS object-position override (auto-resolved from CROP_OVERRIDES if omitted) */
  cropPosition?: string;
  showIcons?: boolean;
  showStars?: boolean;
  /** Override the star count displayed (ignores character rarity, implies showStars) */
  forceStar?: number;
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
  forceStar,
  className = '',
  priority = false,
}: Props) {
  const char = characters[id];
  const name = nameOverride ?? char?.Fullname ?? id;
  const element = elementOverride ?? char?.Element;
  const classType = classOverride ?? char?.Class;
  const rarity = rarityOverride ?? char?.Rarity;

  const isResponsive = typeof size === 'object';
  const baseSize = isResponsive ? size.base : size;
  const mdSize = isResponsive ? size.md : size;
  const s = SIZES[mdSize]; // use larger size for numeric values (icons, stars, image hints)
  const sBase = SIZES[baseSize];
  const cls = isResponsive
    ? `${sBase.smCls} ${SIZES[mdSize].mdCls}`
    : sBase.cls;
  const position = cropPosition ?? CROP_OVERRIDES[id] ?? DEFAULT_CROP;

  return (
    <div className={`relative overflow-hidden rounded-lg border border-gray-700 bg-gray-900 ${cls} ${className}`}>
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
      {(showStars || forceStar) && s.starSize > 0 && (forceStar ?? rarity) && (
        <div className="absolute bottom-0.5 left-0 right-0 z-10 flex items-center justify-center">
          {Array.from({ length: forceStar ?? rarity! }, (_, i) => (
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
    </div>
  );
}
