'use client';

import { useState } from 'react';
import BossCompactDisplay from '@/app/components/guides/BossCompactDisplay';
import MinionsCompactDisplay from '@/app/components/guides/MinionsCompactDisplay';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import TowerRestrictionTabs from './TowerRestrictionTabs';
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
  reason?: string[];
  lang: Lang;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-3">{t('tower.main_boss')}</h3>
        {boss ? (
          <BossCompactDisplay boss={boss} iconOnlySkills={false} />
        ) : (
          <div className="py-4 text-center text-sm text-zinc-500">Loading...</div>
        )}
      </div>

      {minions.length > 0 && (
        <div>
          <h3 className="mb-3">{t('tower.minions')}</h3>
          <MinionsCompactDisplay minions={minions} />
        </div>
      )}

      {reason && reason.length > 0 && (
        <div>
          <h3 className="mb-3">{t('tower.advice')}</h3>
          {reason.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-zinc-300">{parseText(line)}</p>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-3">{t('tower.restrictions')}</h3>
        <RestrictionsList restrictions={restrictions} lang={lang} />
      </div>

      <div>
        <h4 className="mb-3">{t('tower.recommended')}</h4>
        {recommended && recommended.some(e => e.names.length > 0) ? (
          <RecommendedCharacterList
            title={false}
            entries={recommended}
            idMode
          />
        ) : (
          <p className="text-sm italic text-zinc-500">{t('tower.no_recommended')}</p>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */

type Props = {
  floor: TowerFloor;
  bossMap: Record<string, Boss>;
  restrictionMap: TowerRestrictionMap;
  defaultSet?: number;
  onSetChange?: (set: number) => void;
};

export default function TowerFloorDetail({ floor, bossMap, restrictionMap, defaultSet, onSetChange }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;
  const [activeSet, setActiveSet] = useState(String(defaultSet ?? 0));

  function handleSetChange(value: string) {
    setActiveSet(value);
    onSetChange?.(Number(value));
  }

  if (!isRandomFloor(floor)) {
    const boss = bossMap[floor.boss_id] ?? null;
    const minions = (floor.minions ?? []).map(id => bossMap[id]).filter((b): b is Boss => b != null);
    const restrictions = resolveRestrictions(floor.restrictions, restrictionMap);
    return (
      <div className="card p-4">
        <h4 className="mb-4 after:hidden">
          {t('tower.floor').replace('{n}', String(floor.floor))}
        </h4>
        <FloorContent boss={boss} minions={minions} restrictions={restrictions} recommended={floor.recommended} reason={floor.reason?.map(r => lRec(r, lang)).filter(Boolean) as string[] | undefined} lang={lang} />
      </div>
    );
  }

  // Random floor
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

      <TowerRestrictionTabs
        restrictionSets={floor.sets.map(s => s.restrictions ?? [])}
        value={activeSet}
        onChange={handleSetChange}
        className="mb-4"
      />

      <FloorContent
        boss={boss}
        minions={minions}
        restrictions={restrictions}
        recommended={currentSet.recommended}
        reason={currentSet.reason?.map(r => lRec(r, lang)).filter(Boolean) as string[] | undefined}
        lang={lang}
      />
    </div>
  );
}
