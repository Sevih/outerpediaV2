'use client';

import Image from 'next/image';
import buffsData from '@data/effects/buffs.json';
import debuffsData from '@data/effects/debuffs.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import type { Effect } from '@/types/effect';
import InlineIcon from './InlineIcon';

const buffs = buffsData as Effect[];
const debuffs = debuffsData as Effect[];

type Props = {
  name: string;
  type: 'buff' | 'debuff';
};

export default function EffectInline({ name, type }: Props) {
  const { lang } = useI18n();
  const pool = type === 'buff' ? buffs : debuffs;
  const effect = pool.find((e) => e.name === name);

  if (!effect) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(effect, 'label', lang);
  const description = l(effect, 'description', lang);
  const color = type === 'buff' ? 'text-buff' : 'text-debuff';
  const tooltipBg = type === 'buff' ? 'bg-sky-900/80' : 'bg-red-900/80';

  const tooltip = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="relative h-4 w-4 shrink-0">
          <Image src={`/images/ui/effect/${effect.icon}.webp`} alt="" fill sizes="16px" className="object-contain" />
        </span>
        <span className={`text-sm font-bold ${color}`}>{label}</span>
      </div>
      <p className="text-xs text-neutral-200">{formatEffectText(description)}</p>
    </div>
  );

  return (
    <InlineIcon
      icon={`/images/ui/effect/${effect.icon}.webp`}
      label={label}
      color={color}
      tooltip={tooltip}
      tooltipBg={tooltipBg}
    />
  );
}
