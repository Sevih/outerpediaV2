'use client';

import { use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { charIndexPromise, nameToIdPromise } from '@/lib/data/characters-client';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { ELEMENT_TEXT } from '@/lib/theme';
import type { ElementType } from '@/types/enums';
import CharacterPortrait from '../character/CharacterPortrait';
import InlineTooltip from './InlineTooltip';

type Props = { name: string };

export default function CharacterInline({ name }: Props) {
  const { lang } = useI18n();
  const characters = use(charIndexPromise);
  const nameMap = use(nameToIdPromise);

  const charId = nameMap[name];
  if (!charId) {
    return <span className="text-red-500">{name}</span>;
  }

  const char = characters[charId];
  if (!char) {
    return <span className="text-red-500">{name}</span>;
  }

  const displayName = l(char, 'Fullname', lang);
  const slug = char.slug;

  const tooltip = (
    <div className="flex gap-2">
      <CharacterPortrait id={charId} name={displayName} size="md" className="shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-white">{displayName}</span>
        <span className="text-xs text-neutral-300">
          {'★'.repeat(char.Rarity as number)}
        </span>
        <div className="flex items-center gap-1">
          <span className="relative h-4 w-4">
            <Image
              src={`/images/ui/elem/CM_Element_${char.Element}.webp`}
              alt={char.Element}
              fill
              sizes="16px"
              className="object-contain"
            />
          </span>
          <span className={`text-xs ${ELEMENT_TEXT[char.Element as ElementType]}`}>
            {char.Element}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="relative h-4 w-4">
            <Image
              src={`/images/ui/class/CM_Class_${char.Class}.webp`}
              alt={char.Class}
              fill
              sizes="16px"
              className="object-contain"
            />
          </span>
          <span className="text-xs text-class">{char.Class}</span>
        </div>
      </div>
    </div>
  );

  return (
    <InlineTooltip content={tooltip}>
      <Link
        href={`/characters/${slug}` as never}
        className="text-buff underline hover:text-sky-300"
      >
        {displayName}
      </Link>
    </InlineTooltip>
  );
}
