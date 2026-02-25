'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import nameToId from '@data/generated/characters-name-to-id.json';
import charIndex from '@data/generated/characters-index.json';
import type { CharacterIndex } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';

const nameMap = nameToId as Record<string, string>;
const indexMap = charIndex as Record<string, CharacterIndex>;

type Props = {
  order: { character: string; speed: number }[];
  note?: string;
};

export default function TurnOrderDisplay({ order, note }: Props) {
  const { lang } = useI18n();

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center justify-center gap-y-2">
        {order.map((entry, idx) => {
          const charId = nameMap[entry.character];
          const char = charId ? indexMap[charId] : undefined;
          const localizedName = char
            ? (l(char, 'Fullname', lang as Lang) as string)
            : entry.character;
          const atbPath = charId
            ? `/images/characters/atb/IG_Turn_${charId}.webp`
            : '';

          return (
            <div key={entry.character} className="flex items-center">
              {idx > 0 && (
                <span className="mx-2 select-none text-lg text-neutral-500">
                  &gt;
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {charId && (
                  <Link
                    href={`/${lang}/characters/${char?.slug ?? ''}`}
                    className="relative h-8 w-8 shrink-0 overflow-hidden rounded"
                  >
                    <Image
                      src={atbPath}
                      alt={localizedName}
                      fill
                      sizes="32px"
                      className="object-contain"
                    />
                  </Link>
                )}
                <div className="flex flex-col items-start leading-tight">
                  {char ? (
                    <Link
                      href={`/${lang}/characters/${char.slug}`}
                      className="text-sm text-sky-400 underline-offset-2 transition-colors hover:text-sky-300 hover:underline"
                    >
                      {localizedName}
                    </Link>
                  ) : (
                    <span className="text-sm text-red-500">
                      {entry.character}
                    </span>
                  )}
                  <span className="text-xs text-amber-400">
                    {entry.speed} SPD
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {note && (
        <p className="mt-1.5 text-center text-sm text-neutral-400">
          {parseText(note)}
        </p>
      )}
    </div>
  );
}
