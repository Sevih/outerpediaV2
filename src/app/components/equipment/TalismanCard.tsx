'use client';

import Image from 'next/image';
import type { Talisman } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, formatScaledEffect } from '@/lib/format-text';
import EquipmentIcon from './EquipmentIcon';

type Props = {
  talisman: Talisman;
  lang: Lang;
};

export default function TalismanCard({ talisman, lang }: Props) {
  const name = l(talisman, 'name', lang);
  const effectName = l(talisman, 'effect_name', lang)
    ?.replace('Action Point', 'AP')
    .replace('Chain Point', 'CP');
  const effectDesc1 = l(talisman, 'effect_desc1', lang);
  const effectDesc4 = l(talisman, 'effect_desc4', lang);

  return (
    <div className="card flex flex-col gap-2 p-4">
      {/* Top row: icon + name/effect pill */}
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/${talisman.image}`}
          rarity={talisman.rarity}
          alt={name}
          size={70}
          overlaySize={20}
          effectIcon={talisman.effect_icon}
          level={talisman.level}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-bold text-equipment">{name}</p>

          {effectName && (
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/40 px-2.5 py-0.5">
              {talisman.effect_icon && (
                <div className="relative h-4 w-4 shrink-0">
                  <Image
                    src={`/images/ui/effect/${talisman.effect_icon}.webp`}
                    alt=""
                    fill
                    sizes="16px"
                    className="object-contain"
                  />
                </div>
              )}
              <span className="text-xs text-buff">{effectName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Full-width: effect descriptions */}
      {effectDesc1 && (
        <p className="text-xs text-zinc-300">
          <span className="text-zinc-500">Lv. 0 </span>
          {formatEffectText(effectDesc1)}
        </p>
      )}
      {effectDesc4 && effectDesc4 !== effectDesc1 && (
        <p className="text-xs text-zinc-300">
          <span className="text-zinc-500">Lv. 10 </span>
          {formatScaledEffect(effectDesc4, effectDesc1)}
        </p>
      )}

      {/* Full-width: source / boss */}
      {(talisman.source || talisman.boss) && (
        <div className="text-xs text-zinc-500">
          {talisman.source && <p><span className="text-zinc-400">Source:</span> {talisman.source}</p>}
          {talisman.boss && <p><span className="text-zinc-400">Boss:</span> {talisman.boss}</p>}
        </div>
      )}
    </div>
  );
}
