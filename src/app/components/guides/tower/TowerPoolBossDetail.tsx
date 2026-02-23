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
import type { TowerPoolEntry, TowerRestrictionMap, TowerRestrictionSet } from '@/types/tower';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

type Props = {
  entry: TowerPoolEntry;
  bossMap: Record<string, Boss>;
  restrictionMap: TowerRestrictionMap;
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

      {set.recommended && set.recommended.length > 0 && (
        <RecommendedCharacterList
          title={false}
          entries={set.recommended}
          idMode
        />
      )}
    </div>
  );
}

/* ── Main component ── */

export default function TowerPoolBossDetail({ entry, bossMap, restrictionMap }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;
  const [activeSet, setActiveSet] = useState('0');

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
        {/* Boss header */}
        <BossCompactDisplay boss={boss} />

        {/* Minions */}
        {minions.length > 0 && (
          <div>
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
              {t('tower.minions')}
            </h5>
            <MinionsCompactDisplay minions={minions} />
          </div>
        )}

        {/* Reason */}
        {entry.reason && lRec(entry.reason, lang) && (
          <p className="text-sm leading-relaxed text-zinc-300">{parseText(lRec(entry.reason, lang))}</p>
        )}

        {/* Restrictions + Recommended */}
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
            {t('tower.restrictions')}
          </h5>

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
              <Tabs
                items={entry.restrictionSets.map((_, i) => String(i))}
                labels={entry.restrictionSets.map(set => (
                  <RestrictionIcons restrictions={set.restrictions} />
                ))}
                value={activeSet}
                onChange={setActiveSet}
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
