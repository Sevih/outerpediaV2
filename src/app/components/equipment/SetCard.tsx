'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ArmorSet, BossDisplayMap } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import { formatEffectText, slugifyEquipment } from '@/lib/format-text';
import EquipmentIcon from './EquipmentIcon';
import EquipmentSource from './EquipmentSource';

type Props = {
  set: ArmorSet;
  lang: Lang;
  bossMap: BossDisplayMap;
};

export default function SetCard({ set, lang, bossMap }: Props) {
  const { t, href } = useI18n();
  const name = l(set, 'name', lang);
  const effect2 = l(set, 'effect_2_4', lang) || l(set, 'effect_2_1', lang);
  const effect4 = l(set, 'effect_4_4', lang) || l(set, 'effect_4_1', lang);

  return (
    <div className="card relative flex flex-col gap-2 p-4 transition-colors hover:bg-zinc-800/80">
      {/* Top row: icon + name/class */}
      <div className="flex items-start gap-3">
        <EquipmentIcon
          src={`equipment/TI_Equipment_Armor_${set.image_prefix}`}
          rarity={set.rarity}
          alt={name}
          size={70}
          overlaySize={20}
          effectIcon={set.set_icon}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={href(`/equipment/${slugifyEquipment(set.name)}`)} className="font-bold text-equipment after:absolute after:inset-0">{name}</Link>

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
              <span className="text-xs text-zinc-400">{t(`sys.class.${set.class.toLowerCase()}` as Parameters<typeof t>[0])}</span>
            </div>
          )}
        </div>
      </div>

      {/* Full-width: set effects */}
      {(effect2 || effect4) && (
        <div className="text-xs">
          {effect2 && (
            <div>
              <span className="text-buff">{t('equip.set.2piece')}: </span>
              <span className="text-zinc-300">{formatEffectText(effect2)}</span>
            </div>
          )}
          {effect4 && (
            <div className="mt-0.5">
              <span className="text-buff">{t('equip.set.4piece')}: </span>
              <span className="text-zinc-300">{formatEffectText(effect4)}</span>
            </div>
          )}
        </div>
      )}

      <EquipmentSource source={set.source} boss={set.boss} bossMap={bossMap} lang={lang} />
    </div>
  );
}
