'use client';

import Image from 'next/image';
import setsData from '@data/equipment/sets.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, getRarityBgPath } from '@/lib/format-text';
import type { ArmorSet } from '@/types/equipment';
import InlineTooltip from './InlineTooltip';
import { EquipmentBadge } from './WeaponInline';

const sets = setsData as ArmorSet[];

type Props = { name: string };

export default function SetInline({ name }: Props) {
  const { lang } = useI18n();

  // Support both "Attack" and "Attack Set" formats
  const set = sets.find((s) =>
    s.name === name || s.name === `${name} Set` || s.name.replace(' Set', '') === name
  );

  if (!set) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(set, 'name', lang);
  const effect2 = l(set, 'effect_2_4', lang);
  const effect4 = l(set, 'effect_4_4', lang);
  const iconPath = `/images/equipment/TI_Equipment_Armor_${set.image_prefix}.webp`;

  const tooltip = (
    <div className="flex gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={iconPath} alt="" fill sizes="40px" className="object-contain" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-equipment">{label}</span>
        {effect2 && (
          <div>
            <span className="text-xs text-buff">2-Piece: </span>
            <span className="text-xs text-neutral-200">{formatEffectText(effect2)}</span>
          </div>
        )}
        {effect4 && (
          <div>
            <span className="text-xs text-buff">4-Piece: </span>
            <span className="text-xs text-neutral-200">{formatEffectText(effect4)}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <EquipmentBadge icon={iconPath} bg={getRarityBgPath('legendary')} label={label} />
      </button>
    </InlineTooltip>
  );
}
