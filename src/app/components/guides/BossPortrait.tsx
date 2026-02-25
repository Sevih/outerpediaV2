import Image from 'next/image';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import type { CharacterPortraitSize } from '@/app/components/character/CharacterPortrait';

const SIZES: Record<CharacterPortraitSize, { px: number; cls: string }> = {
  xxs: { px: 20, cls: 'h-5 w-5' },
  xs: { px: 32, cls: 'h-8 w-8' },
  sm: { px: 48, cls: 'h-12 w-12' },
  md: { px: 64, cls: 'h-16 w-16' },
  lg: { px: 96, cls: 'h-24 w-24' },
};

type Props = {
  icons: string;
  name?: string;
  size?: CharacterPortraitSize;
  className?: string;
};

export default function BossPortrait({ icons, name = '', size = 'md', className = '' }: Props) {
  if (icons.startsWith('2')) {
    return <CharacterPortrait id={icons} size={size} name={name} className={className} />;
  }

  const s = SIZES[size];

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg border border-white/10 ${s.cls} ${className}`}>
      <Image
        src={`/images/characters/boss/portrait/MT_${icons}.webp`}
        alt={name}
        fill
        sizes={`${s.px}px`}
        className="object-cover"
      />
    </div>
  );
}
