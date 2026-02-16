'use client';

import Image from 'next/image';
import Link from 'next/link';
import charIndex from '@data/generated/characters-index.json';
import nameToId from '@data/generated/characters-name-to-id.json';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { ELEMENT_TEXT } from '@/lib/theme';
import type { CharacterIndex } from '@/types/character';
import type { ElementType } from '@/types/enums';
import InlineTooltip from './InlineTooltip';

const characters = charIndex as Record<string, CharacterIndex>;
const nameMap = nameToId as Record<string, string>;

type Props = { name: string };

export default function CharacterInline({ name }: Props) {
  const { lang } = useI18n();

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
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded">
        <Image
          src={`/images/characters/portrait/CT_${charId}.webp`}
          alt={displayName}
          fill
          sizes="72px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-white">{displayName}</span>
        <span className="text-xs text-neutral-300">
          {'★'.repeat(char.Rarity as number)}
        </span>
        <div className="flex items-center gap-1">
          <span className="relative h-4 w-4">
            <Image
              src={`/images/ui/elem/${char.Element.toLowerCase()}.webp`}
              alt=""
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
              src={`/images/ui/class/${char.Class.toLowerCase()}.webp`}
              alt=""
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
