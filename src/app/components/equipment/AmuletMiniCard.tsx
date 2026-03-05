'use client';

import Image from 'next/image';
import type { Amulet, BossDisplayMap } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatScaledEffect } from '@/lib/format-text';
import InlineTooltip from '@/app/components/inline/InlineTooltip';
import { StatInline } from '@/app/components/inline';
import EquipmentIcon from './EquipmentIcon';
import EquipmentSource from './EquipmentSource';
import { getStatMax } from './stat-ranges';

type Props = {
  amulet: Amulet;
  lang: Lang;
  mainStat?: string;
  bossMap: BossDisplayMap;
};

export default function AmuletMiniCard({ amulet, lang, mainStat, bossMap }: Props) {
  const name = l(amulet, 'name', lang);
  const effectName = amulet.effect_name ? l(amulet, 'effect_name', lang) : null;
  const effectDesc4 = amulet.effect_desc4 ? l(amulet, 'effect_desc4', lang) : null;
  const effectDesc1 = amulet.effect_desc1 ? l(amulet, 'effect_desc1', lang) : null;
  const effectDesc = effectDesc4 ?? effectDesc1;

  const tooltip = (
    <div className="flex flex-col gap-1.5">
      {/* Icon + name + stats */}
      <div className="flex items-start gap-2">
        <EquipmentIcon
          src={`equipment/${amulet.image}`}
          rarity={amulet.rarity}
          alt={name}
          size={50}
          effectIcon={amulet.effect_icon}
          classType={amulet.class}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-equipment">{name}</span>
          {mainStat && mainStat.split('/').map((stat) => {
            const max = getStatMax('accessories', stat, amulet.rarity, amulet.level);
            return (
              <div key={stat} className="flex items-center justify-between gap-4 text-xs">
                <StatInline name={stat} />
                {max && <span className="text-zinc-400">{max}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Effect name pill */}
      {effectName && (
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/40 px-2.5 py-1">
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
          <span className="text-xs text-buff">
            Lv. 5 {effectName}
          </span>
        </div>
      )}

      {/* Effect description (tier 4) */}
      {effectDesc && (
        <p className="text-xs text-zinc-300">{formatScaledEffect(effectDesc, effectDesc1)}</p>
      )}

      <EquipmentSource source={amulet.source} boss={amulet.boss} bossMap={bossMap} lang={lang} />
    </div>
  );

  const card = (
    <div className="flex items-center gap-2">
      <EquipmentIcon
        src={`equipment/${amulet.image}`}
        rarity={amulet.rarity}
        alt={name}
        effectIcon={amulet.effect_icon}
        classType={amulet.class}
      />
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-200">{name}</p>
        {mainStat && (
          <div className="flex flex-wrap gap-x-1 text-xs">
            {mainStat.split('/').map((s) => <StatInline key={s} name={s} />)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <div className="cursor-default">{card}</div>
    </InlineTooltip>
  );
}
