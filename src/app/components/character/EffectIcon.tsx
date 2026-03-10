import Image from 'next/image';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import InlineTooltip from '@/app/components/inline/InlineTooltip';

type Props = {
  effect: Effect;
  type: 'buff' | 'debuff';
  lang: Lang;
  selected?: boolean;
  onClick?: () => void;
};

export default function EffectIcon({ effect, type, lang, selected, onClick }: Props) {
  const label = l(effect, 'label', lang);
  const description = l(effect, 'description', lang);
  const isIrremovable = effect.icon.includes('Interruption');
  const imageFilter = isIrremovable ? '' : `${type}-icon`;
  const ring = selected
    ? type === 'buff'
      ? 'ring-2 ring-cyan-400'
      : 'ring-2 ring-red-500'
    : '';
  const iconPath = `/images/ui/effect/${effect.icon}.webp`;
  const tooltipBg = type === 'buff' ? 'bg-buff-bg' : 'bg-debuff-bg';

  const tooltip = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="relative h-6 w-6 shrink-0 rounded bg-black">
          <Image src={iconPath} alt={label} fill sizes="24px" className={`object-contain ${imageFilter}`} />
        </span>
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      <p className="text-xs text-neutral-200">{formatEffectText(description)}</p>
    </div>
  );

  return (
    <InlineTooltip content={tooltip} bg={tooltipBg}>
      <button
        type="button"
        onClick={onClick}
        className={`relative h-6 w-6 cursor-pointer rounded bg-black transition hover:brightness-150 hover:scale-110 ${ring}`}
      >
        <Image
          src={iconPath}
          alt={label}
          fill
          sizes="24px"
          className={`object-contain ${imageFilter}`}
        />
      </button>
    </InlineTooltip>
  );
}
