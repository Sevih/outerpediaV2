'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossPortrait from '@/app/components/guides/BossPortrait';
import ContentCard from '@/app/components/guides/ContentCard';
import Callout from '@/app/components/guides/Callout';
import GuideSectionHeading from '@/app/components/guides/GuideSectionHeading';
import InlineIcon from '@/app/components/inline/InlineIcon';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import parseText from '@/lib/parse-text';

/* ── Helpers ────────────────────────────────────────────── */

function I({ name, label }: { name: string; label: string }) {
  return <InlineIcon icon={`/images/items/${name}.webp`} label={label} />;
}

const BOSSES = {
  ironStretcher:  { icons: '4013071', name: { en: 'Iron Stretcher',  kr: '아이언 스트레쳐', jp: 'アイアンストレッチャー', zh: '铁血伸张者'   } satisfies LangMap },
  blockbuster:    { icons: '4013072', name: { en: 'Blockbuster',     kr: '블록버스터',       jp: 'ブラックバスター',       zh: '破坏猛兽'     } satisfies LangMap },
  mutatedWyvre:   { icons: '4014003', name: { en: 'Mutated Wyvre',   kr: '변이된 와이브르',  jp: '変異したワイブル',       zh: '变异双足飞龙' } satisfies LangMap },
  irregularQueen: { icons: '4089001', name: { en: 'Irregular Queen', kr: '이레귤러 퀸',      jp: 'イレギュラークイーン',   zh: '异型怪女王'   } satisfies LangMap },
} as const;

/* ── Sweep table data ───────────────────────────────────── */

const SWEEP_ROWS = [
  {
    name:   { en: 'Special Request: Identification (Stage 13)',  jp: '特別依頼:正体究明（Lv.13）',  kr: '특별 의뢰 : 정체 규명 (13단계)',  zh: '特别委托:查清身份(第13关)'  } satisfies LangMap,
    cost:   { en: '480 {I-I/Stamina}/day',            jp: '480{I-I/Stamina}/日',        kr: '480{I-I/Stamina}/일',   zh: '480{I-I/Stamina}/天'   } satisfies LangMap,
    reason: { en: 'Special Gear materials ({I-I/Blue Memory Piece} & {I-I/Blue Star Mist}), {I-I/Gold}, 6★ legendary gear (transcend fodder if stats are bad)', jp: '特殊装備素材（{I-I/Blue Memory Piece}・{I-I/Blue Star Mist}）、{I-I/Gold}、6★伝説装備（ステータスが悪ければ超越素材）', kr: '특수 장비 재료（{I-I/Blue Memory Piece} & {I-I/Blue Star Mist}）, {I-I/Gold}, 6★ 전설 장비（스탯이 안 좋으면 초월 재료）', zh: '特殊装备材料（{I-I/Blue Memory Piece}&{I-I/Blue Star Mist}）、{I-I/Gold}、6★传说装备（属性差时用于超越材料）' } satisfies LangMap,
  },
  {
    name:   { en: 'Story Hard Final Bosses',         jp: 'ハードモード最終ボス',         kr: '하드 모드 최종 보스',    zh: '困难模式最终Boss'      } satisfies LangMap,
    cost:   { en: '50 {I-I/Stamina}/chapter',        jp: '50{I-I/Stamina}/章',         kr: '50{I-I/Stamina}/챕터',  zh: '50{I-I/Stamina}/章'   } satisfies LangMap,
    reason: { en: 'Main source of {I-I/Gold}, 6★ red gear, {I-I/Survey Points} & {I-I/Legendary Reforge Catalyst}', jp: '{I-I/Gold}・6★赤装備・{I-I/Survey Points}・{I-I/Legendary Reforge Catalyst}の主な入手先', kr: '{I-I/Gold}, 6★ 레드 장비, {I-I/Survey Points} & {I-I/Legendary Reforge Catalyst} 주요 수급처', zh: '{I-I/Gold}、6★红装、{I-I/Survey Points}和{I-I/Legendary Reforge Catalyst}的主要来源' } satisfies LangMap,
  },
] as const;

