'use client';

import Image from 'next/image';
import { STAR_ICONS } from '@/lib/stars';
import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

type RewardEntry = {
  stars: 1 | 2 | 3;
  wildcard: number;
  heroPiece: number;
  note?: string;
};

type Props = {
  rewards: RewardEntry[];
  title?: string;
};

const LABELS = {
  title: { en: 'Duplicates give', jp: '重複時の獲得', kr: '중복 획득 시', zh: '重复获得时' } satisfies LangMap,
  rarity: { en: 'Rarity', jp: 'レアリティ', kr: '희귀도', zh: '星级' } satisfies LangMap,
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

export default function BannerRewards({ rewards, title }: Props) {
  const { lang } = useI18n();
  const displayTitle = title || lRec(LABELS.title, lang);

  return (
    <div className="mx-auto max-w-xl space-y-2">
      <p className="text-sm font-semibold text-gray-200">{displayTitle}:</p>
      <div className="overflow-hidden rounded-lg border border-neutral-700/50 bg-neutral-800/30">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800/70">
            <tr className="border-b border-neutral-700/50">
              <th className="px-3 py-2 text-left font-semibold text-gray-300">
                {lRec(LABELS.rarity, lang)}
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-300">
                <ItemInline name="Wildcard Pieces" />
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-300">
                <ItemInline name="Hero Piece" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((reward, idx) => (
              <tr
                key={idx}
                className={idx !== rewards.length - 1 ? 'border-b border-neutral-700/30' : ''}
              >
                <td className="px-3 py-2.5 text-gray-200">
                  {reward.stars}
                  {star}
                </td>
                <td className="px-3 py-2.5 text-gray-200">{reward.wildcard}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-200">{reward.heroPiece}</span>
                    {reward.note && (
                      <span className="text-xs text-gray-400">{reward.note}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
