'use client';

import Image from 'next/image';
import type { ArmorSet } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  set: ArmorSet;
  lang: Lang;
};

export default function SetCard({ set, lang }: Props) {
  const name = l(set, 'name', lang);
  const effect2 = l(set, 'effect_2_4', lang) || l(set, 'effect_2_1', lang);
  const effect4 = l(set, 'effect_4_4', lang) || l(set, 'effect_4_1', lang);

  return (
    <div className="card flex flex-col gap-2 p-4">
      {/* Top row: icon + name/class */}
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/TI_Equipment_Armor_${set.image_prefix}`}
          rarity={set.rarity}
          alt={name}
          size={70}
          effectIcon={set.set_icon}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-bold text-equipment">{name}</p>

          {set.class && (
            <div className="flex items-center gap-1">
              <div className="relative h-4 w-4 shrink-0">
                <Image
                  src={`/images/ui/class/CM_Class_${set.class}.webp`}
                  alt={set.class}
                  fill
                  sizes="16px"
                  className="object-contain"
                />
              </div>
              <span className="text-xs text-zinc-400">{set.class}</span>
            </div>
          )}
        </div>
      </div>

      {/* Full-width: set effects */}
      {(effect2 || effect4) && (
        <div className="text-xs">
          {effect2 && (
            <div>
              <span className="text-buff">2-Piece: </span>
              <span className="text-zinc-300">{formatEffectText(effect2)}</span>
            </div>
          )}
          {effect4 && (
            <div className="mt-0.5">
              <span className="text-buff">4-Piece: </span>
              <span className="text-zinc-300">{formatEffectText(effect4)}</span>
            </div>
          )}
        </div>
      )}

      {/* Full-width: source / boss */}
      {(set.source || set.boss) && (
        <div className="text-xs text-zinc-500">
          {set.source && <p><span className="text-zinc-400">Source:</span> {set.source}</p>}
          {set.boss && <p><span className="text-zinc-400">Boss:</span> {set.boss}</p>}
        </div>
      )}
    </div>
  );
}
