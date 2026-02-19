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
};

export default function EquipmentIcon({
  src, rarity, alt, size = 50, className = '',
  effectIcon, classType,
}: Props) {
  const badgeSize = 15;

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
          style={{ width: badgeSize, height: badgeSize }}
        >
          <div className="relative h-full w-full">
            <Image
              src={`/images/ui/effect/${effectIcon}.webp`}
              alt=""
              fill
              sizes={`${badgeSize}px`}
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Class icon — middle-right */}
      {classType && (
        <div
          className="absolute right-0.5 bottom-3"
          style={{ width: badgeSize, height: badgeSize }}
        >
          <div className="relative h-full w-full">
            <Image
              src={`/images/ui/class/CM_Class_${classType}.webp`}
              alt={classType}
              fill
              sizes={`${badgeSize}px`}
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
