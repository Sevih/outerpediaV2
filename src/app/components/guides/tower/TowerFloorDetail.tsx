'use client';

import { useState } from 'react';
import Tabs from '@/app/components/ui/Tabs';
import BossCompactDisplay from '@/app/components/guides/BossCompactDisplay';
import MinionsCompactDisplay from '@/app/components/guides/MinionsCompactDisplay';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import RestrictionIcons from './RestrictionIcons';
import parseText from '@/lib/parse-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { isRandomFloor } from '@/types/tower';
import type { TowerFloor, TowerRestrictionMap, TowerCharacterRecommendation } from '@/types/tower';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

/* ── Resolve restriction IDs to LangMap objects ── */

function resolveRestrictions(ids: string[] | undefined, restrictionMap: TowerRestrictionMap): LangMap[] {
  if (!ids || ids.length === 0) return [];
  return ids
    .map(id => restrictionMap[id])
    .filter((r): r is LangMap => r != null);
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

/* ── Floor content with boss + minions + restrictions + recommended ── */

function FloorContent({ boss, minions, restrictions, recommended, reason, lang }: {
  boss: Boss | null;
  minions: Boss[];
  restrictions: LangMap[];
  recommended?: TowerCharacterRecommendation[];
  reason?: string;
  lang: Lang;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {boss ? (
        <BossCompactDisplay boss={boss} />
      ) : (
        <div className="py-4 text-center text-sm text-zinc-500">Loading...</div>
      )}

      {minions.length > 0 && (
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
            {t('tower.minions')}
          </h5>
          <MinionsCompactDisplay minions={minions} />
        </div>
      )}

      <div>
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
          {t('tower.restrictions')}
        </h5>
        <RestrictionsList restrictions={restrictions} lang={lang} />
      </div>

      {reason && (
        <p className="text-sm leading-relaxed text-zinc-300">{parseText(reason)}</p>
      )}

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
        <FloorContent boss={boss} minions={minions} restrictions={restrictions} recommended={floor.recommended} reason={floor.reason ? lRec(floor.reason, lang) : undefined} lang={lang} />
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
        reason={currentSet.reason ? lRec(currentSet.reason, lang) : undefined}
        lang={lang}
      />
    </div>
  );
}
