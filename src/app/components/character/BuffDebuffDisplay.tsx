'use client';

import { createContext, useContext } from 'react';
import Image from 'next/image';
import type { Effect } from '@/types/effect';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import InlineTooltip from '@/app/components/inline/InlineTooltip';

type EffectMaps = {
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
};

const EffectsContext = createContext<EffectMaps>({ buffMap: {}, debuffMap: {} });

export function EffectsProvider({
  buffMap,
  debuffMap,
  children,
}: EffectMaps & { children: React.ReactNode }) {
  return (
    <EffectsContext value={{ buffMap, debuffMap }}>
      {children}
    </EffectsContext>
  );
}

type Props = {
  buffs: string[];
  debuffs: string[];
  /** Show only icons (no label text) */
  iconOnly?: boolean;
};

/** Render a row of buff/debuff effect icons */
export default function BuffDebuffDisplay({ buffs, debuffs, iconOnly }: Props) {
  const { buffMap, debuffMap } = useContext(EffectsContext);

  if (!buffs.length && !debuffs.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {buffs.map((b) => (
        <EffectBadge key={b} effect={buffMap[b]} type="buff" iconOnly={iconOnly} />
      ))}
      {debuffs.map((d) => (
        <EffectBadge key={d} effect={debuffMap[d]} type="debuff" iconOnly={iconOnly} />
      ))}
    </div>
  );
}

function EffectBadge({ effect, type, iconOnly }: { effect?: Effect; type: 'buff' | 'debuff'; iconOnly?: boolean }) {
  const { lang } = useI18n();

  if (!effect) return null;

  const label = l(effect, 'label', lang);
  const description = l(effect, 'description', lang);
  const tooltipBg = type === 'buff' ? 'bg-buff-bg' : 'bg-debuff-bg';
  const iconPath = `/images/ui/effect/${effect.icon}.webp`;

  const isIrremovable = effect.icon.includes('Interruption');
  const imageFilter = isIrremovable ? undefined : `${type}-icon`;

  const tooltip = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="relative h-6 w-6 shrink-0 rounded bg-black">
          <Image src={iconPath} alt="" fill sizes="24px" className={`object-contain ${imageFilter ?? ''}`} />
        </span>
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      <p className="text-xs text-neutral-200">{formatEffectText(description)}</p>
    </div>
  );

  const pillBg = type === 'buff' ? 'bg-buff-bg' : 'bg-debuff-bg';

  return (
    <InlineTooltip content={tooltip} bg={tooltipBg}>
      <button type="button" className="cursor-default">
        <div className={`flex items-center gap-1 rounded-md ${iconOnly ? '' : `${pillBg} py-0.5 pr-1.5 pl-0.5`}`}>
          <span className={`relative h-5 w-5 shrink-0 rounded ${iconOnly ? '' : 'bg-black'}`}>
            <Image
              src={iconPath}
              alt=""
              fill
              sizes="20px"
              className={`object-contain ${imageFilter ?? ''}`}
            />
          </span>
          {!iconOnly && <span className="text-[11px] font-semibold text-white">{label}</span>}
        </div>
      </button>
    </InlineTooltip>
  );
}
