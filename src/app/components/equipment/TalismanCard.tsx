'use client';

import type { Talisman } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  talisman: Talisman;
  lang: Lang;
};

export default function TalismanCard({ talisman, lang }: Props) {
  const name = l(talisman, 'name', lang);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/${talisman.image}`}
          rarity={talisman.rarity}
          alt={name}
          size={48}
        />
        <div>
          <p className="font-bold text-equipment">{name}</p>
          {/* TODO: effect name, effect description, source */}
        </div>
      </div>
    </div>
  );
}
