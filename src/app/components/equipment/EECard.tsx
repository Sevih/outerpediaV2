'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ExclusiveEquipment } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, formatScaledEffect, getRarityBgPath, slugifyEquipment } from '@/lib/format-text';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';

type Props = {
  ee: ExclusiveEquipment;
  charId: string;
  charName: string;
  lang: Lang;
};

export default function EECard({ ee, charId, charName, lang }: Props) {
  const name = l(ee, 'name', lang);
  const mainStat = l(ee, 'mainStat', lang);
  const effect = l(ee, 'effect', lang);
  const effect10 = l(ee, 'effect10', lang);

  return (
    <Link href={`/${lang}/equipments/${slugifyEquipment(ee.name)}`} className="card flex flex-col gap-2 p-4 transition-colors hover:bg-zinc-800/80">
      {/* Top row: character portrait + EE name/charName + rank */}
      <div className="flex items-start gap-3">
        <div className="relative h-17.5 w-17.5 shrink-0 overflow-hidden rounded-lg">
          <Image
            src={getRarityBgPath('legendary')}
            alt=""
            fill
            sizes="70px"
            className="object-contain"
          />
          <div className="absolute inset-1.5">
            <Image
              src={`/images/characters/ee/${charId}.webp`}
              alt={name}
              fill
              sizes="58px"
              className="object-contain"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-equipment">{name}</p>
              <p className="text-xs text-zinc-400">{charName}</p>
            </div>
            {ee.rank && (
              <div className="relative h-8 w-8 shrink-0">
                <Image
                  src={`/images/ui/rank/IG_Event_Rank_${ee.rank}.webp`}
                  alt={ee.rank}
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
            )}
          </div>

          {mainStat && (
            <span className="w-fit rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              {mainStat}
            </span>
          )}
        </div>
      </div>

      {/* Full-width: effects */}
      {effect && (
        <p className="text-xs text-zinc-300">
          <span className="text-zinc-500">Lv. 1 </span>
          {formatEffectText(effect)}
        </p>
      )}

      {effect10 && effect10 !== effect && (
        <p className="text-xs text-zinc-300">
          <span className="text-zinc-500">Lv. 10 </span>
          {formatScaledEffect(effect10, effect)}
        </p>
      )}

      {/* Full-width: buff/debuff icons */}
      <BuffDebuffDisplay buffs={ee.buff} debuffs={ee.debuff} />
    </Link>
  );
}
