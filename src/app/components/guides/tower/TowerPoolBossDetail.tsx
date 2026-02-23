'use client';

import Image from 'next/image';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
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

/* ── Recommended character portraits ── */

function RecommendedRow({ charIds }: { charIds: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {charIds.map(id => (
        <div key={id} className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-white/10">
          <Image
            src={`/images/characters/portrait/CT_${id}.webp`}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

/* ── Single restriction set (restrictions + recommended) ── */

function RestrictionSetBlock({ set, restrictionMap, lang, t }: {
  set: TowerRestrictionSet;
  restrictionMap: TowerRestrictionMap;
  lang: Lang;
  t: (key: string) => string;
}) {
  const resolved = set.restrictions
    .map(id => restrictionMap[id])
    .filter((r): r is LangMap => r != null);

  return (
    <div className="space-y-2">
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
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('tower.recommended')}
          </p>
          <RecommendedRow charIds={set.recommended} />
        </div>
      )}
    </div>
  );
}

export default function TowerPoolBossDetail({ entry, bossMap, restrictionMap }: Props) {
  const { lang: rawLang, t } = useI18n();
  const lang = rawLang as Lang;

  const boss = bossMap[entry.boss_id] ?? null;
  const minions = (entry.minions ?? []).map(id => bossMap[id]).filter((b): b is Boss => b != null);

  if (!boss) {
    return (
      <div className="card p-4">
        <div className="py-4 text-center text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  const baseName = lRec(boss.Name, lang);
  const surname = lRec(boss.Surname as LangMap, lang);
  const displayName = boss.IncludeSurname && surname ? `${surname} ${baseName}` : baseName;
  const isCharIcon = boss.icons.startsWith('2');
  const hasSingleSet = entry.restrictionSets.length <= 1;

  return (
    <div className="card p-4">
      <div className="space-y-4">
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

        {minions.length > 0 && (
          <div>
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
              {t('tower.minions')}
            </h5>
            <div className="space-y-2">
              {minions.map(m => {
                const mName = lRec(m.Name, lang);
                const mIsChar = m.icons.startsWith('2');
                return (
                  <div key={m.icons} className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-white/10">
                      <Image
                        src={mIsChar
                          ? `/images/characters/portrait/CT_${m.icons}.webp`
                          : `/images/characters/boss/portrait/MT_${m.icons}.webp`
                        }
                        alt={mName}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    </div>
                    <span className="text-sm text-zinc-300">{mName}</span>
                    <ElementInline element={m.element} />
                    <ClassInline name={m.class} />
                    <span className="text-xs text-zinc-500">Lv.{m.level}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Restrictions + Recommended */}
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
            {t('tower.restrictions')}
          </h5>

          {entry.restrictionSets.length === 0 ? (
            <p className="text-sm italic text-zinc-500">{t('tower.no_restrictions')}</p>
          ) : hasSingleSet ? (
            <RestrictionSetBlock
              set={entry.restrictionSets[0]}
              restrictionMap={restrictionMap}
              lang={lang}
              t={t}
            />
          ) : (
            <div className="space-y-4">
              {entry.restrictionSets.map((set, si) => (
                <div key={si} className="rounded-lg border border-zinc-700/30 bg-zinc-800/30 p-3">
                  <p className="mb-2 text-xs font-medium text-zinc-400">
                    {t('tower.set').replace('{n}', String(si + 1))}
                  </p>
                  <RestrictionSetBlock
                    set={set}
                    restrictionMap={restrictionMap}
                    lang={lang}
                    t={t}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
