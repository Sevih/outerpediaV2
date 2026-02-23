'use client';

import { useState } from 'react';
import BossCompactDisplay from '@/app/components/guides/BossCompactDisplay';
import MinionsCompactDisplay from '@/app/components/guides/MinionsCompactDisplay';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import TowerRestrictionTabs from './TowerRestrictionTabs';
import parseText from '@/lib/parse-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { TowerPoolEntry, TowerRestrictionMap, TowerRestrictionSet } from '@/types/tower';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

type Props = {
  entry: TowerPoolEntry;
  bossMap: Record<string, Boss>;
  restrictionMap: TowerRestrictionMap;
  defaultSet?: number;
  onSetChange?: (set: number) => void;
};

/* ── Restrictions list (bullet points) ── */

function RestrictionsList({ set, restrictionMap, lang }: {
  set: TowerRestrictionSet;
  restrictionMap: TowerRestrictionMap;
  lang: Lang;
}) {
  const { t } = useI18n();
  const resolved = (set.restrictions ?? [])
    .map(id => restrictionMap[id])
    .filter((r): r is LangMap => r != null);

  return (
    <div className="space-y-3">
      {resolved.length > 0 ? (
        <ul className="space-y-1">
          {resolved.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              {lRec(r, lang)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-zinc-500">{t('tower.no_restrictions')}</p>
      )}

      <div>
        <h4 className="mb-3">{t('tower.recommended')}</h4>
        {set.recommended && set.recommended.some(e => e.names.length > 0) ? (
          <RecommendedCharacterList
            title={false}
            entries={set.recommended}
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

export default function TowerPoolBossDetail({ entry, bossMap, restrictionMap, defaultSet, onSetChange }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;
  const [activeSet, setActiveSet] = useState(String(defaultSet ?? 0));

  function handleSetChange(value: string) {
    setActiveSet(value);
    onSetChange?.(Number(value));
  }

  const boss = bossMap[entry.boss_id] ?? null;
  const minions = (entry.minions ?? []).map(id => bossMap[id]).filter((b): b is Boss => b != null);

  if (!boss) {
    return (
      <div className="card p-4">
        <div className="py-4 text-center text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  const hasSingleSet = entry.restrictionSets.length <= 1;

  return (
    <div className="card p-4">
      <div className="space-y-4">
        {/* Main Boss */}
        <div>
          <h3 className="mb-3">{t('tower.main_boss')}</h3>
          <BossCompactDisplay boss={boss} />
        </div>

        {/* Minions */}
        {minions.length > 0 && (
          <div>
            <h3 className="mb-3">{t('tower.minions')}</h3>
            <MinionsCompactDisplay minions={minions} />
          </div>
        )}

        {/* Advice */}
        {entry.reason && entry.reason.length > 0 && (
          <div>
            <h3 className="mb-3">{t('tower.advice')}</h3>
            {entry.reason.map((r, i) => {
              const text = lRec(r, lang);
              return text ? <p key={i} className="text-sm leading-relaxed text-zinc-300">{parseText(text)}</p> : null;
            })}
          </div>
        )}

        {/* Restrictions */}
        <div>
          <h3 className="mb-3">{t('tower.restrictions')}</h3>

          {entry.restrictionSets.length === 0 ? (
            <p className="text-sm italic text-zinc-500">{t('tower.no_restrictions')}</p>
          ) : hasSingleSet ? (
            <RestrictionsList
              set={entry.restrictionSets[0]}
              restrictionMap={restrictionMap}
              lang={lang}
            />
          ) : (
            <>
              <TowerRestrictionTabs
                restrictionSets={entry.restrictionSets.map(s => s.restrictions)}
                value={activeSet}
                onChange={handleSetChange}
                className="mb-4"
              />
              <RestrictionsList
                set={entry.restrictionSets[Number(activeSet)] ?? entry.restrictionSets[0]}
                restrictionMap={restrictionMap}
                lang={lang}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
