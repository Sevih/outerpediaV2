'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import GeasIcon from './GeasIcon';
import { formatRatio } from './geas-helpers';
import type { Lang } from '@/lib/i18n/config';
import type { GeasUnlock, GeasPool } from '@/types/guild-raid';

type Props = {
  geas: Record<string, GeasUnlock>;
  pool: GeasPool;
};

function GeasSlot({ id, pool, isMalus, lang }: { id: string; pool: GeasPool; isMalus: boolean; lang: Lang }) {
  const g = pool[id];
  if (!g) return null;

  return (
    <div className="flex items-center gap-2">
      <GeasIcon
        iconName={g.IconName}
        level={g.level}
        variant={isMalus ? 'debuff' : 'buff'}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-tight text-zinc-400">{lRec(g.text, lang)}</p>
      </div>
      <span
        className={[
          'shrink-0 text-[11px] font-bold',
          parseFloat(g.ratio) > 0 ? 'text-emerald-400' : 'text-red-400',
        ].join(' ')}
      >
        {formatRatio(g.ratio)}
      </span>
    </div>
  );
}

export default function GeasUnlockList({ geas, pool }: Props) {
  const { lang, t } = useI18n();

  const kills = useMemo(
    () => Object.keys(geas).sort((a, b) => Number(a) - Number(b)),
    [geas],
  );

  return (
    <div className="space-y-2">
      <h5 className="after:hidden">{t('guildraid.geas')}</h5>

      <div className="space-y-1.5">
        {kills.map((kill) => {
          const { bonus, malus } = geas[kill];
          return (
            <div key={kill} className="flex items-start gap-2">
              {/* Kill badge */}
              <div className="relative mt-1.5 h-7 w-7 shrink-0">
                <Image
                  src="/images/ui/geas/CM_Facility_Frame.webp"
                  alt=""
                  fill
                  sizes="28px"
                  className="object-contain"
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {kill}
                </span>
              </div>

              {/* Geas pair stacked */}
              <div className="min-w-0 flex-1 space-y-1">
                <GeasSlot id={String(bonus)} pool={pool} isMalus={false} lang={lang} />
                <GeasSlot id={String(malus)} pool={pool} isMalus={true} lang={lang} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
