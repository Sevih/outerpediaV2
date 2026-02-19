'use client';

import type { Amulet } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  amulet: Amulet;
  lang: Lang;
  mainStat?: string;
};

export default function AmuletMiniCard({ amulet, lang, mainStat }: Props) {
  const name = l(amulet, 'name', lang);
  return (
    <div className="flex items-center gap-2">
      <EquipmentIcon
        src={`equipment/${amulet.image}`}
        rarity={amulet.rarity}
        alt={name}
      />
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-200">{name}</p>
        {mainStat && <p className="text-xs text-zinc-500">{mainStat}</p>}
      </div>
    </div>
  );
}
