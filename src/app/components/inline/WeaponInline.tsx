'use client';

import Image from 'next/image';
import weaponsData from '@data/equipment/weapon.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatScaledEffect, getRarityBgPath } from '@/lib/format-text';
import type { Weapon } from '@/types/equipment';
import InlineTooltip from './InlineTooltip';

const weapons = weaponsData as unknown as Weapon[];

type Props = { name: string };

export default function WeaponInline({ name }: Props) {
  const { lang, t } = useI18n();
  const weapon = weapons.find((w) => w.name === name);

  if (!weapon) {
    return <span className="text-red-500">{name}</span>;
  }

  const label = l(weapon, 'name', lang);
  const effectName = weapon.effect_name ? l(weapon, 'effect_name', lang) : null;
  const effectDesc = weapon.effect_desc4
    ? l(weapon, 'effect_desc4', lang)
    : weapon.effect_desc1
      ? l(weapon, 'effect_desc1', lang)
      : null;
  const baseDesc = weapon.effect_desc1 ? l(weapon, 'effect_desc1', lang) : null;

  const tooltip = (
    <div className="flex gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={getRarityBgPath(weapon.rarity)} alt={`${weapon.rarity} rarity`} fill sizes="40px" className="object-contain" />
        <Image src={`/images/equipment/${weapon.image}.webp`} alt={label} fill sizes="40px" className="object-contain" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-equipment">{label}</span>
        {weapon.class && <span className="text-xs text-neutral-400">{t(`sys.class.${weapon.class.toLowerCase()}` as Parameters<typeof t>[0])}</span>}
        {effectName && (
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/40 px-2.5 py-1">
            {weapon.effect_icon && (
              <div className="relative h-4 w-4 shrink-0">
                <Image
                  src={`/images/ui/effect/${weapon.effect_icon}.webp`}
                  alt={effectName || 'Effect'}
                  fill
                  sizes="16px"
                  className="object-contain"
                />
              </div>
            )}
            <span className="text-xs text-buff">Lv. 5 {effectName}</span>
          </div>
        )}
        {effectDesc && <p className="text-xs text-neutral-200">{formatScaledEffect(effectDesc, baseDesc)}</p>}
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <EquipmentBadge icon={`/images/equipment/${weapon.image}.webp`} bg={getRarityBgPath(weapon.rarity)} label={label} />
      </button>
    </InlineTooltip>
  );
}

/** Shared inline badge: rarity background + equipment icon + label */
export function EquipmentBadge({ icon, bg, label, color = 'text-equipment' }: {
  icon: string;
  bg: string;
  label: string;
  color?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${color}`}>
      <span className="relative inline-block h-4.5 w-4.5 shrink-0">
        <Image src={bg} alt="Rarity" fill sizes="18px" className="object-contain" />
        <Image src={icon} alt={label} fill sizes="18px" className="object-contain" />
      </span>
      <span className="underline">{label}</span>
    </span>
  );
}
