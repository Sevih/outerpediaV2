'use client';

import { useState } from 'react';
import Image from 'next/image';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import Tabs from '@/app/components/ui/Tabs';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { isRandomFloor } from '@/types/tower';
import type { TowerFloor, TowerBossInfo } from '@/types/tower';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

/* ── Boss card (shared between fixed and random renders) ── */

function BossCard({ boss, lang }: { boss: TowerBossInfo; lang: Lang }) {
  const name = lRec(boss.name, lang);
  const isCharIcon = boss.icons.startsWith('2');

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
        <Image
          src={isCharIcon
            ? `/images/characters/portrait/CT_${boss.icons}.webp`
            : `/images/characters/boss/portrait/MT_${boss.icons}.webp`
          }
          alt={name}
          fill
          sizes="64px"
          className="object-cover"
        />
      </div>
      <div>
        <p className="text-lg font-bold text-zinc-100">{name}</p>
        <div className="mt-1 flex items-center gap-2">
          <ElementInline element={boss.element} />
          <ClassInline name={boss.class} />
        </div>
      </div>
    </div>
  );
}

/* ── Restrictions list ── */

function RestrictionsList({ restrictions, lang }: { restrictions: LangMap[]; lang: Lang }) {
  const { t } = useI18n();

  if (restrictions.length === 0) {
    return (
      <p className="text-sm italic text-zinc-500">{t('tower.no_restrictions')}</p>
    );
  }

  return (
    <ul className="space-y-1">
      {restrictions.map((r, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
          {lRec(r, lang)}
        </li>
      ))}
    </ul>
  );
}

/* ── Fixed floor detail ── */

function FixedFloorContent({ boss, restrictions, lang }: {
  boss: TowerBossInfo;
  restrictions: LangMap[];
  lang: Lang;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <BossCard boss={boss} lang={lang} />
      <div>
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
          {t('tower.restrictions')}
        </h5>
        <RestrictionsList restrictions={restrictions} lang={lang} />
      </div>
    </div>
  );
}

/* ── Main component ── */

type Props = {
  floor: TowerFloor;
};

export default function TowerFloorDetail({ floor }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;
  const [activeSet, setActiveSet] = useState('0');

  if (!isRandomFloor(floor)) {
    return (
      <div className="card p-4">
        <h4 className="mb-4 after:hidden">
          {t('tower.floor').replace('{n}', String(floor.floor))}
        </h4>
        <FixedFloorContent boss={floor.boss} restrictions={floor.restrictions} lang={lang} />
      </div>
    );
  }

  // Random floor
  const setItems = floor.sets.map((_, i) => String(i));
  const setLabels = floor.sets.map((_, i) => t('tower.set').replace('{n}', String(i + 1)));
  const activeIndex = Number(activeSet);
  const currentSet = floor.sets[activeIndex] ?? floor.sets[0];

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center gap-3">
        <h4 className="after:hidden">
          {t('tower.floor').replace('{n}', String(floor.floor))}
        </h4>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
          {t('tower.random_floor')}
        </span>
      </div>

      <p className="mb-3 text-sm text-zinc-400">
        {t('tower.random_sets').replace('{n}', String(floor.sets.length))}
      </p>

      <Tabs
        items={setItems}
        labels={setLabels}
        value={activeSet}
        onChange={setActiveSet}
        className="mb-4"
      />

      <FixedFloorContent
        boss={currentSet.boss}
        restrictions={currentSet.restrictions}
        lang={lang}
      />
    </div>
  );
}
