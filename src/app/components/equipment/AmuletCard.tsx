'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Amulet, BossDisplayMap } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import { formatScaledEffect, slugifyEquipment } from '@/lib/format-text';
import EquipmentIcon from './EquipmentIcon';
import EquipmentSource from './EquipmentSource';

type Props = {
  amulet: Amulet;
  lang: Lang;
  bossMap: BossDisplayMap;
};

export default function AmuletCard({ amulet, lang, bossMap }: Props) {
  const { t, href } = useI18n();
  const name = l(amulet, 'name', lang);
  const effectName = amulet.effect_name ? l(amulet, 'effect_name', lang) : null;
  const effectDesc4 = amulet.effect_desc4 ? l(amulet, 'effect_desc4', lang) : null;
  const effectDesc1 = amulet.effect_desc1 ? l(amulet, 'effect_desc1', lang) : null;
  const effectDesc = effectDesc4 ?? effectDesc1;

  return (
    <Link href={href(`/equipments/${slugifyEquipment(amulet.name)}`)} className="card flex flex-col gap-2 p-4 transition-colors hover:bg-zinc-800/80">
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
              <span className="text-xs text-zinc-400">{t(`sys.class.${amulet.class.toLowerCase()}` as Parameters<typeof t>[0])}</span>
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

      <EquipmentSource source={amulet.source} boss={amulet.boss} equipName={amulet.name} bossMap={bossMap} lang={lang} />
    </Link>
  );
}
