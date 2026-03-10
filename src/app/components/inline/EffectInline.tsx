'use client';

import { use } from 'react';
import Image from 'next/image';
import { effectMapsPromise } from '@/lib/data/effects-client';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import InlineIcon from './InlineIcon';

type Props = {
  name: string;
  type: 'buff' | 'debuff';
};

export default function EffectInline({ name, type }: Props) {
  const { lang } = useI18n();
  const { buffMap, debuffMap } = use(effectMapsPromise);
  const effect = type === 'buff' ? buffMap[name] : debuffMap[name];

  if (!effect) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(effect, 'label', lang);
  const description = l(effect, 'description', lang);
  const color = type === 'buff' ? 'text-buff' : 'text-debuff';
  const tooltipBg = type === 'buff' ? 'bg-buff-bg' : 'bg-debuff-bg';

  // Irremovable effects (icon contains "Interruption") keep their native colors
  const isIrremovable = effect.icon.includes('Interruption');
  const imageFilter = isIrremovable ? undefined : `${type}-icon`;

  const iconPath = `/images/ui/effect/${effect.icon}.webp`;

  const tooltip = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="relative h-6 w-6 shrink-0 rounded bg-black">
          <Image src={iconPath} alt={label} fill sizes="24px" className={`object-contain ${imageFilter ?? ''}`} />
        </span>
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      <p className="text-xs text-neutral-200">{formatEffectText(description)}</p>
    </div>
  );

  return (
    <InlineIcon
      icon={iconPath}
      label={label}
      color={color}
      imageClassName={imageFilter}
      tooltip={tooltip}
      tooltipBg={tooltipBg}
    />
  );
}