const SWEEP_OPTIONAL = {
  name:   { en: 'Special Request: Ecology Study (Stage 13)', jp: '特別依頼:生態調査（Lv.13）', kr: '특별의뢰: 생태 조사 (13단계)', zh: '特别委托:生态调查(第13关)' } satisfies LangMap,
  cost:   { en: '480 {I-I/Stamina}/day',            jp: '480{I-I/Stamina}/日',        kr: '480{I-I/Stamina}/일',   zh: '480{I-I/Stamina}/天'   } satisfies LangMap,
  reason: { en: 'Provides {I-I/Armor Glunite Fragment} for crafting {I-I/Armor Glunite} and 6★ legendary gear (transcend fodder if stats are bad)', jp: '{I-I/Armor Glunite}の精製用{I-I/Armor Glunite Fragment}と6★伝説装備（ステータスが悪ければ超越素材）', kr: '{I-I/Armor Glunite} 제작용 {I-I/Armor Glunite Fragment} 및 6★ 전설 장비（스탯이 안 좋으면 초월 재료）', zh: '提供用于合成{I-I/Armor Glunite}的{I-I/Armor Glunite Fragment}及6★传说装备（属性差时用于超越材料）' } satisfies LangMap,
} as const;

/* ── LangMap constants ──────────────────────────────────── */

