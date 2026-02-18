'use client';

import Image from 'next/image';
import eeData from '@data/equipment/ee.json';
import charIndex from '@data/generated/characters-index.json';
import nameToId from '@data/generated/characters-name-to-id.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import type { ExclusiveEquipment } from '@/types/equipment';
import type { CharacterIndex } from '@/types/character';
import InlineTooltip from './InlineTooltip';
import { EquipmentBadge } from './WeaponInline';

const ees = eeData as Record<string, ExclusiveEquipment>;
const characters = charIndex as Record<string, CharacterIndex>;
const nameMap = nameToId as Record<string, string>;

type Props = { name: string };

export default function EeInline({ name }: Props) {
  const { lang } = useI18n();

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
        <Image src="/images/items/TI_Slot_Unique.webp" alt="" fill sizes="40px" className="object-contain" />
        <Image src={`/images/characters/ee/${charId}.webp`} alt="" fill sizes="40px" className="object-contain" />
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
          bg="/images/items/TI_Slot_Unique.webp"
          label={eeName}
          color="text-debuff"
        />
      </button>
    </InlineTooltip>
  );
}
