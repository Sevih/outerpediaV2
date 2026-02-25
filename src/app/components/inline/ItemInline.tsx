'use client';

import Image from 'next/image';
import itemsData from '@data/items.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { getRarityBgPath } from '@/lib/format-text';
import type { Item } from '@/types/item';
import InlineTooltip from './InlineTooltip';
import { EquipmentBadge } from './WeaponInline';

const items = itemsData as Item[];

type Props = { name: string };

export default function ItemInline({ name }: Props) {
  const { lang } = useI18n();
  const item = items.find((i) => i.name === name);

  if (!item) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(item, 'name', lang);
  const description = l(item, 'description', lang);
  const iconPath = `/images/items/${item.icon}.webp`;

  const tooltip = (
    <div className="flex gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={getRarityBgPath(item.rarity)} alt="" fill sizes="40px" className="object-contain" />
        <Image src={iconPath} alt="" fill sizes="40px" className="object-contain" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-equipment">{label}</span>
        {description && (
          <p className="text-xs text-neutral-200">
            {description.split(/\\n/).map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <EquipmentBadge icon={iconPath} bg={getRarityBgPath(item.rarity)} label={label} />
      </button>
    </InlineTooltip>
  );
}
