'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Amulet, BossDisplayMap } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import { formatEffectText, slugifyEquipment } from '@/lib/format-text';
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
    <div className="card relative flex flex-col gap-2 p-4 transition-colors hover:bg-zinc-800/80">
      {/* Top row: icon + name/class */}
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
          <Link href={href(`/equipment/${slugifyEquipment(amulet.name)}`)} className="font-bold text-equipment after:absolute after:inset-0">{name}</Link>

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
        </div>
      </div>

      {/* Effect pill + description (full width) */}
      {effectName && (
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-500/40 px-2.5 py-0.5">
          {amulet.effect_icon && (
            <div className="relative h-4 w-4 shrink-0">
              <Image
                src={`/images/ui/effect/${amulet.effect_icon}.webp`}
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
      {effectDesc && (
        <p className="text-xs text-zinc-300">{formatEffectText(effectDesc)}</p>
      )}

      <EquipmentSource source={amulet.source} boss={amulet.boss} bossMap={bossMap} lang={lang} />
    </div>
  );
}
