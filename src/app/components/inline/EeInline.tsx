'use client';

import { use } from 'react';
import Image from 'next/image';
import { charIndexPromise, nameToIdPromise } from '@/lib/data/characters-client';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText, getRarityBgPath } from '@/lib/format-text';
import type { ExclusiveEquipment } from '@/types/equipment';
import InlineTooltip from './InlineTooltip';
import { EquipmentBadge } from './WeaponInline';

const eePromise = import('@data/equipment/ee.json').then(m => m.default as Record<string, ExclusiveEquipment>);

type Props = { name: string };

export default function EeInline({ name }: Props) {
  const { lang } = useI18n();
  const nameMap = use(nameToIdPromise);
  const characters = use(charIndexPromise);
  const ees = use(eePromise);

  // name can be a character name - find the EE by character ID
  const charId = nameMap[name];
  if (!charId) {
    return <span className="text-red-500">{name}</span>;
  }

  const ee = ees[charId];
  if (!ee) {
    return <span className="text-red-500">{name}</span>;
  }

  const char = characters[charId];
  const charName = char ? l(char, 'Fullname', lang) : name;
  const eeName = l(ee, 'name', lang);
  const effect = l(ee, 'effect', lang);
  const effect10 = l(ee, 'effect10', lang);
  const tooltip = (
    <div className="flex gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <Image src={getRarityBgPath('legendary')} alt="Legendary rarity" fill sizes="40px" className="object-contain" />
        <Image src={`/images/characters/ee/${charId}.webp`} alt={eeName} fill sizes="40px" className="object-contain" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-debuff">{eeName}</span>
        <span className="text-xs text-neutral-400">EE for {charName}</span>
        {effect && <p className="text-xs text-neutral-200">{formatEffectText(effect)}</p>}
        {effect10 && <p className="text-xs italic text-equipment">{formatEffectText(effect10)}</p>}
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <button type="button" className="cursor-default">
        <EquipmentBadge
          icon={`/images/characters/ee/${charId}.webp`}
          bg={getRarityBgPath('legendary')}
          label={eeName}
          color="text-debuff"
        />
      </button>
    </InlineTooltip>
  );
}
