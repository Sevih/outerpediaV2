'use client';

import Image from 'next/image';
import { STAR_ICONS } from '@/lib/stars';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

type RateEntry = {
  stars: 1 | 2 | 3;
  rate: number;
  label?: string;
  subtext?: string;
};

type Props = {
  rates: RateEntry[];
  specialFeature?: string;
  freePull?: boolean;
};

const LABELS = {
  specialFeature: { en: 'Special feature:', jp: '特徴:', kr: '특징:', zh: '特点：' } satisfies LangMap,
  freePull: { en: '1 free pull per day', jp: '1日1回無料募集', kr: '1일 1회 무료 모집', zh: '每日1次免费招募' } satisfies LangMap,
  focus: { en: 'focus', jp: 'ピックアップ', kr: '픽업', zh: 'UP' } satisfies LangMap,
  'non-focus': { en: 'non-focus', jp: '非ピックアップ', kr: '비픽업', zh: '非UP' } satisfies LangMap,
};

const star = (
  <span className="relative align-middle inline-flex size-3.5">
    <Image
      src={STAR_ICONS.y}
      alt="star"
      width={15}
      height={15}
      style={{ width: 15, height: 15 }}
      className="object-contain"
    />
  </span>
);

export default function BannerRates({ rates, specialFeature, freePull }: Props) {
  const { lang } = useI18n();

  return (
    <div className="space-y-3 max-w-xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {rates.map((entry, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-neutral-700/50 bg-neutral-800/50 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-300">
                  {entry.stars}
                  {star}
                </span>
                {entry.label && (
                  <span className="text-xs text-gray-400">
                    {lRec(LABELS[entry.label as keyof typeof LABELS], lang) ?? entry.label}
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-yellow-400">
                {entry.rate}%
              </span>
            </div>
            {entry.subtext && (
              <p className="mt-1 text-xs text-gray-400">{entry.subtext}</p>
            )}
          </div>
        ))}
      </div>

      {(specialFeature || freePull) && (
        <div className="mt-3 flex flex-col gap-2">
          {specialFeature && (
            <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-2.5">
              <p className="text-sm text-yellow-200">
                <span className="font-semibold">{lRec(LABELS.specialFeature, lang)}</span>{' '}
                {specialFeature}
              </p>
            </div>
          )}
          {freePull && (
            <div className="rounded-lg border border-green-700/50 bg-green-900/20 p-2.5">
              <p className="text-sm text-green-200">
                <span className="font-semibold">{lRec(LABELS.freePull, lang)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
