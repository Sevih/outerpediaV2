'use client';

import Image from 'next/image';
import type { ArmorSet } from '@/types/equipment';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';

type Props = {
  set: ArmorSet;
  lang: Lang;
};

export default function SetCard({ set, lang }: Props) {
  const name = l(set, 'name', lang);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        {set.set_icon && (
          <div className="relative h-12 w-12 shrink-0">
            <Image
              src={`/images/ui/effect/${set.set_icon}.webp`}
              alt={name}
              fill
              sizes="48px"
              className="object-contain"
            />
          </div>
        )}
        <div>
          <p className="font-bold text-equipment">{name}</p>
          {/* TODO: 2-piece effect, 4-piece effect, class restriction, source */}
        </div>
      </div>
    </div>
  );
}
