'use client';

import { type ReactNode, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import CharacterInline from '@/app/components/inline/CharacterInline';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import type { WithLocalizedFields } from '@/types/common';
import type { ElementType, ClassType } from '@/types/enums';
import type { Lang } from '@/lib/i18n/config';
import { l, lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import { getCharByName } from '@/lib/character-client';

/* ===================== Types ===================== */

interface BaseHeroReview {
  name: string;
  review: string;
  recommended_level: string;
}

export type HeroReview = WithLocalizedFields<BaseHeroReview, 'review'>;

export interface Entry {
  name: string;
  stars: number;
  op: '>' | '>=' | null;
}

type PriorityData = {
  UNLOCK_ORDER_1ST: Entry[];
  UNLOCK_ORDER_2ND: Entry[];
  UNLOCK_ORDER_3RD: Entry[];
};
export const priorityPromise = import('@data/guides/core-fusion-priorities.json').then(m => m.default as PriorityData);

/* ===================== Constants ===================== */

const LEVEL_COSTS = [300, 150, 150, 150, 150];
const CUMULATIVE_COSTS = LEVEL_COSTS.reduce<number[]>((acc, c) => {
  acc.push((acc[acc.length - 1] ?? 0) + c);
  return acc;
}, []);

/* ===================== Localized Labels ===================== */
export const LABELS = {
  intro: {
    en: 'Core Fusion heroes are upgraded versions of existing characters, unlocked through the Core Fusion system. They require the original character at 5★ transcendence and 300 {I-I/Fusion-Type Core} to unlock.\nOnce unlocked, all skills start at Lv1 and can be leveled up together for 150 {I-I/Fusion-Type Core} per level, up to Lv5 (900 total). These units also have a unique Core Fusion Passive that upgrades upon reaching Lv5.\nThis guide covers unlock priorities and reviews for each Core Fusion hero.',
    jp: 'コアフュージョンヒーローは、コアフュージョンシステムで解放できる既存キャラクターの強化版です。解放には元キャラクターの5★超越と{I-I/Fusion-Type Core}300個が必要です。\n解放後、全スキルはLv1から始まり、レベルごとに{I-I/Fusion-Type Core}150個で一括レベルアップ可能（Lv5まで合計900）。これらのユニットはLv5到達時に強化される固有のコアフュージョンパッシブも持っています。\n本ガイドでは解放優先順位と各ヒーローのレビューを紹介します。',
    kr: '코어 퓨전 영웅은 코어 퓨전 시스템을 통해 해금할 수 있는 기존 캐릭터의 강화 버전입니다. 해금에는 원본 캐릭터의 5★ 초월과 {I-I/Fusion-Type Core} 300개가 필요합니다.\n해금 후 모든 스킬은 Lv1에서 시작하며, 레벨당 {I-I/Fusion-Type Core} 150개로 일괄 레벨업 가능합니다 (Lv5까지 총 900). 이 유닛들은 Lv5 도달 시 강화되는 고유 코어 퓨전 패시브도 보유합니다.\n이 가이드에서는 해금 우선순위와 각 영웅의 리뷰를 다룹니다.',
    zh: '核心融合英雄是通过核心融合系统解锁的现有角色强化版。解锁需要原角色达到5★超越并消耗300个{I-I/Fusion-Type Core}。\n解锁后所有技能从Lv1开始，每级消耗150个{I-I/Fusion-Type Core}统一升级，最高Lv5（共计900）。这些单位还拥有在达到Lv5时强化的独特核心融合被动。\n本指南涵盖解锁优先级和每位英雄的评测。',
  },
  unlockPriority: {
    en: 'Unlock Priority',
    jp: '解放優先順位',
    kr: '해금 우선순위',
    zh: '解锁优先级',
  },
  priority1st: {
    en: '1st Priority',
    jp: '第1優先',
    kr: '1순위',
    zh: '第一优先',
  },
  priority2nd: {
    en: '2nd Priority',
    jp: '第2優先',
    kr: '2순위',
    zh: '第二优先',
  },
  priority3rd: {
    en: '3rd Priority',
    jp: '第3優先',
    kr: '3순위',
    zh: '第三优先',
  },
  recommendedLevel: {
    en: 'Recommended Level',
    jp: '推奨レベル',
    kr: '추천 레벨',
    zh: '推荐等级',
  },
  totalCost: {
    en: 'Total cost',
    jp: '合計コスト',
    kr: '총 비용',
    zh: '总花费',
  },
  noEntries: {
    en: 'No Core Fusion entries yet.',
    jp: 'コアフュージョンのエントリはまだありません。',
    kr: '코어 퓨전 항목이 아직 없습니다.',
    zh: '暂无核心融合条目。',
  },
} as const;

/* ===================== UI Components ===================== */

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] uppercase tracking-wide">
      {children}
    </span>
  );
}

/* ===================== CharacterCard (for priority rows) ===================== */

