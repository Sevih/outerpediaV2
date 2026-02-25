'use client';

import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

type Props = {
  mileageItem: string;
  cost: number;
  isPersistent?: boolean;
};

const LABELS = {
  keptUntilUse: { en: 'is kept until you decide to use it.', jp: 'は使用するまで保持されます。', kr: '는 사용할 때까지 유지됩니다.', zh: '会保留直到使用。' } satisfies LangMap,
  exchangeOptions: { en: 'Exchange options:', jp: '交換オプション:', kr: '교환 옵션:', zh: '交换选项：' } satisfies LangMap,
  featuredHero: { en: 'Featured hero', jp: 'ピックアップヒーロー', kr: '픽업 영웅', zh: 'PICKUP同伴' } satisfies LangMap,
  ownedBonus: { en: 'If you already own the hero, you get 15 additional', jp: '既に所持している場合は15個追加で獲得できます', kr: '이미 보유 중인 경우 15개가 추가로 지급됩니다', zh: '如已拥有该同伴，额外获得15个' } satisfies LangMap,
};

export default function MileageInfo({ mileageItem, cost, isPersistent = true }: Props) {
  const { lang } = useI18n();

  return (
    <div className="mx-auto max-w-xl space-y-3 rounded-lg border border-blue-700/50 bg-blue-900/20 p-4">
      {isPersistent && (
        <div className="flex items-start gap-2">
          <div className="mt-0.5 text-blue-400">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-blue-200">
            <ItemInline name={mileageItem} /> {lRec(LABELS.keptUntilUse, lang)}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-neutral-700/50 bg-neutral-800/50 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-200">{lRec(LABELS.exchangeOptions, lang)}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">{lRec(LABELS.featuredHero, lang)}</span>
            <div className="flex items-center gap-1 font-semibold text-yellow-400">
              {cost} <ItemInline name={mileageItem} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">
              150 <ItemInline name="Hero Piece" />
            </span>
            <div className="flex items-center gap-1 font-semibold text-yellow-400">
              {cost} <ItemInline name={mileageItem} />
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-neutral-700/30 pt-3">
          <p className="text-xs text-gray-400">
            {lRec(LABELS.ownedBonus, lang)}{' '}
            <ItemInline name="Wildcard Pieces" />
          </p>
        </div>
      </div>
    </div>
  );
}
