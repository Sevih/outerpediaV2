'use client';

import type { Talisman } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  talisman: Talisman;
  lang: Lang;
};

export default function TalismanMiniCard({ talisman, lang }: Props) {
  const name = l(talisman, 'name', lang);
  return (
    <div className="flex items-center gap-2">
      <EquipmentIcon
        src={`equipment/${talisman.image}`}
        rarity={talisman.rarity}
        alt={name}
      />
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-200">{name}</p>
      </div>
    </div>
  );
}
