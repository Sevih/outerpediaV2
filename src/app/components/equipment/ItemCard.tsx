'use client';

import type { Item } from '@/types/item';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { ITEM_RARITY_TEXT } from '@/lib/theme';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  item: Item;
  lang: Lang;
};

export default function ItemCard({ item, lang }: Props) {
  const name = l(item, 'name', lang);
  const description = l(item, 'description', lang)?.replace(/\\n/g, '\n');

  return (
    <div className="card flex flex-col gap-2 p-4">
      {/* Top row: icon + name/type */}
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`items/${item.icon}`}
          rarity={item.rarity}
          alt={name}
          size={70}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={`font-bold ${ITEM_RARITY_TEXT[item.rarity]}`}>{name}</p>
          <span className="w-fit rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 capitalize">
            {item.type}
          </span>
        </div>
      </div>

      {/* Full-width: description */}
      {description && (
        <p className="whitespace-pre-line text-xs text-zinc-300">{description}</p>
      )}
    </div>
  );
}
