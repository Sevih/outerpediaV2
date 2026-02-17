import Image from 'next/image';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';

type Props = {
  effect: Effect;
  type: 'buff' | 'debuff';
  lang: Lang;
  selected?: boolean;
  onClick?: () => void;
};

export default function EffectIcon({ effect, type, lang, selected, onClick }: Props) {
  const label = l(effect, 'label', lang);
  const isIrremovable = effect.icon.includes('Interruption');
  const imageFilter = isIrremovable ? '' : `${type}-icon`;
  const ring = selected
    ? type === 'buff'
      ? 'ring-2 ring-cyan-400'
      : 'ring-2 ring-red-500'
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`relative h-8 w-8 cursor-pointer rounded transition hover:brightness-125 ${ring}`}
    >
      <Image
        src={`/images/ui/effect/${effect.icon}.webp`}
        alt={label}
        fill
        sizes="32px"
        className={`object-contain ${imageFilter}`}
      />
    </button>
  );
}