const LABELS = {

  roadmap: {
    en: 'Roadmap',
    jp: 'ロードマップ',
    kr: '로드맵',
    zh: '路线图',
  } satisfies LangMap,
  intro: {
    en: 'Learn how to efficiently spend your stamina daily in Outerplane with this step-by-step guide.',
    jp: 'この手順ガイドで、Outerplane の毎日のスタミナを効率よく使う方法を学びましょう。',
    kr: '이 단계별 가이드로 Outerplane에서 매일 스태미나를 효율적으로 사용하는 법을 알아보세요.',
    zh: '通过这份分步指南，了解每日如何在异域战记中高效地消耗体力',
  } satisfies LangMap,

  /* ── Intro ── */

  introPara1: {
    en: 'Spending {I-I/Stamina} efficiently is one of the most important things you can do to progress in this game — especially if you plan to play long-term.',
    jp: '{I-I/Stamina}を効率的に使うことは、このゲームで進行する上で最も重要なことの一つです — 特に長期的にプレイする予定なら。',
    kr: '{I-I/Stamina}를 효율적으로 사용하는 것은 이 게임에서 성장하는 데 가장 중요한 일 중 하나입니다 — 특히 장기 플레이를 계획한다면.',
    zh: '高效使用{I-I/Stamina}是游戏中最重要的事情之一 — 尤其是如果你计划长期游玩。',
  } satisfies LangMap,
  introPara2: {
    en: "Here's a list of daily priorities to help you spend your {I-I/Stamina} wisely and keep resources flowing into your account:",
    jp: '以下は{I-I/Stamina}を賢く使い、アカウントにリソースを流し続けるための毎日の優先事項リストです：',
    kr: '다음은 {I-I/Stamina}를 현명하게 사용하고 계정에 지속적으로 자원을 확보하기 위한 일일 우선순위 목록입니다:',
    zh: '以下是帮助你明智使用{I-I/Stamina}并持续获取资源的每日优先事项列表：',
  } satisfies LangMap,

  /* ── Daily Sweep ── */

  heading_dailySweep: {
    en: 'Daily Sweep',
    jp: 'デイリースイープ',
    kr: '데일리 스윕',
    zh: '每日扫荡',
  } satisfies LangMap,
  body_dailySweep: {
    en: 'Use the Sweep function to clear all 3 categories below in one go.',
    jp: 'スイープ機能で以下の3カテゴリをまとめてクリア。',
    kr: '스윕 기능으로 아래 3가지 카테고리를 한 번에 클리어.',
    zh: '使用扫荡功能一次性完成以下3个类别。',
  } satisfies LangMap,
  sweep_optional: {
    en: 'Optional',
    jp: 'オプション',
    kr: '선택',
    zh: '可选',
  } satisfies LangMap,

  /* ── Terminus Isle ── */

  heading_terminusIsle: {
    en: 'Terminus Isle',
    jp: 'ターミナルアイル',
    kr: '터미널 아일',
    zh: '终点岛',
  } satisfies LangMap,
  cost_terminusIsle: {
    en: '30 {I-I/Stamina}/day',
    jp: '30{I-I/Stamina}/日',
    kr: '30{I-I/Stamina}/일',
    zh: '30{I-I/Stamina}/天',
  } satisfies LangMap,
  body_terminusIsle: {
    en: 'Various rewards, most notably {I-I/Effectium}, {I-I/Proof of Destiny}, {I-I/Token of Connection} and {I-I/Special Recruitment Ticket (Event)}.\nIf you bought the Terminus Isle Exploration Support Pack, you can run it twice for 20 {I-I/Stamina} each.',
    jp: '報酬多数、特に{I-I/Effectium}、{I-I/Proof of Destiny}、{I-I/Token of Connection}、{I-I/Special Recruitment Ticket (Event)}。\nテルミナス島探査応援パック購入済みの場合、20{I-I/Stamina}で2回実行可能。',
    kr: '다양한 보상, 특히 {I-I/Effectium}, {I-I/Proof of Destiny}, {I-I/Token of Connection}, {I-I/Special Recruitment Ticket (Event)}.\n멸망의 섬 탐사 지원팩 구매 시 20{I-I/Stamina}씩 2회 실행 가능.',
    zh: '奖励丰富，最重要的有{I-I/Effectium}、{I-I/Proof of Destiny}、{I-I/Token of Connection}和{I-I/Special Recruitment Ticket (Event)}。\n购买灭亡之岛探索支援包后，可以每次20{I-I/Stamina}运行两次。',
  } satisfies LangMap,

  /* ── Irregular Bosses ── */

  heading_irregularBosses: {
    en: 'Irregular Bosses',
    jp: 'イレギュラーボス',
    kr: '이레귤러 보스',
    zh: '异常Boss',
  } satisfies LangMap,
  cost_irregularBosses: {
    en: '20 {I-I/Stamina}/run (Pursuit, Very Hard)',
    jp: '20{I-I/Stamina}/回（追跡・ベリーハード）',
    kr: '20{I-I/Stamina}/회 (추적, 베리 하드)',
    zh: '20{I-I/Stamina}/次（追踪·超难）',
  } satisfies LangMap,
  body_irregularBossesCost: {
    en: 'Clear the Infiltration stage.\nFor Pursuit rewards: 50K {I-I/Gold}, {I-I/Irregular Cell Type IV}, {I-I/Epic Quality Present Selection Chest}, {I-I/Random Upgrade Stone Chest} & ~5% chance at Irregular gear.\nFarm to 8K cells/month for {I-I/Ether} pass rewards:',
    jp: '侵入ステージをクリア。\n追跡報酬：50K{I-I/Gold}、{I-I/Irregular Cell Type IV}、{I-I/Epic Quality Present Selection Chest}、{I-I/Random Upgrade Stone Chest}、約5%でイレギュラー装備。\n月8Kセルで{I-I/Ether}パス報酬:',
    kr: '침투 스테이지 클리어.\n추적 보상: 50K{I-I/Gold}, {I-I/Irregular Cell Type IV}, {I-I/Epic Quality Present Selection Chest}, {I-I/Random Upgrade Stone Chest} & ~5% 확률 이레귤러 장비.\n월 8K 셀 달성 시 {I-I/Ether} 패스 보상:',
    zh: '通关渗透关卡。\n追踪奖励：50K{I-I/Gold}、{I-I/Irregular Cell Type IV}、{I-I/Epic Quality Present Selection Chest}、{I-I/Random Upgrade Stone Chest}及约5%异常装备。\n刷至月8K细胞获{I-I/Ether}通行证奖励:',
  } satisfies LangMap,
  irregularGearFrom: {
    en: ' from ',
    jp: '：',
    kr: ': ',
    zh: '：来自',
  } satisfies LangMap,

  /* ── Tower Floors ── */

  heading_towerFloors: {
    en: 'Tower Floors',
    jp: '塔フロア',
    kr: '탑 층',
    zh: '塔层',
  } satisfies LangMap,
  cost_towerFloors: {
    en: '500+ {I-I/Stamina}/month',
    jp: '500+{I-I/Stamina}/月',
    kr: '500+{I-I/Stamina}/월',
    zh: '500+{I-I/Stamina}/月',
  } satisfies LangMap,
  body_towerFloors: {
    en: 'Clear Normal floor 100 and Hard floor 7 minimum each month (all floors if possible).',
    jp: '毎月最低ノーマル100階・ハード7階クリア（可能なら全階）。',
    kr: '매월 최소 노말 100층 · 하드 7층 클리어（가능하면 전층）.',
    zh: '每月至少通关普通100层及困难7层（如可能全层通关）。',
  } satisfies LangMap,

  /* ── Adventure License ── */

  heading_adventureLicense: {
    en: 'Adventure License',
    jp: '冒険免許',
    kr: '모험 면허',
    zh: '冒险执照',
  } satisfies LangMap,
  cost_adventureLicense: {
    en: '10 {I-I/Stamina}/attempt',
    jp: '10{I-I/Stamina}/回',
    kr: '10{I-I/Stamina}/회',
    zh: '10{I-I/Stamina}/次',
  } satisfies LangMap,
  body_adventureLicense: {
    en: 'Clear as many bosses as you can weekly (2 attempts per boss).\n{I-I/Gold}, {I-I/License Point}, {I-I/Adventurer Chest} (can reward 15 {I-I/Stamina}) — do 1 boss/day to avoid stamina spikes at week\'s end.',
    jp: '毎週できるだけ多くのボスをクリア（ボスごとに2回まで）。\n{I-I/Gold}、{I-I/License Point}、{I-I/Adventurer Chest}（15{I-I/Stamina}が当たることも）。週末のスタミナ集中消費を避けるため1日1ボスずつ推奨。',
    kr: '매주 최대한 많은 보스 클리어 (보스당 2회까지).\n{I-I/Gold}, {I-I/License Point}, {I-I/Adventurer Chest} (15{I-I/Stamina} 획득 가능) — 주말 스태미나 급격 소모 방지를 위해 하루 1보스씩 추천.',
    zh: '每周尽可能多通关Boss（每个Boss 2次）。\n{I-I/Gold}、{I-I/License Point}、{I-I/Adventurer Chest}（可能获得15{I-I/Stamina}）——建议每天1Boss，避免周末体力暴消。',
  } satisfies LangMap,

  /* ── Total baseline ── */

  heading_totalBaseline: {
    en: 'Total baseline',
    jp: '基本合計',
    kr: '기본 총량',
    zh: '基础总量',
  } satisfies LangMap,
  body_totalBaseline: {
    en: '510 {I-I/Stamina}/day (990 with Ecology Study) + Irregular Bosses, Tower, and Adventure License.',
    jp: '510{I-I/Stamina}/日（生態調査込みで990）＋イレギュラーボス・塔・冒険免許。',
    kr: '510{I-I/Stamina}/일 (생태 조사 포함 시 990) + 이레귤러 보스, 탑, 모험 면허.',
    zh: '510{I-I/Stamina}/天（含生态调查为990）+ 异常Boss、塔、冒险执照。',
  } satisfies LangMap,

  /* ── Non-endgame ── */

  notYetEndgame: {
    en: "Not yet endgame, or need to burn more Stamina? Other suggestions:",
    jp: 'まだエンドゲーム未到達、またはスタミナを消費したい場合：',
    kr: '아직 엔드게임 미도달이거나 스태미나를 더 소비해야 한다면:',
    zh: '还未到达终局，或需要消耗更多体力？其他建议：',
  } satisfies LangMap,
  heading_farmStage12: {
    en: 'Farm Stage 12 Armor Bosses',
    jp: 'ステージ12 防具ボスをファーム',
    kr: '스테이지 12 방어구 보스 파밍',
    zh: '刷第12关 防具Boss',
  } satisfies LangMap,
  body_farmStage12: {
    en: ': Focus on {E/Earth}, {E/Light}, and either {E/Dark} or {E/Water}. {E/Fire} gear is less useful unless chasing specific stats. Costs 36 {I-I/Stamina} per 3 bosses.',
    jp: '：{E/Earth}、{E/Light}、{E/Dark}か{E/Water}に集中。{E/Fire}装備は特定スタット狙い以外有用性低。3体クリアで36{I-I/Stamina}消費。',
    kr: ': {E/Earth}, {E/Light}, {E/Dark} 또는 {E/Water}에 집중. {E/Fire} 장비는 특정 스탯 외엔 비효율. 보스 3개에 36{I-I/Stamina} 소모.',
    zh: '：专注于{E/Earth}、{E/Light}及{E/Dark}或{E/Water}。{E/Fire}装备除特定属性外用处不大。3个Boss消耗36{I-I/Stamina}。',
  } satisfies LangMap,
  heading_hardModeStoryBossesAlt: {
    en: 'Hard Mode Story Bosses',
    jp: 'ハードモード ストーリーボス',
    kr: '하드 모드 스토리 보스',
    zh: '困难模式 剧情Boss',
  } satisfies LangMap,
  affectionItemsLabel: {
    en: 'Affection Items',
    jp: '好感度アイテム',
    kr: '호감도 아이템',
    zh: '好感度道具',
  } satisfies LangMap,
  upgradeStonesLabel: {
    en: 'Upgrade Stones',
    jp: '強化石',
    kr: '강화석',
    zh: '强化石',
  } satisfies LangMap,
  body_hardModeStoryAlt_prefix: {
    en: ': Great for ',
    jp: '：',
    kr: ': ',
    zh: '：非常适合获取',
  } satisfies LangMap,
  body_hardModeStoryAlt_suffix: {
    en: ', {I-I/Gems} and {I-I/Legendary Reforge Catalyst} (from 5★ red dismantle), and {I-I/Survey Points}.',
    jp: '、{I-I/Gems}、{I-I/Legendary Reforge Catalyst}（5★赤分解から）、{I-I/Survey Points}。',
    kr: ', {I-I/Gems} 및 {I-I/Legendary Reforge Catalyst}(5★ 레드 분해), {I-I/Survey Points}.',
    zh: '、{I-I/Gems}和{I-I/Legendary Reforge Catalyst}（5★红色分解）和{I-I/Survey Points}。',
  } satisfies LangMap,

  /* ── Pro tips ── */

  avoidReceiveAll: {
    en: 'Avoid clicking "Receive All" in your mailbox',
    jp: 'メールボックスの「すべて受け取る」をクリックしないで',
    kr: '우편함에서 "모두 받기"를 클릭하지 마세요',
    zh: '避免点击邮箱中的「全部领取」',
  } satisfies LangMap,
  body_avoidReceiveAll: {
    en: ': Stamina rewards stay for ~6 days. Let your bar regenerate naturally, then claim rewards as needed.',
    jp: '：スタミナ報酬は約6日間保持。バーを自然に回復させ、必要に応じて受け取りましょう。',
    kr: ': 스태미나 보상은 약 6일간 보관. 자연 회복 후 필요할 때 수령하세요.',
    zh: '：体力奖励保留约6天。让体力条自然恢复，需要时再领取。',
  } satisfies LangMap,
  body_noteOtherDailies: {
    en: 'Note: Other dailies like Bounty Hunter are also valuable, but they use {I-I/Bounty Hunter Ticket(s)}, not {I-I/Stamina}.',
    jp: '注意：バウンティハンターなど他のデイリーも価値がありますが、{I-I/Stamina}ではなく{I-I/Bounty Hunter Ticket(s)}を使用します。',
    kr: '참고: 현상금 사냥꾼 등 다른 일일 과제도 가치 있지만, {I-I/Stamina}가 아닌 {I-I/Bounty Hunter Ticket(s)}을 사용합니다.',
    zh: '注意：赏金猎人等其他每日任务也很有价值，但使用{I-I/Bounty Hunter Ticket(s)}而非{I-I/Stamina}。',
  } satisfies LangMap,

} as const;

