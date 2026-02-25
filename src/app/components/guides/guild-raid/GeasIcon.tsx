import Image from 'next/image';

type Props = {
  iconName: string;
  level: number;
  /** Apply buff-icon or debuff-icon color filter */
  variant: 'buff' | 'debuff';
  /** Pixel size of the slot */
  size?: number;
  className?: string;
};

export default function GeasIcon({ iconName, level, variant, size = 40, className = '' }: Props) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Image
        src={`/images/ui/geas/GD_Slot_Bg_0${level}.webp`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain"
      />
      <Image
        src={`/images/ui/geas/${iconName}.webp`}
        alt=""
        fill
        sizes={`${size}px`}
        className={`object-contain p-1 ${variant === 'debuff' ? 'debuff-icon' : 'buff-icon'}`}
      />
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        Lv.{level}
      </span>
    </div>
  );
}
