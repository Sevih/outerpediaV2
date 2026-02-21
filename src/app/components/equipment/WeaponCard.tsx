'use client';

import Image from 'next/image';
import type { Weapon } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatScaledEffect } from '@/lib/format-text';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  weapon: Weapon;
  lang: Lang;
};

export default function WeaponCard({ weapon, lang }: Props) {
  const name = l(weapon, 'name', lang);
  const effectName = weapon.effect_name ? l(weapon, 'effect_name', lang) : null;
  const effectDesc4 = weapon.effect_desc4 ? l(weapon, 'effect_desc4', lang) : null;
  const effectDesc1 = weapon.effect_desc1 ? l(weapon, 'effect_desc1', lang) : null;
  const effectDesc = effectDesc4 ?? effectDesc1;

  return (
    <div className="card flex flex-col gap-2 p-4">
      {/* Top row: icon + name/class/effect pill */}
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/${weapon.image}`}
          rarity={weapon.rarity}
          alt={name}
          size={70}
          overlaySize={20}
          effectIcon={weapon.effect_icon}
          classType={weapon.class}
          level={weapon.level}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-bold text-equipment">{name}</p>

          {weapon.class && (
            <div className="flex items-center gap-1">
              <div className="relative h-4 w-4 shrink-0">
                <Image
                  src={`/images/ui/class/CM_Class_${weapon.class}.webp`}
                  alt={weapon.class}
                  fill
                  sizes="16px"
                  className="object-contain"
                />
              </div>
              <span className="text-xs text-zinc-400">{weapon.class}</span>
            </div>
          )}

          {effectName && (
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/40 px-2.5 py-0.5">
              {weapon.effect_icon && (
                <div className="relative h-4 w-4 shrink-0">
                  <Image
                    src={`/images/ui/effect/${weapon.effect_icon}.webp`}
                    alt=""
                    fill
                    sizes="16px"
                    className="object-contain"
                  />
                </div>
              )}
              <span className="text-xs text-buff">Lv. 5 {effectName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Full-width: description */}
      {effectDesc && (
        <p className="text-xs text-zinc-300">{formatScaledEffect(effectDesc, effectDesc1)}</p>
      )}

      {/* Full-width: source / boss */}
      {(weapon.source || weapon.boss) && (
        <div className="text-xs text-zinc-500">
          {weapon.source && <p><span className="text-zinc-400">Source:</span> {weapon.source}</p>}
          {weapon.boss && <p><span className="text-zinc-400">Boss:</span> {weapon.boss}</p>}
        </div>
      )}
    </div>
  );
}
