'use client';

import Image from 'next/image';
import type { ArmorSet, RecoSetEntry } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';

type Props = {
  combo: RecoSetEntry[];
  sets: ArmorSet[];
  lang: Lang;
};

function findSet(sets: ArmorSet[], name: string): ArmorSet | undefined {
  return sets.find((s) => s.name === name || s.name === `${name} Set`);
}

export default function SetMiniCard({ combo, sets, lang }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {combo.map((piece) => {
        const data = findSet(sets, piece.name);
        return (
          <span key={piece.name} className="inline-flex items-center gap-1 text-sm">
            {data?.set_icon && (
              <div className="relative h-6 w-6 shrink-0">
                <Image
                  src={`/images/ui/effect/${data.set_icon}.webp`}
                  alt={piece.name}
                  fill
                  sizes="24px"
                  className="object-contain"
                />
              </div>
            )}
            <span className="text-zinc-200">
              {data ? l(data, 'name', lang) : piece.name}
            </span>
            <span className="text-xs text-zinc-500">x{piece.count}</span>
          </span>
        );
      })}
    </div>
  );
}
