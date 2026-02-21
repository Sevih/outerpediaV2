'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Weapon, BossDisplayMap } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import { formatScaledEffect, slugifyEquipment } from '@/lib/format-text';
import EquipmentIcon from './EquipmentIcon';
import EquipmentSource from './EquipmentSource';

type Props = {
  weapon: Weapon;
  lang: Lang;
  bossMap: BossDisplayMap;
};

export default function WeaponCard({ weapon, lang, bossMap }: Props) {
  const { t } = useI18n();
  const name = l(weapon, 'name', lang);
  const effectName = weapon.effect_name ? l(weapon, 'effect_name', lang) : null;
  const effectDesc4 = weapon.effect_desc4 ? l(weapon, 'effect_desc4', lang) : null;
  const effectDesc1 = weapon.effect_desc1 ? l(weapon, 'effect_desc1', lang) : null;
  const effectDesc = effectDesc4 ?? effectDesc1;

  return (
    <Link href={`/${lang}/equipments/${slugifyEquipment(weapon.name)}`} className="card flex flex-col gap-2 p-4 transition-colors hover:bg-zinc-800/80">
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
              <span className="text-xs text-zinc-400">{t(`sys.class.${weapon.class.toLowerCase()}` as Parameters<typeof t>[0])}</span>
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

      <EquipmentSource source={weapon.source} boss={weapon.boss} equipName={weapon.name} bossMap={bossMap} lang={lang} />
    </Link>
  );
}
