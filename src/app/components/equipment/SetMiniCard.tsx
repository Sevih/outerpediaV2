'use client';

import Image from 'next/image';
import type { ArmorSet, RecoSetEntry, BossDisplayMap } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TFunction } from '@/i18n';
import { formatEffectText } from '@/lib/format-text';
import InlineTooltip from '@/app/components/inline/InlineTooltip';
import EquipmentIcon from './EquipmentIcon';
import EquipmentSource from './EquipmentSource';

type Props = {
  combo: RecoSetEntry[];
  sets: ArmorSet[];
  lang: Lang;
  bossMap: BossDisplayMap;
};

const SLOTS_4 = ['Helmet', 'Armor', 'Gloves', 'Shoes'] as const;
const SLOTS_FIRST = ['Helmet', 'Armor'] as const;
const SLOTS_SECOND = ['Gloves', 'Shoes'] as const;

function findSet(sets: ArmorSet[], name: string): ArmorSet | undefined {
  return sets.find((s) => s.name === name || s.name === `${name} Set`);
}

function SetPieceTooltip({ set, lang, show4Piece, bossMap, t }: { set: ArmorSet; lang: Lang; show4Piece: boolean; bossMap: BossDisplayMap; t: TFunction }) {
  const name = l(set, 'name', lang);
  const effect2 = l(set, 'effect_2_4', lang);
  const effect4 = show4Piece ? l(set, 'effect_4_4', lang) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {set.set_icon && (
          <div className="relative h-8 w-8 shrink-0">
            <Image
              src={`/images/ui/effect/${set.set_icon}.webp`}
              alt=""
              fill
              sizes="32px"
              className="object-contain"
            />
          </div>
        )}
        <span className="text-sm font-bold text-equipment">{name}</span>
      </div>

      <div className="rounded bg-zinc-800 px-2 py-1 text-xs">
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

      <EquipmentSource source={set.source} boss={set.boss} equipName={set.name} bossMap={bossMap} lang={lang} />
    </div>
  );
}

function SetPieceIcons({ set, slots }: { set: ArmorSet; slots: readonly string[] }) {
  const prefix = set.image_prefix || '06';
  return (
    <>
      {slots.map((slot) => (
        <EquipmentIcon
          key={slot}
          src={`equipment/TI_Equipment_${slot}_${prefix}`}
          rarity={set.rarity}
          alt={slot}
          effectIcon={set.set_icon}
        />
      ))}
    </>
  );
}

export default function SetMiniCard({ combo, sets, lang, bossMap }: Props) {
  const { t } = useI18n();
  const is4Piece = combo.length === 1 && combo[0].count === 4;

  if (is4Piece) {
    const data = findSet(sets, combo[0].name);
    if (!data) return <p className="text-sm text-zinc-400">{combo[0].name}</p>;

    return (
      <InlineTooltip content={<SetPieceTooltip set={data} lang={lang} show4Piece bossMap={bossMap} t={t} />}>
        <div className="inline-flex cursor-default flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            <SetPieceIcons set={data} slots={SLOTS_4} />
          </div>
          <p className="text-xs text-zinc-400">{l(data, 'name', lang)}</p>
        </div>
      </InlineTooltip>
    );
  }

  // 2x2 piece — first set gets Helmet+Armor, second gets Gloves+Shoes
  return (
    <div className="flex items-start gap-3">
      {combo.map((piece, i) => {
        const data = findSet(sets, piece.name);
        const slots = i === 0 ? SLOTS_FIRST : SLOTS_SECOND;

        if (!data) return <p key={piece.name} className="text-sm text-zinc-400">{piece.name}</p>;

        return (
          <InlineTooltip key={piece.name} content={<SetPieceTooltip set={data} lang={lang} show4Piece={false} bossMap={bossMap} t={t} />}>
            <div className="inline-flex cursor-default flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <SetPieceIcons set={data} slots={slots} />
              </div>
              <p className="text-xs text-zinc-400">{l(data, 'name', lang)}</p>
            </div>
          </InlineTooltip>
        );
      })}
    </div>
  );
}
