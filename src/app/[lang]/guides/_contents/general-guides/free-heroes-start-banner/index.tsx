'use client';

import { useCallback, useMemo, useState } from 'react';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import GuideSectionHeading from '@/app/components/guides/GuideSectionHeading';
import Tabs from '@/app/components/ui/Tabs';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import type { LangMap } from '@/types/common';
import { customBannerPicks } from './recommendedCharacters';
import {
  mapNamesToChars,
  CharacterGrid,
  renderWithLineBreaks,
  freeHeroNames,
  flattenedFreeHeroesEntries,
  getNotInCustomBannerChars,
} from './helpers';

/* ── LangMap constants ────────────────────────────────────── */

const S = {
  heading: {
    en: 'All Free Characters & Advice',
    jp: '全無料キャラ & アドバイス',
    kr: '모든 무료 캐릭터 & 조언',
    zh: '所有免费角色与建议',
  } satisfies LangMap,

  intro: {
    en: 'A comprehensive guide on all the free heroes you can obtain and the best pulling strategy for the Custom Banner.',
    jp: '入手可能な無料キャラとカスタムバナーの最適なガチャ戦略についての総合ガイド。',
    kr: '획득 가능한 무료 영웅과 커스텀 배너의 최적 가챠 전략에 대한 종합 가이드.',
    zh: '关于可获取的免费英雄和自选池最佳抽卡策略的综合指南。',
  } satisfies LangMap,

  warning: {
    en: 'Avoid picking duplicates — always choose characters you do not already own. If your in-game recommendations look different, it is because we have already excluded heroes available from guaranteed sources (missions, story progression).',
    jp: '重複を避けよう — まだ持っていないキャラを選ぼう。ゲーム内のおすすめと違う場合は、確定入手可能なキャラ（ミッション、ストーリー進行）を除外しているため。',
    kr: '중복을 피하세요 — 아직 보유하지 않은 캐릭터를 선택하세요. 게임 내 추천과 다르다면, 확정 입수 가능한 영웅（미션、스토리 진행）을 제외했기 때문입니다.',
    zh: '避免重复选择 — 始终选择你尚未拥有的角色。如果游戏内推荐看起来不同，是因为我们已经排除了从确定来源（任务、故事进度）获得的英雄。',
  } satisfies LangMap,

  tabFree: {
    en: 'Free Heroes',
    jp: '無料キャラ',
    kr: '무료 영웅',
    zh: '免费英雄',
  } satisfies LangMap,

  tabCustom: {
    en: 'Custom Banner',
    jp: 'カスタムバナー',
    kr: '커스텀 배너',
    zh: '自选池',
  } satisfies LangMap,

  freeNote: {
    en: 'Guild Shop heroes take 5+ weeks to unlock. Prioritize getting them from the Custom Banner for early progression, then use Guild Shop for transcendence.',
    jp: 'ギルドショップのキャラは入手に5週間以上かかる。序盤の進行を優先するならカスタムバナーで獲得し、ギルドショップは限界突破に使おう。',
    kr: '길드 상점 영웅은 획득에 5주 이상 소요됩니다. 초반 진행을 우선하려면 커스텀 배너에서 획득하고, 길드 상점은 초월에 사용하세요.',
    zh: '公会商店英雄需要5周以上才能解锁。优先从自选池获取以便早期推进，然后使用公会商店进行超越。',
  } satisfies LangMap,

  thSource: {
    en: 'Source', jp: '入手先', kr: '획득처', zh: '获取途径',
  } satisfies LangMap,
  thCharacters: {
    en: 'Characters', jp: 'キャラクター', kr: '캐릭터', zh: '角色',
  } satisfies LangMap,
  thDetails: {
    en: 'Details', jp: '詳細', kr: '상세', zh: '详情',
  } satisfies LangMap,

  chooseOne: {
    en: 'Choose one', jp: '1人選ぶ', kr: '1명 선별', zh: '选一个',
  } satisfies LangMap,

  pullingStrategy: {
    en: 'Pulling Strategy', jp: 'ガチャ戦略', kr: '가챠 전략', zh: '抽卡策略',
  } satisfies LangMap,

  pullingDesc: {
    en: 'Focus on unlocking new characters — doppelgangers handle transcendence. New units join the custom pool ~3.5 months after release.',
    jp: '新キャラの獲得を優先しよう — 限界突破はドッペルゲンガーで対応可能。新キャラはリリースから約3.5ヶ月後にカスタムプールに追加される。',
    kr: '새 캐릭터 획득을 우선시하세요 — 초월은 도플갱어로 가능합니다. 신규 유닛은 출시 약 3.5개월 후 커스텀 풀에 추가됩니다.',
    zh: '优先获取新角色 — 超越可以用分身处理。新角色在发布约3.5个月后加入自选池。',
  } satisfies LangMap,

  pullingNote: {
    en: 'Note: Some heroes are not available in the custom banner yet, as they haven\'t been out long enough.',
    jp: '注：リリースから間もないキャラはまだカスタムバナーに追加されていない場合がある。',
    kr: '참고: 일부 영웅은 출시된 지 얼마 되지 않아 아직 커스텀 배너에 추가되지 않았습니다.',
    zh: '注：部分英雄因发布时间较短，尚未加入自选池。',
  } satisfies LangMap,

  recommendedPicks: {
    en: 'Recommended Picks (by priority)', jp: 'おすすめピック（優先度順）', kr: '추천 픽 (우선순위)', zh: '推荐选择（按优先级）',
  } satisfies LangMap,

  thRecommended: {
    en: 'Recommended', jp: 'おすすめ', kr: '추천', zh: '推荐',
  } satisfies LangMap,
  thFreeAvailable: {
    en: 'Available for free', jp: '無料入手可能', kr: '무료 획득 가능', zh: '免费获取',
  } satisfies LangMap,

  notYetAvailable: {
    en: 'Not Yet Available', jp: '未実装キャラ', kr: '미구현 캐릭터', zh: '暂未实装',
  } satisfies LangMap,
  notYetDesc: {
    en: 'These heroes are too recent to be in the custom banner pool (~3.5 months after release).',
    jp: 'これらのキャラはまだカスタムバナーに追加されていない（リリースから約3.5ヶ月後に追加）。',
    kr: '이 영웅들은 아직 커스텀 배너 풀에 추가되지 않았습니다 (출시 약 3.5개월 후 추가).',
    zh: '这些英雄尚未加入自选池（发布约3.5个月后添加）。',
  } satisfies LangMap,
};

