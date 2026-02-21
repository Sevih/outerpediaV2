import Image from 'next/image';
import { getRarityBgPath } from '@/lib/format-text';
import type { ItemRarity } from '@/lib/theme';

type Props = {
  /** Image path relative to /images/ (e.g., 'equipment/TI_Equipment_Weapon_06') */
  src: string;
  rarity: ItemRarity;
  alt: string;
  /** Size in pixels (default 50) */
  size?: number;
  className?: string;
  /** Effect icon name (e.g., 'TI_Icon_UO_Weapon_11') — shown top-right */
  effectIcon?: string | null;
  /** Class name (e.g., 'Striker') — shown middle-right */
  classType?: string | null;
  /** Size of the effect/class overlay icons in pixels (default 16) */
  overlaySize?: number;
  /** Equipment level — displayed as overlapping star icons at the bottom of the image */
  level?: number | string | null;
};

export default function EquipmentIcon({
  src, rarity, alt, size = 50, className = '',
  effectIcon, classType, overlaySize = 16, level,
}: Props) {
  const starCount = level ? Number(level) : 0;
  const starSize = Math.round(size / 5);
  // Each star overlaps the previous by ~30% of its width
  const starOverlap = Math.round(starSize * 0.3);
  const starsWidth = starCount > 0 ? starSize + (starCount - 1) * (starSize - starOverlap) : 0;

  return (
    <div
      className={`relative shrink-0 overflow-visible rounded ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="relative h-full w-full overflow-hidden rounded">
        <Image
          src={getRarityBgPath(rarity)}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
        <Image
          src={`/images/${src}.webp`}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="relative object-contain p-0.5"
        />
      </div>

      {/* Effect icon — top-right */}
      {effectIcon && (
        <div
          className="absolute right-0.5 top-0.5"
          style={{ width: overlaySize, height: overlaySize }}
        >
          <div className="relative h-full w-full">
            <Image
              src={`/images/ui/effect/${effectIcon}.webp`}
              alt=""
              fill
              sizes={`${overlaySize}px`}
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Class icon — bottom-right */}
      {classType && (
        <div
          className="absolute right-0.5"
          style={{ width: overlaySize, height: overlaySize, bottom: size > 50 ? 20 : 8 }}
        >
          <div className="relative h-full w-full">
            <Image
              src={`/images/ui/class/CM_Class_${classType}.webp`}
              alt={classType}
              fill
              sizes={`${overlaySize}px`}
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Stars — overlapping, centered at the bottom of the image */}
      {starCount > 0 && (
        <div
          className="absolute bottom-1 left-1/2 flex"
          style={{
            width: starsWidth,
            marginLeft: -starsWidth / 2,
          }}
        >
          {Array.from({ length: starCount }, (_, i) => (
            <div
              key={i}
              className="relative shrink-0"
              style={{
                width: starSize,
                height: starSize,
                marginLeft: i === 0 ? 0 : -starOverlap,
              }}
            >
              <Image
                src="/images/ui/star/CM_icon_star_y.webp"
                alt=""
                fill
                sizes={`${starSize}px`}
                className="object-contain drop-shadow-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
