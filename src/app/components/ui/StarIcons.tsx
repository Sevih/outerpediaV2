'use client';

import Image from 'next/image';
import { STAR_ICONS, type StarColor } from '@/lib/stars';

type Props = {
  stars: StarColor[];
  size?: number;
  spacing?: number;
};

export default function StarIcons({ stars, size = 16, spacing = 1 }: Props) {
  return (
    <span className="inline-flex items-center align-middle">
      {stars.map((color, i) => (
        <Image
          key={i}
          src={STAR_ICONS[color]}
          alt="star"
          width={size}
          height={size}
          style={{ width: size, height: size, marginLeft: i > 0 ? spacing : 0 }}
          className="object-contain"
        />
      ))}
    </span>
  );
}

export function YellowStars({ count, size = 16 }: { count: number; size?: number }) {
  return <StarIcons stars={Array<StarColor>(count).fill('y')} size={size} />;
}

export function StarBadge({ level }: { level: string | number }) {
  return <span className="font-semibold text-yellow-300">{level}★</span>;
}
