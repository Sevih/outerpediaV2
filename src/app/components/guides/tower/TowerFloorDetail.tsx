'use client';

import { useState } from 'react';
import Image from 'next/image';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import Tabs from '@/app/components/ui/Tabs';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import RestrictionIcons from './RestrictionIcons';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { isRandomFloor } from '@/types/tower';
import type { TowerFloor, TowerRestrictionMap, TowerCharacterRecommendation } from '@/types/tower';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

/* ── Resolve restriction IDs to LangMap objects ── */

function resolveRestrictions(ids: string[], restrictionMap: TowerRestrictionMap): LangMap[] {
  return ids
    .map(id => restrictionMap[id])
    .filter((r): r is LangMap => r != null);
}

/* ── Boss card (renders from Boss data) ── */

function BossCard({ boss, lang }: { boss: Boss; lang: Lang }) {
  const baseName = lRec(boss.Name, lang);
  const surname = lRec(boss.Surname as LangMap, lang);
  const displayName = boss.IncludeSurname && surname ? `${surname} ${baseName}` : baseName;
  const isCharIcon = boss.icons.startsWith('2');

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
        <Image
          src={isCharIcon
            ? `/images/characters/portrait/CT_${boss.icons}.webp`
            : `/images/characters/boss/portrait/MT_${boss.icons}.webp`
          }
          alt={displayName}
          fill
          sizes="64px"
          className="object-cover"
        />
      </div>
      <div>
        {!boss.IncludeSurname && surname && (
          <p className="text-xs text-zinc-400">{surname}</p>
        )}
        <p className="text-lg font-bold text-zinc-100">{displayName}</p>
        <div className="mt-1 flex items-center gap-2">
          <ElementInline element={boss.element} />
          <ClassInline name={boss.class} />
          <span className="text-xs text-zinc-500">Lv.{boss.level}</span>
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

/* ── Minion row (compact boss display) ── */

function MinionRow({ boss, lang }: { boss: Boss; lang: Lang }) {
  const name = lRec(boss.Name, lang);
  const isCharIcon = boss.icons.startsWith('2');

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-white/10">
        <Image
          src={isCharIcon
            ? `/images/characters/portrait/CT_${boss.icons}.webp`
            : `/images/characters/boss/portrait/MT_${boss.icons}.webp`
          }
          alt={name}
          fill
          sizes="32px"
          className="object-cover"
        />
      </div>
      <span className="text-sm text-zinc-300">{name}</span>
      <ElementInline element={boss.element} />
      <ClassInline name={boss.class} />
      <span className="text-xs text-zinc-500">Lv.{boss.level}</span>
    </div>
  );
}

/* ── Floor content with boss + minions + restrictions + recommended ── */

function FloorContent({ boss, minions, restrictions, recommended, lang }: {
  boss: Boss | null;
  minions: Boss[];
  restrictions: LangMap[];
  recommended?: TowerCharacterRecommendation[];
  lang: Lang;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {boss ? (
        <BossCard boss={boss} lang={lang} />
      ) : (
        <div className="py-4 text-center text-sm text-zinc-500">Loading...</div>
      )}

      {minions.length > 0 && (
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
            {t('tower.minions')}
          </h5>
          <div className="space-y-2">
            {minions.map(m => (
              <MinionRow key={m.icons} boss={m} lang={lang} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
          {t('tower.restrictions')}
        </h5>
        <RestrictionsList restrictions={restrictions} lang={lang} />
      </div>

      {recommended && recommended.length > 0 && (
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
            {t('tower.recommended')}
          </h5>
          <RecommendedCharacterList
            title={false}
            entries={recommended}
            idMode
          />
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */

type Props = {
  floor: TowerFloor;
  bossMap: Record<string, Boss>;
  restrictionMap: TowerRestrictionMap;
  defaultSet?: number;
};

export default function TowerFloorDetail({ floor, bossMap, restrictionMap, defaultSet }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;
  const [activeSet, setActiveSet] = useState(String(defaultSet ?? 0));

  if (!isRandomFloor(floor)) {
    const boss = bossMap[floor.boss_id] ?? null;
    const minions = (floor.minions ?? []).map(id => bossMap[id]).filter((b): b is Boss => b != null);
    const restrictions = resolveRestrictions(floor.restrictions, restrictionMap);
    return (
      <div className="card p-4">
        <h4 className="mb-4 after:hidden">
          {t('tower.floor').replace('{n}', String(floor.floor))}
        </h4>
        <FloorContent boss={boss} minions={minions} restrictions={restrictions} recommended={floor.recommended} lang={lang} />
      </div>
    );
  }

  // Random floor
  const setItems = floor.sets.map((_, i) => String(i));
  const setLabels = floor.sets.map(set => (
    <RestrictionIcons restrictions={set.restrictions} />
  ));
  const activeIndex = Number(activeSet);
  const currentSet = floor.sets[activeIndex] ?? floor.sets[0];
  const boss = bossMap[currentSet.boss_id] ?? null;
  const minions = (currentSet.minions ?? []).map(id => bossMap[id]).filter((b): b is Boss => b != null);
  const restrictions = resolveRestrictions(currentSet.restrictions, restrictionMap);

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

      <FloorContent
        boss={boss}
        minions={minions}
        restrictions={restrictions}
        recommended={currentSet.recommended}
        lang={lang}
      />
    </div>
  );
}
