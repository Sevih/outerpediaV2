'use client';

import Image from 'next/image';
import talismansData from '@data/equipment/talisman.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatScaledEffect, getRarityBgPath } from '@/lib/format-text';
import type { Talisman } from '@/types/equipment';
import InlineTooltip from './InlineTooltip';
import { EquipmentBadge } from './WeaponInline';

const talismans = talismansData as unknown as Talisman[];

type Props = { name: string };

export default function TalismanInline({ name }: Props) {
  const { lang } = useI18n();
  const talisman = talismans.find((t) => t.name === name);

  if (!talisman) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(talisman, 'name', lang);
  const effectName = l(talisman, 'effect_name', lang)
    ?.replace('Action Point', 'AP')
    .replace('Chain Point', 'CP');
  const effectDesc1 = l(talisman, 'effect_desc1', lang);
  const effectDesc4 = l(talisman, 'effect_desc4', lang);

  const tooltip = (
    <div className="flex gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={getRarityBgPath(talisman.rarity)} alt={`${talisman.rarity} rarity`} fill sizes="40px" className="object-contain" />
        <Image src={`/images/equipment/${talisman.image}.webp`} alt={label} fill sizes="40px" className="object-contain" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-equipment">{label}</span>
        {effectName && (
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/40 px-2.5 py-1">
            {talisman.effect_icon && (
              <div className="relative h-4 w-4 shrink-0">
                <Image
                  src={`/images/ui/effect/${talisman.effect_icon}.webp`}
                  alt={effectName || 'Effect'}
                  fill
                  sizes="16px"
                  className="object-contain"
                />
              </div>
            )}
            <span className="text-xs text-buff">{effectName}</span>
          </div>
        )}
        {effectDesc1 && (
          <p className="text-xs text-neutral-200">
            <span className="text-zinc-500">Lv. 0</span> {formatScaledEffect(effectDesc1, effectDesc4)}
          </p>
        )}
        {effectDesc4 && effectDesc4 !== effectDesc1 && (
          <p className="text-xs text-neutral-200">
            <span className="text-zinc-500">Lv. 10</span> {formatScaledEffect(effectDesc4, effectDesc1)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <EquipmentBadge icon={`/images/equipment/${talisman.image}.webp`} bg={getRarityBgPath(talisman.rarity)} label={label} />
      </button>
    </InlineTooltip>
  );
}
