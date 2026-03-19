'use client';

import Image from 'next/image';
import type { Weapon, BossDisplayMap } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import InlineTooltip from '@/app/components/inline/InlineTooltip';
import { StatInline } from '@/app/components/inline';
import EquipmentIcon from './EquipmentIcon';
import EquipmentSource from './EquipmentSource';
import { getStatMax } from './stat-ranges';

type Props = {
  weapon: Weapon;
  lang: Lang;
  mainStat?: string;
  bossMap: BossDisplayMap;
};

export default function WeaponMiniCard({ weapon, lang, mainStat, bossMap }: Props) {
  const name = l(weapon, 'name', lang);
  const effectName = weapon.effect_name ? l(weapon, 'effect_name', lang) : null;
  const effectDesc4 = weapon.effect_desc4 ? l(weapon, 'effect_desc4', lang) : null;
  const effectDesc1 = weapon.effect_desc1 ? l(weapon, 'effect_desc1', lang) : null;
  const effectDesc = effectDesc4 ?? effectDesc1;

  const tooltip = (
    <div className="flex flex-col gap-1.5">
      {/* Icon + name + stats */}
      <div className="flex items-start gap-2">
        <EquipmentIcon
          src={`equipment/${weapon.image}`}
          rarity={weapon.rarity}
          alt={name}
          size={50}
          effectIcon={weapon.effect_icon}
          classType={weapon.class}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-equipment">{name}</span>
          {mainStat && mainStat.split('/').map((stat) => {
            const max = getStatMax('weapons', stat, weapon.rarity, weapon.level);
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
          {weapon.effect_icon && (
            <div className="relative h-4 w-4 shrink-0">
              <Image
                src={`/images/ui/effect/${weapon.effect_icon}.webp`}
                alt={effectName ?? ''}
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
        <p className="text-xs text-zinc-300">{formatEffectText(effectDesc)}</p>
      )}

      <EquipmentSource source={weapon.source} boss={weapon.boss} bossMap={bossMap} lang={lang} />
    </div>
  );

  const card = (
    <div className="flex items-center gap-2">
      <EquipmentIcon
        src={`equipment/${weapon.image}`}
        rarity={weapon.rarity}
        alt={name}
        effectIcon={weapon.effect_icon}
        classType={weapon.class}
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
