'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { Character, CharacterStats, StatsStep } from '@/types/character';
import type { ExclusiveEquipment } from '@/types/equipment';
import { StatInline } from '@/app/components/inline';
import { useI18n } from '@/lib/contexts/I18nContext';

type Props = {
  character: Character;
  stats: CharacterStats | null;
  ee: ExclusiveEquipment | null;
};

const RANKS_PVE = ['S', 'A', 'B', 'C', 'D', 'E'] as const;

function demoteOnce(rank: string): string {
  const i = RANKS_PVE.indexOf(rank as (typeof RANKS_PVE)[number]);
  return RANKS_PVE[Math.min(i < 0 ? RANKS_PVE.length - 1 : i + 1, RANKS_PVE.length - 1)];
}

function evoIcon(stepKey: string): string {
  const evo = stepKey.split('_ev')[1] ?? '0';
  return `/images/ui/evo/CM_Evolution_0${evo}.webp`;
}

function lvFromKey(key: string): string {
  return key.split('_')[0].replace('lv', '');
}

type StatDef = {
  key: keyof StatsStep;
  statName: string;
  isPercent: boolean;
};

const STAT_DEFS: StatDef[] = [
  { key: 'ATK', statName: 'ATK', isPercent: false },
  { key: 'DEF', statName: 'DEF', isPercent: false },
  { key: 'HP', statName: 'HP', isPercent: false },
  { key: 'SPD', statName: 'SPD', isPercent: false },
  { key: 'CHC', statName: 'CHC', isPercent: true },
  { key: 'CHD', statName: 'CHD', isPercent: true },
  { key: 'DMG_INC', statName: 'DMG UP%', isPercent: true },
  { key: 'DMG_RED', statName: 'DMG RED%', isPercent: true },
  { key: 'EFF', statName: 'EFF', isPercent: false },
  { key: 'RES', statName: 'RES', isPercent: false },
];

function formatValue(value: number, isPercent: boolean): string {
  if (isPercent) {
    return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
  }
  return String(Math.round(value));
}

export default function StatsRankingSection({ character, stats, ee }: Props) {
  const { t } = useI18n();

  const stepKeys = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.steps);
  }, [stats]);

  const [stepIdx, setStepIdx] = useState(() => Math.max(0, stepKeys.length - 1));

  const pveRank =
    character.Rarity < 3 ? demoteOnce(character.rank) : character.rank;

  const currentStep = useMemo(() => {
    if (!stats || !stepKeys[stepIdx]) return null;
    return stats.steps[stepKeys[stepIdx]] ?? null;
  }, [stats, stepKeys, stepIdx]);

  const premiumKey = stats?.premium.stat ?? null;
  const premiumIsPercent = stats?.premium.applyingType === 'OAT_ADD';

  // 3-star Striker/Attacker: data has a +1 rounding artifact on ATK & DEF at lv100
  const isStrikerAttacker3 =
    stats?.info.class === 'CCT_ATTACKER' &&
    stats?.info.subclass === 'ATTACKER' &&
    stats?.info.star === '3';
  const isMaxStep = stepIdx === stepKeys.length - 1;

  return (
    <section id="stats-ranking">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.stats_ranking')}</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Base stats */}
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">{t('page.character.stats.title')}</h3>
            {stepKeys[stepIdx] && (
              <span className="text-xs text-zinc-400">Lv.{lvFromKey(stepKeys[stepIdx])}</span>
            )}
          </div>

          {stats && currentStep ? (
            <>
              {/* Stats list */}
              <div className="space-y-2">
                {STAT_DEFS.map(({ key, statName, isPercent }) => {
                  let value = currentStep[key] as number;
                  if (isStrikerAttacker3 && isMaxStep && (key === 'ATK' || key === 'DEF')) {
                    value -= 1;
                  }
                  const isPremium = premiumKey === key;
                  const premiumVal = isPremium ? currentStep.premium_value : 0;

                  return (
                    <div key={key} className="flex items-center justify-between">
                      <StatInline name={statName} />
                      <span className="text-sm font-medium text-zinc-100">
                        {formatValue(value + premiumVal, isPercent)}
                        {premiumVal > 0 && (
                          <span className="ml-1 text-amber-400">
                            (+{formatValue(premiumVal, premiumIsPercent)})
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Step selector */}
              <div className="mt-4 flex justify-between">
                {stepKeys.map((key, idx) => (
                  <button
                    key={key}
                    onClick={() => setStepIdx(idx)}
                    className={`relative h-8 w-8 transition-opacity ${
                      idx === stepIdx
                        ? 'opacity-100'
                        : 'opacity-40 hover:opacity-70'
                    }`}
                  >
                    {idx === stepIdx && (
                      <div className="absolute -inset-2 z-0">
                        <Image
                          src="/images/ui/evo/CM_Evolution_Glow.webp"
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div className="relative z-10 h-full w-full">
                      <Image
                        src={evoIcon(key)}
                        alt={`Evo ${idx}`}
                        fill
                        sizes="32px"
                        className="object-contain"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm italic text-zinc-500">No stats available</p>
          )}
        </div>

        {/* Ranking */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-300">{t('page.character.toc.ranking')}</h3>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {ee && (
              <TierCard label={t('page.character.ee.rank')} rank={ee.rank} />
            )}
            <TierCard label={t('page.character.tier.pve')} rank={pveRank} />
            {character.rank_pvp && (
              <TierCard label={t('page.character.tier.pvp')} rank={character.rank_pvp} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TierCard({ label, rank }: { label: string; rank: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="relative h-12 w-12">
        <Image
          src={`/images/ui/rank/IG_Event_Rank_${rank}.webp`}
          alt={rank}
          fill
          sizes="48px"
          className="object-contain"
        />
      </div>
    </div>
  );
}
