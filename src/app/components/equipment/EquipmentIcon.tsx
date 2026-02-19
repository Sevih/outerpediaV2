import Image from 'next/image';
import { getRarityBgPath } from '@/lib/format-text';
import type { ItemRarity } from '@/lib/theme';

type Props = {
  /** Image path relative to /images/ (e.g., 'equipment/TI_Equipment_Weapon_06') */
  src: string;
  rarity: ItemRarity;
  alt: string;
  /** Size in pixels (default 40) */
  size?: number;
  className?: string;
};

export default function EquipmentIcon({ src, rarity, alt, size = 40, className = '' }: Props) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded ${className}`}
      style={{ width: size, height: size }}
    >
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
  );
}