export function CharacterCard({
  name,
  stars,
  isPriority = false,
}: {
  name: string;
  stars: number;
  isPriority?: boolean;
}) {
  const result = getCharByName(name);
  const id = result?.id;
  const char = result?.char;
  const slug = char?.slug;
  const href = slug ? `/characters/${slug}` : '#';

  return (
    <Link href={href as never} prefetch={false} className="relative shrink-0 text-center shadow transition hover:shadow-lg">
      {id ? (
        <CharacterPortrait id={id} size={{ base: 'sm', md: 'md' }} showIcons forceStar={stars} priority={isPriority} />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-neutral-600 bg-neutral-800/50 text-xs text-neutral-400">
          ?
        </div>
      )}
    </Link>
  );
}

/* ===================== PriorityRow ===================== */

const OP_SYMBOLS: Record<string, string> = { '>': '>', '>=': '≥' };

function PriorityRow({ title, entries }: { title: string; entries: Entry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {title && <h4 className="mx-auto text-center">{title}</h4>}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {entries.map((e, i) => (
          <div key={`${e.name}-${i}`} className="flex items-center gap-3">
            {i > 0 && entries[i - 1].op && (
              <span className="text-lg font-bold text-neutral-400">
                {OP_SYMBOLS[entries[i - 1].op!] ?? entries[i - 1].op}
              </span>
            )}
            <CharacterCard name={e.name} stars={e.stars} isPriority={i === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== UnlockPrioritySection ===================== */

export function UnlockPrioritySection({ lang }: { lang: Lang }) {
  const priorityData = use(priorityPromise);

  const tiers = [
    { label: LABELS.priority1st, entries: priorityData.UNLOCK_ORDER_1ST },
    { label: LABELS.priority2nd, entries: priorityData.UNLOCK_ORDER_2ND },
    { label: LABELS.priority3rd, entries: priorityData.UNLOCK_ORDER_3RD },
  ].filter((t) => t.entries.length > 0);

  const showTierLabels = tiers.length > 1;

  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="mx-auto text-center">{lRec(LABELS.unlockPriority, lang)}</h2>

      <div className="space-y-5">
        {tiers.map((t, i) => (
          <PriorityRow key={i} title={showTierLabels ? lRec(t.label, lang) : ''} entries={t.entries} />
        ))}
      </div>
    </section>
  );
}

/* ===================== LevelCostDisplay ===================== */

function LevelCostDisplay({ level, lang }: { level: number; lang: Lang }) {
  const cost = CUMULATIVE_COSTS[level - 1];

  return (
    <div className="flex items-center justify-center gap-6 rounded-md border border-neutral-800 p-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs opacity-70">{lRec(LABELS.recommendedLevel, lang)}</span>
        <span className="text-2xl font-bold text-purple-300">Lv {level}</span>
      </div>
      <div className="h-10 w-px bg-neutral-700" />
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs opacity-70">{lRec(LABELS.totalCost, lang)}</span>
        <div className="flex items-center gap-1.5">
          <Image
            src="/images/items/TI_Item_CoreMerged.webp"
            alt="Fusion-Type Core"
            width={20}
            height={20}
            className="object-contain"
          />
          <span className="text-lg font-semibold">{cost}</span>
        </div>
      </div>
    </div>
  );
}

/* ===================== HeroCard ===================== */

export function HeroCard({ h, lang }: { h: HeroReview; lang: Lang }) {
  const result = getCharByName(h.name);
  const charId = result?.id;
  const char = result?.char;
  const element = char?.Element as ElementType | undefined;
  const cls = char?.Class as ClassType | undefined;
  const name = char ? l(char, 'Fullname', lang) : h.name;

  const recoLevel = parseInt(h.recommended_level, 10);

  return (
    <section className="rounded-md border border-neutral-800 bg-black/30 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-3 text-xl font-semibold">
          {charId && (
            <Image
              src={`/images/characters/atb/IG_Turn_${charId}.webp`}
              alt={name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
              unoptimized
            />
          )}

          <CharacterInline name={h.name} />

          <Image
            src="/images/ui/tags/core-fusion.webp"
            alt="Core Fusion"
            width={60}
            height={60}
            style={{ width: 60, height: 60 }}
            className="object-cover"
            unoptimized
          />
        </h2>

        <div className="flex items-center gap-2 text-xs opacity-80">
          {element && <Badge><ElementInline element={element} /></Badge>}
          {cls && <Badge><ClassInline name={cls} /></Badge>}
        </div>
      </header>

      <p className="mt-3 mb-4 whitespace-pre-line text-sm text-neutral-200">
        {parseText(l(h as unknown as Record<string, unknown>, 'review', lang))}
      </p>

      {!isNaN(recoLevel) && recoLevel >= 1 && recoLevel <= 5 && (
        <LevelCostDisplay level={recoLevel} lang={lang} />
      )}
    </section>
  );
}