/* ── Component ──────────────────────────────────────────── */

const HL = 'text-yellow-400 underline';

function PriorityCard({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <ContentCard>
      <div className="flex gap-4">
        <div className="shrink-0 w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400 font-bold flex items-center justify-center text-sm">
          {number}
        </div>
        <div className="space-y-3 flex-1 min-w-0">
          {children}
        </div>
      </div>
    </ContentCard>
  );
}

export default function DailyStaminaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate title={lRec(LABELS.roadmap, lang)} introduction={lRec(LABELS.intro, lang)}>
      <div className="space-y-4">

        {/* ── Intro paragraphs ── */}

        <p>{parseText(lRec(LABELS.introPara1, lang))}</p>
        <p>{parseText(lRec(LABELS.introPara2, lang))}</p>

        {/* ── 1. Daily Sweep ── */}

        <PriorityCard number={1}>
          <GuideSectionHeading color="sky">{lRec(LABELS.heading_dailySweep, lang)}</GuideSectionHeading>
          <p className="text-sm text-slate-400">{lRec(LABELS.body_dailySweep, lang)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SWEEP_ROWS.map((row, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-600 rounded-lg p-3 space-y-1">
                <div className="font-semibold text-white text-sm">{lRec(row.name, lang)}</div>
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 w-fit">
                  {parseText(lRec(row.cost, lang))}
                </div>
                <div className="text-xs text-slate-300 pt-1">{parseText(lRec(row.reason, lang))}</div>
              </div>
            ))}
          </div>
          <div className="bg-slate-800/30 border border-dashed border-slate-600/60 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400 text-sm">{lRec(SWEEP_OPTIONAL.name, lang)}</span>
              <span className="text-xs text-slate-500 italic">{lRec(LABELS.sweep_optional, lang)}</span>
            </div>
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 w-fit">
              {parseText(lRec(SWEEP_OPTIONAL.cost, lang))}
            </div>
            <div className="text-xs text-slate-400 pt-1">{parseText(lRec(SWEEP_OPTIONAL.reason, lang))}</div>
          </div>
        </PriorityCard>

        {/* ── 2–5. Other priorities (2-col grid) ── */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* ── 2. Terminus Isle ── */}
          <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400 font-bold flex items-center justify-center text-xs">2</span>
              <span className="font-semibold text-white text-sm">{lRec(LABELS.heading_terminusIsle, lang)}</span>
            </div>
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 w-fit">
              {parseText(lRec(LABELS.cost_terminusIsle, lang))}
            </div>
            <div className="text-xs text-slate-300 pt-1">{parseText(lRec(LABELS.body_terminusIsle, lang))}</div>
          </div>

          {/* ── 3. Irregular Bosses ── */}
          <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400 font-bold flex items-center justify-center text-xs">3</span>
              <span className="font-semibold text-white text-sm">{lRec(LABELS.heading_irregularBosses, lang)}</span>
            </div>
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 w-fit">
              {parseText(lRec(LABELS.cost_irregularBosses, lang))}
            </div>
            <div className="text-xs text-slate-300 pt-1 space-y-1">
              <p>{parseText(lRec(LABELS.body_irregularBossesCost, lang))}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <span className="font-semibold text-equipment">Briareos Collection</span>
                  {lRec(LABELS.irregularGearFrom, lang)}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <BossPortrait icons={BOSSES.ironStretcher.icons} name={lRec(BOSSES.ironStretcher.name, lang)} size="xs" />
                    <span>{lRec(BOSSES.ironStretcher.name, lang)}</span>
                  </span>
                  {' / '}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <BossPortrait icons={BOSSES.blockbuster.icons} name={lRec(BOSSES.blockbuster.name, lang)} size="xs" />
                    <span>{lRec(BOSSES.blockbuster.name, lang)}</span>
                  </span>
                </li>
                <li>
                  <span className="font-semibold text-equipment">Gorgon Collection</span>
                  {lRec(LABELS.irregularGearFrom, lang)}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <BossPortrait icons={BOSSES.mutatedWyvre.icons} name={lRec(BOSSES.mutatedWyvre.name, lang)} size="xs" />
                    <span>{lRec(BOSSES.mutatedWyvre.name, lang)}</span>
                  </span>
                  {' / '}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <BossPortrait icons={BOSSES.irregularQueen.icons} name={lRec(BOSSES.irregularQueen.name, lang)} size="xs" />
                    <span>{lRec(BOSSES.irregularQueen.name, lang)}</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* ── 4. Tower Floors ── */}
          <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400 font-bold flex items-center justify-center text-xs">4</span>
              <span className="font-semibold text-white text-sm">{lRec(LABELS.heading_towerFloors, lang)}</span>
            </div>
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 w-fit">
              {parseText(lRec(LABELS.cost_towerFloors, lang))}
            </div>
            <div className="text-xs text-slate-300 pt-1">{parseText(lRec(LABELS.body_towerFloors, lang))}</div>
          </div>

          {/* ── 5. Adventure License ── */}
          <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400 font-bold flex items-center justify-center text-xs">5</span>
              <span className="font-semibold text-white text-sm">{lRec(LABELS.heading_adventureLicense, lang)}</span>
            </div>
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 w-fit">
              {parseText(lRec(LABELS.cost_adventureLicense, lang))}
            </div>
            <div className="text-xs text-slate-300 pt-1">{parseText(lRec(LABELS.body_adventureLicense, lang))}</div>
          </div>

        </div>

        {/* ── Total baseline ── */}

        <div className="bg-sky-900/15 border border-sky-600/40 rounded-xl p-4 flex items-center gap-4">
          <div className="shrink-0 text-sky-400 text-2xl font-bold">Σ</div>
          <div>
            <div className="text-sm font-semibold text-sky-300">{lRec(LABELS.heading_totalBaseline, lang)}</div>
            <div className="text-xs text-slate-300 mt-0.5">{parseText(lRec(LABELS.body_totalBaseline, lang))}</div>
          </div>
        </div>

        <hr className="border-slate-700/60" />

        {/* ── Non-endgame suggestions ── */}

        <Callout variant="note" className="text-xs">
          <p className="mb-2">{lRec(LABELS.notYetEndgame, lang)}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className={HL}>{lRec(LABELS.heading_farmStage12, lang)}</strong>
              {parseText(lRec(LABELS.body_farmStage12, lang))}
            </li>
            <li>
              <strong className={HL}>{lRec(LABELS.heading_hardModeStoryBossesAlt, lang)}</strong>
              {lRec(LABELS.body_hardModeStoryAlt_prefix, lang)}
              <I name="TI_Present_01_01" label={lRec(LABELS.affectionItemsLabel, lang)} />
              {', '}
              <I name="TI_Item_Growth_Earth_02" label={lRec(LABELS.upgradeStonesLabel, lang)} />
              {parseText(lRec(LABELS.body_hardModeStoryAlt_suffix, lang))}
            </li>
          </ul>
        </Callout>

        {/* ── Pro tips ── */}

        <Callout variant="warning" className="text-xs">
          {'⚠️ '}
          <strong className={HL}>{lRec(LABELS.avoidReceiveAll, lang)}</strong>
          {lRec(LABELS.body_avoidReceiveAll, lang)}
        </Callout>

        <Callout variant="tip" className="text-xs">
          {parseText(lRec(LABELS.body_noteOtherDailies, lang))}
        </Callout>

      </div>
    </GuideTemplate>
  );
}
