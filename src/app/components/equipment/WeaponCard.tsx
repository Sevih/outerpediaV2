'use client';

import type { Weapon } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  weapon: Weapon;
  lang: Lang;
};

export default function WeaponCard({ weapon, lang }: Props) {
  const name = l(weapon, 'name', lang);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/${weapon.image}`}
          rarity={weapon.rarity}
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