/* ── Component ────────────────────────────────────────────── */

const TAB_KEYS = ['free', 'custom'] as const;

export default function FreeHeroesStartBannerGuide() {
  const { lang } = useI18n();
  const [tab, setTab] = useState<string>('free');
  const onChange = useCallback((v: string) => setTab(v), []);

  return (
    <GuideTemplate
      title={lRec(S.heading, lang)}
      introduction={lRec(S.intro, lang)}
      disclaimer={lRec(S.warning, lang)}
    >
      <Tabs
        items={[...TAB_KEYS]}
        labels={[lRec(S.tabFree, lang), lRec(S.tabCustom, lang)]}
        value={tab}
        onChange={onChange}
        hashPrefix="tab"
        className="justify-center"
      />
      {tab === 'free' ? <FreeHeroesContent /> : <CustomBannerContent />}
    </GuideTemplate>
  );
}

function FreeHeroesContent() {
  const { lang } = useI18n();

  return (
    <div className="space-y-6">
      <p className="text-neutral-400 text-sm italic">
        {lRec(S.freeNote, lang)}
      </p>

      <div className="overflow-x-auto">
        <table className="w-auto mx-auto border border-neutral-600 rounded-md text-center border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-500">
              <th className="text-center py-3 px-4 text-sky-400 font-semibold border-r border-neutral-600">{lRec(S.thSource, lang)}</th>
              <th className="text-center py-3 px-4 text-sky-400 font-semibold border-r border-neutral-600">{lRec(S.thCharacters, lang)}</th>
              <th className="text-center py-3 px-4 text-sky-400 font-semibold">{lRec(S.thDetails, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {flattenedFreeHeroesEntries.map((entry, index) => {
              const chars = mapNamesToChars(entry.names, lang);
              const isPickOne = entry.pickType === 'one';

              return (
                <tr key={index} className={`border-b border-neutral-600 ${index % 2 === 0 ? 'bg-neutral-800/30' : ''}`}>
                  <td className="py-3 px-4 align-middle border-r border-neutral-600">
                    <span className="font-medium text-neutral-200">
                      {renderWithLineBreaks(lRec(entry.source, lang))}
                    </span>
                  </td>
                  <td className="py-3 px-4 align-middle border-r border-neutral-600">
                    <CharacterGrid characters={chars} />
                  </td>
                  <td className="py-3 px-4 align-middle text-sm text-neutral-300">
                    {isPickOne && (
                      <div className="text-center mb-2">
                        <span className="text-amber-400 font-bold text-lg" style={{ textShadow: '0 0 10px rgba(251, 191, 36, 0.8), 0 0 20px rgba(251, 191, 36, 0.4)' }}>
                          {lRec(S.chooseOne, lang)}
                        </span>
                      </div>
                    )}
                    {parseText(lRec(entry.reason, lang))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomBannerContent() {
  const { lang } = useI18n();

  const notInCustomBannerChars = useMemo(() => getNotInCustomBannerChars(lang), [lang]);

  return (
    <div className="space-y-6">
      <GuideSectionHeading>
        {lRec(S.pullingStrategy, lang)}
      </GuideSectionHeading>
      <p>{lRec(S.pullingDesc, lang)}</p>
      <p className="text-neutral-400 text-sm italic">
        {lRec(S.pullingNote, lang)}
      </p>

      <GuideSectionHeading>
        {lRec(S.recommendedPicks, lang)}
      </GuideSectionHeading>

      <div className="overflow-x-auto">
        <table className="w-auto mx-auto border border-neutral-600 rounded-md text-center border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-500">
              <th className="text-center py-3 px-4 text-sky-400 font-semibold border-r border-neutral-600">{lRec(S.thRecommended, lang)}</th>
              <th className="text-center py-3 px-4 text-sky-400 font-semibold border-r border-neutral-600">{lRec(S.thFreeAvailable, lang)}</th>
              <th className="text-center py-3 px-4 text-sky-400 font-semibold">{lRec(S.thDetails, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {customBannerPicks.map((entry, index) => {
              const freeChars = mapNamesToChars(entry.names.filter(name => freeHeroNames.has(name)), lang);
              const notFreeChars = mapNamesToChars(entry.names.filter(name => !freeHeroNames.has(name)), lang);

              return (
                <tr key={index} className={`border-b border-neutral-600 ${index % 2 === 0 ? 'bg-neutral-800/30' : ''}`}>
                  <td className="py-3 px-4 align-middle border-r border-neutral-600">
                    <CharacterGrid characters={notFreeChars} />
                  </td>
                  <td className="py-3 px-4 align-middle border-r border-neutral-600">
                    <CharacterGrid characters={freeChars} />
                  </td>
                  <td className="py-3 px-4 align-middle text-sm text-neutral-300">
                    {parseText(lRec(entry.reason, lang))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {notInCustomBannerChars.length > 0 && (
        <div className="mt-8">
          <GuideSectionHeading>
            {lRec(S.notYetAvailable, lang)}
          </GuideSectionHeading>
          <p className="text-neutral-400 text-sm mb-4">
            {lRec(S.notYetDesc, lang)}
          </p>
          <div className="flex justify-center">
            <CharacterGrid characters={notInCustomBannerChars} cols={4} />
          </div>
        </div>
      )}
    </div>
  );
}
