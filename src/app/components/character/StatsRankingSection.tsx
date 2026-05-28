'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { Character, CharacterStats, StatsStep } from '@/types/character';
import type { ExclusiveEquipment } from '@/types/equipment';
import type { Item } from '@/types/item';
import { StatInline } from '@/app/components/inline';
import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { getRarityBgPath } from '@/lib/format-text';
import { ITEM_RARITY_TEXT } from '@/lib/theme';
import { GIFT_LABELS } from '@/types/enums';
import type { GiftType } from '@/types/enums';

type Props = {
  character: Character;
  stats: CharacterStats | null;
  ee: ExclusiveEquipment | null;
  giftItems: Item[];
};

function lvFromKey(key: string): number {
  return parseInt(key.split('_')[0].replace('lv', ''), 10) || 0;
}

type StatDef = {
  key: keyof StatsStep;
  displayKey?: string;
  isPercent: boolean;
};

const STAT_DEFS: StatDef[] = [
  { key: 'ATK', isPercent: false },
  { key: 'DEF', isPercent: false },
  { key: 'HP', isPercent: false },
  { key: 'SPD', isPercent: false },
  { key: 'CHC', isPercent: true },
  { key: 'CHD', isPercent: true },
  { key: 'DMG_INC', displayKey: 'DMG UP%', isPercent: true },
  { key: 'DMG_RED', displayKey: 'DMG RED%', isPercent: true },
  { key: 'EFF', isPercent: false },
  { key: 'RES', isPercent: false },
];

function formatValue(value: number, isPercent: boolean): string {
  if (isPercent) {
    return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
  }
  return String(Math.round(value));
}

export default function StatsRankingSection({ character, stats, ee, giftItems }: Props) {
  const { lang, t } = useI18n();

  const giftLabelKey = GIFT_LABELS[character.gift as GiftType];
  const giftLabel = giftLabelKey
    ? t(`characters.gifts.${giftLabelKey}` as Parameters<typeof t>[0])
    : character.gift;

  const stepKeys = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.steps);
  }, [stats]);

  const [stepIdx, setStepIdx] = useState(() => Math.max(0, stepKeys.length - 1));

  const pveRank = character.rank;

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Base stats */}
        <div className="card rounded-xl p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-game">{t('page.character.stats.title')}</h3>
            {stepKeys[stepIdx] && (
              <span className="text-xs text-zinc-400">Lv.{lvFromKey(stepKeys[stepIdx])}</span>
            )}
          </div>

          {stats && currentStep ? (
            <>
              {/* Stats list */}
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {STAT_DEFS.map(({ key, displayKey, isPercent }) => {
                  let value = currentStep[key] as number;
                  if (isStrikerAttacker3 && isMaxStep && (key === 'ATK' || key === 'DEF')) {
                    value -= 1;
                  }
                  const isPremium = premiumKey === key;
                  const premiumVal = isPremium ? currentStep.premium_value : 0;

                  return (
                    <div key={key} className="flex items-center justify-between border-b border-white/6 py-2">
                      <StatInline name={displayKey ?? key} />
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
              <div className="mt-4 flex flex-wrap justify-between gap-1">
                {stepKeys.map((key, idx) => {
                  const lv = lvFromKey(key);
                  const selected = idx === stepIdx;
                  return (
                    <button
                      key={key}
                      onClick={() => setStepIdx(idx)}
                      className={`flex flex-col items-center gap-0.5 transition-opacity ${
                        selected ? 'opacity-100' : 'opacity-50 hover:opacity-80'
                      }`}
                      aria-label={`Lv.${lv}`}
                    >
                      <div className="relative h-8 w-8">
                        <Image
                          src="/images/ui/evo/CM_Evolution_Tab.webp"
                          alt=""
                          fill
                          sizes="32px"
                          className="object-contain"
                        />
                        {selected && (
                          <Image
                            src="/images/ui/evo/CM_Evolution_Tab_Select.webp"
                            alt=""
                            fill
                            sizes="32px"
                            className="object-contain"
                          />
                        )}
                      </div>
                      <span
                        className={`text-[10px] leading-none ${
                          selected ? 'text-amber-300' : 'text-zinc-400'
                        }`}
                      >
                        Lv.{lv}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Limit Break cost frame */}
              {(() => {
                const lv = lvFromKey(stepKeys[stepIdx] ?? '');
                const lb = stats.limitBreak.find(s => s.maxLevel === lv);
                if (!lb) return null;
                return (
                  <div className="mt-3 flex items-center justify-center gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200">
                    <span className="font-semibold text-zinc-300">{t('page.character.stats.limit_break_cost')}</span>
                    <span className="flex items-center gap-1.5">
                      <ItemInline id={lb.recallItemId} />
                      <span className="text-zinc-100">×{lb.factors}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Image
                        src="/images/items/CM_Goods_Gold.webp"
                        alt="Gold"
                        width={20}
                        height={20}
                        className="object-contain"
                      />
                      <span className="text-zinc-100">{lb.gold.toLocaleString()}</span>
                    </span>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-sm italic text-zinc-500">{t('page.character.stats.no_data')}</p>
          )}
        </div>

        {/* Ranking + Gifts */}
        <div className="flex flex-col gap-6">
          <div className="card rounded-xl p-4">
            <h3 className="mb-4 font-game">{t('page.character.toc.ranking')}</h3>
            <div className="grid grid-cols-2 place-items-center gap-x-6 gap-y-2">
              <TierCard label={t('page.character.tier.pve')} rank={pveRank} placeholder={t('common.coming_soon')} />
              <TierCard label={t('page.character.tier.pvp')} rank={character.rank_pvp ?? null} placeholder={t('common.coming_soon')} />
              {ee && (
                <TierCard label={t('page.character.ee.rank')} rank={ee.rank} placeholder={t('common.coming_soon')} />
              )}
              {ee && (
                <TierCard label={t('page.character.ee.rank10')} rank={ee.rank10} placeholder={t('common.coming_soon')} />
              )}
            </div>
          </div>

          {giftItems.length > 0 && (
            <div className="card rounded-xl p-4">
              <h3 className="mb-0.5 font-game">{t('characters.filters.gifts')}</h3>
              <p className="mb-3 text-sm text-zinc-400">{giftLabel}</p>
              <div className="grid grid-cols-4 gap-2">
                {giftItems.map((item) => (
                  <div key={item.id} className="flex flex-col items-center gap-1">
                    <div className="relative h-12 w-12 shrink-0">
                      <Image
                        src={getRarityBgPath(item.rarity)}
                        alt={`${item.rarity} rarity`}
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                      <Image
                        src={`/images/items/${item.icon}.webp`}
                        alt={l(item, 'name', lang)}
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    </div>
                    <span className={`text-center text-[10px] leading-tight ${ITEM_RARITY_TEXT[item.rarity]}`}>
                      {l(item, 'name', lang)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

function TierCard({ label, rank, placeholder }: { label: string; rank: string | null; placeholder?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2">
      <span className="text-xs text-zinc-400">{label}</span>
      {rank ? (
        <div className="relative h-12 w-12">
          <Image
            src={`/images/ui/rank/IG_Event_Rank_${rank}.webp`}
            alt={rank}
            fill
            sizes="48px"
            className="object-contain"
          />
        </div>
      ) : (
        <span className="flex h-12 items-center text-center text-xs italic text-zinc-500">
          {placeholder ?? '—'}
        </span>
      )}
    </div>
  );
}
