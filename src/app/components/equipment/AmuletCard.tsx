'use client';

import Image from 'next/image';
import type { Amulet } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatScaledEffect } from '@/lib/format-text';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  amulet: Amulet;
  lang: Lang;
};

export default function AmuletCard({ amulet, lang }: Props) {
  const name = l(amulet, 'name', lang);
  const effectName = amulet.effect_name ? l(amulet, 'effect_name', lang) : null;
  const effectDesc4 = amulet.effect_desc4 ? l(amulet, 'effect_desc4', lang) : null;
  const effectDesc1 = amulet.effect_desc1 ? l(amulet, 'effect_desc1', lang) : null;
  const effectDesc = effectDesc4 ?? effectDesc1;

  return (
    <div className="card flex flex-col gap-2 p-4">
      {/* Top row: icon + name/class/effect pill */}
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/${amulet.image}`}
          rarity={amulet.rarity}
          alt={name}
          size={70}
          overlaySize={20}
          effectIcon={amulet.effect_icon}
          classType={amulet.class}
          level={amulet.level}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-bold text-equipment">{name}</p>

          {amulet.class && (
            <div className="flex items-center gap-1">
              <div className="relative h-4 w-4 shrink-0">
                <Image
                  src={`/images/ui/class/CM_Class_${amulet.class}.webp`}
                  alt={amulet.class}
                  fill
                  sizes="16px"
                  className="object-contain"
                />
              </div>
              <span className="text-xs text-zinc-400">{amulet.class}</span>
            </div>
          )}

          {effectName && (
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/40 px-2.5 py-0.5">
              {amulet.effect_icon && (
                <div className="relative h-4 w-4 shrink-0">
                  <Image
                    src={`/images/ui/effect/${amulet.effect_icon}.webp`}
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
      {(amulet.source || amulet.boss) && (
        <div className="text-xs text-zinc-500">
          {amulet.source && <p><span className="text-zinc-400">Source:</span> {amulet.source}</p>}
          {amulet.boss && <p><span className="text-zinc-400">Boss:</span> {amulet.boss}</p>}
        </div>
      )}
    </div>
  );
}
