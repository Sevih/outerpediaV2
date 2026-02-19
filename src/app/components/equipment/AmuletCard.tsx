'use client';

import type { Amulet } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  amulet: Amulet;
  lang: Lang;
};

export default function AmuletCard({ amulet, lang }: Props) {
  const name = l(amulet, 'name', lang);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/${amulet.image}`}
          rarity={amulet.rarity}
          alt={name}
          size={48}
        />
        <div>
          <p className="font-bold text-equipment">{name}</p>
          {/* TODO: effect name, effect description, class restriction, main stats, source */}
        </div>
      </div>
    </div>
  );
}
