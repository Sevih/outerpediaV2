'use client';

import Image from 'next/image';
import amuletsData from '@data/equipment/accessory.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, getRarityBgPath } from '@/lib/format-text';
import type { Amulet } from '@/types/equipment';
import InlineTooltip from './InlineTooltip';
import { EquipmentBadge } from './WeaponInline';

const amulets = amuletsData as Amulet[];

type Props = { name: string };

export default function AmuletInline({ name }: Props) {
  const { lang } = useI18n();
  const amulet = amulets.find((a) => a.name === name);

  if (!amulet) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(amulet, 'name', lang);
  const effectName = amulet.effect_name ? l(amulet, 'effect_name', lang) : null;
  const effectDesc = amulet.effect_desc4
    ? l(amulet, 'effect_desc4', lang)
    : amulet.effect_desc1
      ? l(amulet, 'effect_desc1', lang)
      : null;

  const tooltip = (
    <div className="flex gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={getRarityBgPath(amulet.rarity)} alt="" fill sizes="40px" className="object-contain" />
        <Image src={`/images/equipment/${amulet.image}.webp`} alt="" fill sizes="40px" className="object-contain" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-equipment">{label}</span>
        {amulet.class && <span className="text-xs text-neutral-400">{amulet.class}</span>}
        {effectName && <span className="text-xs text-buff">{effectName}</span>}
        {effectDesc && <p className="text-xs text-neutral-200">{formatEffectText(effectDesc)}</p>}
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <EquipmentBadge icon={`/images/equipment/${amulet.image}.webp`} bg={getRarityBgPath(amulet.rarity)} label={label} />
      </button>
    </InlineTooltip>
  );
}
