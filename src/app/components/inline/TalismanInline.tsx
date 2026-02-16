'use client';

import Image from 'next/image';
import talismansData from '@data/equipment/talisman.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, getRarityBgPath } from '@/lib/format-text';
import type { Talisman } from '@/types/equipment';
import InlineTooltip from './InlineTooltip';
import { EquipmentBadge } from './WeaponInline';

const talismans = talismansData as Talisman[];

type Props = { name: string };

export default function TalismanInline({ name }: Props) {
  const { lang } = useI18n();
  const talisman = talismans.find((t) => t.name === name);

  if (!talisman) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(talisman, 'name', lang);
  const effectName = l(talisman, 'effect_name', lang);
  const effectLv1 = l(talisman, 'effect_desc1', lang);
  const effectLv4 = l(talisman, 'effect_desc4', lang);

  const tooltip = (
    <div className="flex gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={getRarityBgPath(talisman.rarity)} alt="" fill sizes="40px" className="object-contain" />
        <Image src={`/images/equipment/${talisman.image}.webp`} alt="" fill sizes="40px" className="object-contain" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-equipment">{label}</span>
        <span className="text-xs text-buff">{effectName}</span>
        {effectLv1 && (
          <p className="text-xs text-neutral-400">{formatEffectText(effectLv1)}</p>
        )}
        {effectLv4 && (
          <p className="text-xs italic text-equipment">{formatEffectText(effectLv4)}</p>
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
